import { and, asc, count, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  auditLogs,
  departments,
  dutyRosters,
  equipment,
  equipmentMaintenance,
  escalationRules,
  expiryItems,
  inventory,
  issueComments,
  issues,
  locations,
  notificationRules,
  notifications,
  recurringTasks,
  staffCredentials,
  shiftHandovers,
  staffProfiles,
  taskAssignments,
  taskChecklistResults,
  taskChecklists,
  taskCompletions,
  tasks,
  users,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";
import { computeNextDueDate, expiryHealth, findingCreatesIssue, operationalAssignmentStatus, priorityForFinding, taskCompletionBlockReason, type FindingStatus } from "./operationsLogic";
import { hashPassword, normalizeUsername, passwordPolicyError, verifyPassword } from "./localAuth";

const adminRoles = ["super_admin", "hospital_admin"] as const;
const managerRoles = ["super_admin", "hospital_admin", "department_head", "supervisor"] as const;

const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const atTime = (hour: number, minute = 0, offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Operational database is unavailable." });
  return db;
}

async function ensureNotificationRuleDefaults() {
  const db = await requireDb();
  const existing = await db.select({ value: count() }).from(notificationRules);
  if ((existing[0]?.value ?? 0) > 0) return;
  await db.insert(notificationRules).values([
    { eventType: "task_assigned", label: "New task assigned", leadMinutes: 0 },
    { eventType: "task_due_soon", label: "Task due soon", leadMinutes: 15 },
    { eventType: "overdue_task", label: "Task overdue", leadMinutes: 0 },
    { eventType: "issue_created", label: "Issue created", leadMinutes: 0 },
    { eventType: "issue_escalated", label: "Issue escalated", leadMinutes: 0 },
    { eventType: "maintenance_due", label: "Equipment maintenance due", leadMinutes: 1440 },
    { eventType: "expiry_alert", label: "Item expiring soon", leadMinutes: 43200 },
    { eventType: "replacement_required", label: "Replacement required", leadMinutes: 0 },
  ]);
}

export function isManager(user: User) {
  return managerRoles.includes(user.role as (typeof managerRoles)[number]);
}

export function isAdmin(user: User) {
  return adminRoles.includes(user.role as (typeof adminRoles)[number]);
}

export function ensureManager(user: User) {
  if (!isManager(user)) throw new TRPCError({ code: "FORBIDDEN", message: "This action requires supervisor or administrator access." });
}

export async function writeAudit(actorUserId: number | null, action: string, entityType: string, entityId: number | null, newValue?: Record<string, unknown>) {
  const db = await requireDb();
  await db.insert(auditLogs).values({ actorUserId, action, entityType, entityId, newValue: newValue ?? null });
}

export async function ensureOperationalDemo(actor: User) {
  const db = await requireDb();
  await ensureNotificationRuleDefaults();
  const existing = await db.select({ value: count() }).from(departments);
  if ((existing[0]?.value ?? 0) > 0) return;

  const demoPeople = [
    { openId: "demo-radiology-head", name: "Dr. Maya Shah", email: "maya.shah@hospital.demo", role: "department_head" as const },
    { openId: "demo-pharmacy-lead", name: "Nina Patel", email: "nina.patel@hospital.demo", role: "department_head" as const },
    { openId: "demo-emergency-lead", name: "Dr. Daniel Wong", email: "daniel.wong@hospital.demo", role: "department_head" as const },
    { openId: "demo-technician", name: "Alex Morgan", email: "alex.morgan@hospital.demo", role: "staff" as const },
    { openId: "demo-nurse", name: "Priya Nair", email: "priya.nair@hospital.demo", role: "staff" as const },
    { openId: "demo-maintenance", name: "Jordan Lee", email: "jordan.lee@hospital.demo", role: "supervisor" as const },
  ];
  for (const person of demoPeople) {
    await db.insert(users).values({ ...person, loginMethod: "demo" }).onDuplicateKeyUpdate({ set: { name: person.name, role: person.role } });
  }
  const people = await db.select().from(users).where(inArray(users.openId, demoPeople.map(person => person.openId)));
  const personId = Object.fromEntries(people.map(person => [person.openId, person.id]));

  const depRows = [
    { name: "Radiology", code: "RAD", description: "Imaging operations, radiation safety, and diagnostic equipment." },
    { name: "Pharmacy", code: "PHA", description: "Medication availability, storage, and controlled expiry monitoring." },
    { name: "Emergency", code: "ED", description: "Shift-critical readiness, resuscitation equipment, and patient-flow operations." },
    { name: "Nursing", code: "NUR", description: "Ward nursing operations and bedside support readiness." },
    { name: "Housekeeping", code: "HSK", description: "Environmental hygiene, waste management, and cleaning inspections." },
    { name: "Maintenance", code: "MNT", description: "Utilities, medical equipment service, and infrastructure maintenance." },
  ];
  const insertedDepartments = await db.insert(departments).values(depRows).$returningId();
  const departmentId = Object.fromEntries(depRows.map((row, index) => [row.code, insertedDepartments[index]!.id]));
  await db.update(departments).set({ headUserId: personId["demo-radiology-head"] }).where(eq(departments.id, departmentId.RAD));
  await db.update(departments).set({ headUserId: personId["demo-pharmacy-lead"] }).where(eq(departments.id, departmentId.PHA));
  await db.update(departments).set({ headUserId: personId["demo-emergency-lead"] }).where(eq(departments.id, departmentId.ED));
  await db.update(departments).set({ headUserId: personId["demo-maintenance"] }).where(eq(departments.id, departmentId.MNT));

  const locationRows = [
    { name: "Imaging Suite A", building: "Main Building", floor: "Ground", departmentId: departmentId.RAD },
    { name: "Pharmacy Cold Store", building: "Main Building", floor: "Ground", departmentId: departmentId.PHA },
    { name: "Resuscitation Bay", building: "Emergency Block", floor: "Ground", departmentId: departmentId.ED },
    { name: "Plant Room", building: "Service Block", floor: "Basement", departmentId: departmentId.MNT },
  ];
  const insertedLocations = await db.insert(locations).values(locationRows).$returningId();
  const locationId = { imaging: insertedLocations[0]!.id, pharmacy: insertedLocations[1]!.id, emergency: insertedLocations[2]!.id, plant: insertedLocations[3]!.id };

  const profiles = [
    { userId: actor.id, departmentId: departmentId.RAD, employeeCode: "OPS-001", title: "Operations Administrator" },
    { userId: personId["demo-radiology-head"], departmentId: departmentId.RAD, employeeCode: "RAD-101", title: "Radiologist & Department Head" },
    { userId: personId["demo-pharmacy-lead"], departmentId: departmentId.PHA, employeeCode: "PHA-201", title: "Pharmacy Lead" },
    { userId: personId["demo-emergency-lead"], departmentId: departmentId.ED, employeeCode: "ED-301", title: "Emergency Department Head" },
    { userId: personId["demo-technician"], departmentId: departmentId.RAD, employeeCode: "RAD-112", title: "Imaging Technician" },
    { userId: personId["demo-nurse"], departmentId: departmentId.ED, employeeCode: "ED-322", title: "Senior Nurse" },
    { userId: personId["demo-maintenance"], departmentId: departmentId.MNT, employeeCode: "MNT-401", title: "Maintenance Supervisor" },
  ];
  await db.insert(staffProfiles).values(profiles).onDuplicateKeyUpdate({ set: { active: true } });

  const taskRows = [
    { name: "X-ray machine operational check", departmentId: departmentId.RAD, assignedUserId: personId["demo-technician"], frequency: "daily" as const, dueTime: "09:00", priority: "high" as const, category: "Equipment", instructions: "Verify system readiness and record all safety findings before first imaging session.", evidenceRequired: false, photoRequired: false, approvalRequired: false, createdBy: actor.id },
    { name: "Lead apron and radiation safety check", departmentId: departmentId.RAD, assignedUserId: personId["demo-technician"], frequency: "daily" as const, dueTime: "09:15", priority: "high" as const, category: "Safety", instructions: "Confirm protective equipment availability, condition, and correct location.", evidenceRequired: true, photoRequired: true, approvalRequired: false, createdBy: actor.id },
    { name: "Essential medicine availability", departmentId: departmentId.PHA, assignedUserId: personId["demo-pharmacy-lead"], frequency: "daily" as const, dueTime: "09:30", priority: "critical" as const, category: "Inventory", instructions: "Review critical medication stock and near-expiry items for the emergency formulary.", evidenceRequired: false, photoRequired: false, approvalRequired: true, createdBy: actor.id },
    { name: "Emergency trolley check", departmentId: departmentId.ED, assignedUserId: personId["demo-nurse"], frequency: "every_shift" as const, dueTime: "10:00", priority: "critical" as const, category: "Emergency readiness", instructions: "Inspect trolley, defibrillator, oxygen, suction, emergency medicines, and monitoring equipment.", evidenceRequired: true, photoRequired: true, approvalRequired: true, createdBy: actor.id },
    { name: "Generator and medical gas system check", departmentId: departmentId.MNT, assignedUserId: personId["demo-maintenance"], frequency: "daily" as const, dueTime: "08:30", priority: "critical" as const, category: "Infrastructure", instructions: "Confirm generator transfer readiness and medical gas pressure indicators.", evidenceRequired: true, photoRequired: false, approvalRequired: false, createdBy: actor.id },
    { name: "Emergency cleaning and waste inspection", departmentId: departmentId.HSK, assignedUserId: actor.id, frequency: "daily" as const, dueTime: "11:00", priority: "medium" as const, category: "Housekeeping", instructions: "Inspect environmental hygiene, sharps handling, and cleaning supplies.", evidenceRequired: false, photoRequired: false, approvalRequired: false, createdBy: actor.id },
  ];
  const insertedTasks = await db.insert(tasks).values(taskRows).$returningId();
  const taskId = insertedTasks.map(row => row.id);
  const checklistLabels = [
    ["X-ray machine powers on normally", "Radiation warning sign visible", "Emergency equipment available"],
    ["Lead apron available", "Lead apron undamaged", "Lead apron stored in Imaging Suite A"],
    ["Emergency medicines above reorder level", "Refrigerator temperature in range", "Near-expiry medicines reviewed"],
    ["Defibrillator charged", "Oxygen cylinder available", "Suction functioning", "Emergency medicines sealed"],
    ["Generator fuel level acceptable", "Medical gas pressure normal", "Backup power alarm tested"],
    ["Emergency bay cleaned", "Waste segregated", "Cleaning supplies available"],
  ];
  await db.insert(taskChecklists).values(checklistLabels.flatMap((labels, taskIndex) => labels.map((label, position) => ({ taskId: taskId[taskIndex]!, label, position, required: true, expectedLocation: taskIndex === 1 && position === 2 ? "Imaging Suite A" : null }))));

  await db.insert(taskAssignments).values([
    { taskId: taskId[0]!, departmentId: departmentId.RAD, assignedUserId: personId["demo-technician"], dueAt: atTime(9, 0), status: "completed", completedAt: atTime(8, 52) },
    { taskId: taskId[1]!, departmentId: departmentId.RAD, assignedUserId: personId["demo-technician"], dueAt: atTime(9, 15), status: "in_progress" },
    { taskId: taskId[2]!, departmentId: departmentId.PHA, assignedUserId: personId["demo-pharmacy-lead"], dueAt: atTime(9, 30), status: "pending_approval", completedAt: atTime(9, 12) },
    { taskId: taskId[3]!, departmentId: departmentId.ED, assignedUserId: personId["demo-nurse"], dueAt: atTime(10, 0), status: "not_started" },
    { taskId: taskId[4]!, departmentId: departmentId.MNT, assignedUserId: personId["demo-maintenance"], dueAt: atTime(8, 30), status: "not_started" },
    { taskId: taskId[5]!, departmentId: departmentId.HSK, assignedUserId: actor.id, dueAt: atTime(11, 0), status: "not_started" },
  ]);
  for (const id of taskId) await db.insert(recurringTasks).values({ taskId: id, nextRunAt: computeNextDueDate("daily") });

  const equipmentRows = [
    { name: "Digital X-ray System", equipmentCode: "EQ-RAD-001", departmentId: departmentId.RAD, locationId: locationId.imaging, manufacturer: "Mediview", model: "DX-400", serialNumber: "DX4-2026-118", nextServiceAt: atTime(0, 0, 18), nextCalibrationAt: atTime(0, 0, 35), responsibleUserId: personId["demo-technician"], maintenanceCompany: "Clinical Engineering Services", status: "working" as const },
    { name: "Emergency Defibrillator", equipmentCode: "EQ-ED-014", departmentId: departmentId.ED, locationId: locationId.emergency, manufacturer: "Lifeline", model: "Rescue Pro", serialNumber: "RP-8841", nextServiceAt: atTime(0, 0, 4), nextCalibrationAt: atTime(0, 0, 95), responsibleUserId: personId["demo-nurse"], maintenanceCompany: "Clinical Engineering Services", status: "under_maintenance" as const },
    { name: "Backup Generator", equipmentCode: "EQ-MNT-002", departmentId: departmentId.MNT, locationId: locationId.plant, manufacturer: "PowerSafe", model: "PS-80", serialNumber: "PS80-540", nextServiceAt: atTime(0, 0, -1), responsibleUserId: personId["demo-maintenance"], maintenanceCompany: "PowerSafe Support", status: "working" as const },
  ];
  const insertedEquipment = await db.insert(equipment).values(equipmentRows).$returningId();
  await db.insert(equipmentMaintenance).values([
    { equipmentId: insertedEquipment[1]!.id, maintenanceType: "Preventive service", scheduledAt: atTime(0, 0, 4), vendor: "Clinical Engineering Services", status: "scheduled" },
    { equipmentId: insertedEquipment[2]!.id, maintenanceType: "Quarterly inspection", scheduledAt: atTime(0, 0, -1), vendor: "PowerSafe Support", status: "overdue" },
  ]);

  const inventoryRows = [
    { name: "Lead aprons", category: "Radiology protection", departmentId: departmentId.RAD, locationId: locationId.imaging, quantity: 4, reorderLevel: 5, unit: "items", responsibleUserId: personId["demo-technician"] },
    { name: "Emergency medicines", category: "Critical medicines", departmentId: departmentId.PHA, locationId: locationId.pharmacy, quantity: 55, reorderLevel: 40, unit: "ampoules", responsibleUserId: personId["demo-pharmacy-lead"] },
    { name: "Oxygen cylinders", category: "Medical gas", departmentId: departmentId.ED, locationId: locationId.emergency, quantity: 2, reorderLevel: 3, unit: "cylinders", responsibleUserId: personId["demo-nurse"] },
  ];
  const insertedInventory = await db.insert(inventory).values(inventoryRows).$returningId();
  await db.insert(expiryItems).values([
    { inventoryId: insertedInventory[1]!.id, name: "Adrenaline 1mg/mL", category: "Emergency medicines", departmentId: departmentId.PHA, batchNumber: "AD-26-092", quantity: 18, expiryDate: new Date(dateKey(atTime(0, 0, 17))), storageLocation: "Pharmacy Cold Store", responsibleUserId: personId["demo-pharmacy-lead"] },
    { inventoryId: insertedInventory[1]!.id, name: "Contrast media", category: "Radiology consumables", departmentId: departmentId.RAD, batchNumber: "CM-26-011", quantity: 8, expiryDate: new Date(dateKey(atTime(0, 0, 46))), storageLocation: "Imaging Suite A", responsibleUserId: personId["demo-technician"] },
    { name: "Generator service certificate", category: "Certificate", departmentId: departmentId.MNT, batchNumber: "GEN-CERT-2026", quantity: 1, expiryDate: new Date(dateKey(atTime(0, 0, -2))), storageLocation: "Plant Room", responsibleUserId: personId["demo-maintenance"] },
  ]);

  const issueRows = [
    { code: "ISS-1042", title: "Lead apron seam damaged", description: "A damaged lead apron was found during the daily radiology safety check.", departmentId: departmentId.RAD, category: "Equipment", priority: "high" as const, status: "open" as const, sourceType: "checklist", reportedBy: personId["demo-technician"], assignedTo: personId["demo-maintenance"], dueAt: atTime(14, 0) },
    { code: "ISS-1043", title: "Defibrillator preventive service due", description: "Preventive maintenance is scheduled before the next emergency shift change.", departmentId: departmentId.ED, category: "Equipment", priority: "critical" as const, status: "in_progress" as const, sourceType: "maintenance", reportedBy: personId["demo-nurse"], assignedTo: personId["demo-maintenance"], dueAt: atTime(13, 0) },
    { code: "ISS-1044", title: "Generator inspection overdue", description: "Quarterly generator inspection has not been recorded.", departmentId: departmentId.MNT, category: "Maintenance", priority: "high" as const, status: "escalated" as const, sourceType: "maintenance", reportedBy: personId["demo-maintenance"], assignedTo: personId["demo-maintenance"], dueAt: atTime(8, 0) },
  ];
  const insertedIssues = await db.insert(issues).values(issueRows).$returningId();
  await db.insert(issueComments).values({ issueId: insertedIssues[0]!.id, userId: personId["demo-radiology-head"], body: "Replacement apron requested from Stores; retain damaged item for safety inspection." });
  await db.insert(dutyRosters).values([
    { departmentId: departmentId.ED, userId: personId["demo-emergency-lead"], dutyDate: new Date(dateKey()), shift: "Day", startTime: "08:00", endTime: "16:00", assignedDuty: "Emergency clinical lead", attendance: "present" },
    { departmentId: departmentId.ED, userId: personId["demo-nurse"], dutyDate: new Date(dateKey()), shift: "Day", startTime: "08:00", endTime: "16:00", assignedDuty: "Resuscitation bay nurse", attendance: "present" },
    { departmentId: departmentId.RAD, userId: personId["demo-technician"], dutyDate: new Date(dateKey()), shift: "Day", startTime: "08:00", endTime: "16:00", assignedDuty: "Imaging technician", attendance: "late", notes: "Arrived at 08:18; coverage confirmed." },
  ]);
  await db.insert(shiftHandovers).values({ departmentId: departmentId.ED, fromUserId: personId["demo-nurse"], shift: "Night to Day", handoverDate: new Date(dateKey()), pendingTasks: "Confirm oxygen cylinder replacement before 13:00.", equipmentProblems: "Defibrillator service ticket ISS-1043 remains in progress.", stockShortages: "Two oxygen cylinders on hand; replacement request open.", operationalNotes: "Maintain readiness checks until service team signs off.", unresolved: true });
  await db.insert(escalationRules).values({ name: "Critical operational task escalation", appliesTo: "task", priority: "critical", firstReminderMinutes: 15, departmentHeadMinutes: 60, adminMinutes: 180 });
  await db.insert(notifications).values([
    { departmentId: departmentId.RAD, type: "issue", title: "High-priority equipment issue", body: "Lead apron seam damaged. Issue ISS-1042 requires action today.", entityType: "issue", entityId: insertedIssues[0]!.id },
    { departmentId: departmentId.ED, type: "maintenance", title: "Service due", body: "Emergency Defibrillator service is due within four days.", entityType: "equipment", entityId: insertedEquipment[1]!.id },
    { userId: actor.id, type: "handover", title: "Unresolved ED handover", body: "Emergency Department has unresolved items awaiting day-shift follow-up.", entityType: "handover", entityId: 1 },
  ]);
  await writeAudit(actor.id, "seeded_operational_workspace", "workspace", null, { departments: depRows.length, tasks: taskRows.length, issues: issueRows.length });
}

export async function getDashboard(user: User) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const [assignmentRows, issueRows, equipmentRows, inventoryRows, expiryRows, departmentRows, notificationRows] = await Promise.all([
    db.select({ id: taskAssignments.id, status: taskAssignments.status, dueAt: taskAssignments.dueAt, taskName: tasks.name, priority: tasks.priority, departmentId: departments.id, departmentName: departments.name, assignedUserId: taskAssignments.assignedUserId }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).innerJoin(departments, eq(taskAssignments.departmentId, departments.id)),
    db.select().from(issues).orderBy(desc(issues.updatedAt)),
    db.select().from(equipment),
    db.select().from(inventory),
    db.select().from(expiryItems),
    db.select().from(departments).where(eq(departments.active, true)),
    db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(6),
  ]);
  const now = new Date();
  const statusCounts = assignmentRows.reduce<Record<string, number>>((total, assignment) => {
    const status = operationalAssignmentStatus(assignment.status, assignment.dueAt, now);
    total[status] = (total[status] ?? 0) + 1;
    return total;
  }, {});
  const departmentHealth = departmentRows.map(department => {
    const group = assignmentRows.filter(row => row.departmentId === department.id);
    const overdue = group.filter(row => operationalAssignmentStatus(row.status, row.dueAt, now) === "overdue").length;
    const activeIssues = issueRows.filter(issue => issue.departmentId === department.id && !["resolved", "closed"].includes(issue.status)).length;
    const completed = group.filter(row => row.status === "completed").length;
    return { ...department, completed, total: group.length, overdue, activeIssues, health: overdue > 0 || activeIssues > 1 ? "attention" : completed === group.length && group.length > 0 ? "normal" : "watch" };
  });
  const expiryCounts = expiryRows.reduce<Record<string, number>>((total, item) => {
    const key = expiryHealth(new Date(item.expiryDate));
    total[key] = (total[key] ?? 0) + 1;
    return total;
  }, {});
  return {
    taskCounts: { total: assignmentRows.length, completed: statusCounts.completed ?? 0, pending: (statusCounts.not_started ?? 0) + (statusCounts.in_progress ?? 0) + (statusCounts.pending_approval ?? 0), overdue: statusCounts.overdue ?? 0 },
    issueCounts: { critical: issueRows.filter(issue => issue.priority === "critical" && !["resolved", "closed"].includes(issue.status)).length, high: issueRows.filter(issue => issue.priority === "high" && !["resolved", "closed"].includes(issue.status)).length, open: issueRows.filter(issue => !["resolved", "closed"].includes(issue.status)).length },
    equipmentCounts: { total: equipmentRows.length, working: equipmentRows.filter(row => row.status === "working").length, attention: equipmentRows.filter(row => row.status !== "working").length },
    inventoryCounts: { shortages: inventoryRows.filter(item => item.quantity <= item.reorderLevel).length, expiringSoon: (expiryCounts.within_30_days ?? 0) + (expiryCounts.within_60_days ?? 0), expired: expiryCounts.expired ?? 0 },
    departmentHealth,
    notifications: notificationRows,
    recentAssignments: assignmentRows.slice(0, 6).map(row => ({ ...row, effectiveStatus: operationalAssignmentStatus(row.status, row.dueAt, now) })),
  };
}

export async function getMyDay(user: User) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const profile = (await db.select().from(staffProfiles).where(eq(staffProfiles.userId, user.id)).limit(1))[0];
  const rows = await db.select({ assignment: taskAssignments, task: tasks, departmentName: departments.name }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).innerJoin(departments, eq(taskAssignments.departmentId, departments.id)).where(isAdmin(user) ? undefined : profile ? sql`(${taskAssignments.assignedUserId} = ${user.id} OR ${taskAssignments.departmentId} = ${profile.departmentId})` : eq(taskAssignments.assignedUserId, user.id)).orderBy(asc(taskAssignments.dueAt));
  const now = new Date();
  const active = rows.map(row => ({ ...row, effectiveStatus: operationalAssignmentStatus(row.assignment.status, row.assignment.dueAt, now) }));
  return { tasks: active, counts: { total: active.length, overdue: active.filter(row => row.effectiveStatus === "overdue").length, completed: active.filter(row => row.effectiveStatus === "completed").length, pending: active.filter(row => !["completed", "overdue"].includes(row.effectiveStatus)).length } };
}

export async function getTaskDetail(user: User, assignmentId: number) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const row = (await db.select({ assignment: taskAssignments, task: tasks, department: departments }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).innerJoin(departments, eq(taskAssignments.departmentId, departments.id)).where(eq(taskAssignments.id, assignmentId)).limit(1))[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Task assignment not found." });
  if (!isAdmin(user) && row.assignment.assignedUserId !== user.id && !isManager(user)) throw new TRPCError({ code: "FORBIDDEN", message: "You can only open tasks assigned to you." });
  const [checklist, results] = await Promise.all([
    db.select().from(taskChecklists).where(and(eq(taskChecklists.taskId, row.task.id), eq(taskChecklists.active, true))).orderBy(asc(taskChecklists.position)),
    db.select().from(taskChecklistResults).where(eq(taskChecklistResults.assignmentId, assignmentId)),
  ]);
  const byChecklist = new Map(results.map(result => [result.checklistId, result]));
  return { ...row, effectiveStatus: operationalAssignmentStatus(row.assignment.status, row.assignment.dueAt), checklist: checklist.map(item => ({ ...item, result: byChecklist.get(item.id) ?? null })) };
}

export async function saveChecklistResult(user: User, input: { assignmentId: number; checklistId: number; status: FindingStatus; note?: string; evidenceUrl?: string }) {
  const db = await requireDb();
  const detail = await getTaskDetail(user, input.assignmentId);
  const checklist = detail.checklist.find(item => item.id === input.checklistId);
  if (!checklist) throw new TRPCError({ code: "BAD_REQUEST", message: "Checklist item does not belong to this task." });
  const existing = (await db.select().from(taskChecklistResults).where(and(eq(taskChecklistResults.assignmentId, input.assignmentId), eq(taskChecklistResults.checklistId, input.checklistId))).limit(1))[0];
  let issueId = existing?.createdIssueId ?? null;
  if (findingCreatesIssue(input.status) && !issueId) {
    const created = await db.insert(issues).values({
      code: `ISS-${String(Date.now()).slice(-6)}`,
      title: `${checklist.label}: ${input.status.replaceAll("_", " ")}`,
      description: input.note ?? `Checklist finding recorded during ${detail.task.name}.`,
      departmentId: detail.department.id,
      category: detail.task.category,
      priority: priorityForFinding(input.status),
      sourceType: "checklist_result",
      sourceId: input.assignmentId,
      reportedBy: user.id,
      dueAt: priorityForFinding(input.status) === "critical" ? new Date(Date.now() + 4 * 60 * 60_000) : new Date(Date.now() + 24 * 60 * 60_000),
    }).$returningId();
    issueId = created[0]!.id;
    await db.insert(notifications).values({ departmentId: detail.department.id, type: "issue", title: "New operational issue", body: `${checklist.label} was reported as ${input.status.replaceAll("_", " ")}.`, entityType: "issue", entityId: issueId });
    await writeAudit(user.id, "issue_created_from_checklist", "issue", issueId, { status: input.status, assignmentId: input.assignmentId });
  }
  if (existing) {
    await db.update(taskChecklistResults).set({ status: input.status, note: input.note ?? null, evidenceUrl: input.evidenceUrl ?? null, reportedBy: user.id, createdIssueId: issueId }).where(eq(taskChecklistResults.id, existing.id));
  } else {
    await db.insert(taskChecklistResults).values({ assignmentId: input.assignmentId, checklistId: input.checklistId, status: input.status, note: input.note ?? null, evidenceUrl: input.evidenceUrl ?? null, reportedBy: user.id, createdIssueId: issueId });
  }
  await db.update(taskAssignments).set({ status: "in_progress" }).where(eq(taskAssignments.id, input.assignmentId));
  await writeAudit(user.id, "checklist_result_saved", "task_assignment", input.assignmentId, { checklistId: input.checklistId, status: input.status, issueId });
  return { issueId, createdIssue: Boolean(issueId && !existing?.createdIssueId) };
}

export async function completeTask(user: User, input: { assignmentId: number; notes?: string; evidenceUrl?: string }) {
  const db = await requireDb();
  const detail = await getTaskDetail(user, input.assignmentId);
  const requiredChecklist = detail.checklist.filter(item => item.required);
  const completionBlock = taskCompletionBlockReason({ requiredChecklistCount: requiredChecklist.length, completedChecklistCount: requiredChecklist.filter(item => item.result).length, evidenceRequired: detail.task.evidenceRequired, evidenceUrl: input.evidenceUrl });
  if (completionBlock) throw new TRPCError({ code: "BAD_REQUEST", message: completionBlock });
  const needsApproval = detail.task.approvalRequired;
  const finalStatus = needsApproval ? "pending_approval" : "completed" as const;
  await db.update(taskAssignments).set({ status: finalStatus, completedAt: new Date() }).where(eq(taskAssignments.id, input.assignmentId));
  await db.insert(taskCompletions).values({ assignmentId: input.assignmentId, taskId: detail.task.id, userId: user.id, departmentId: detail.department.id, status: finalStatus, notes: input.notes ?? null, evidenceUrl: input.evidenceUrl ?? null, approvalStatus: needsApproval ? "pending" : "not_required" }).onDuplicateKeyUpdate({ set: { status: finalStatus, notes: input.notes ?? null, evidenceUrl: input.evidenceUrl ?? null, completedAt: new Date() } });
  await writeAudit(user.id, "task_submitted", "task_assignment", input.assignmentId, { status: finalStatus });
  return { status: finalStatus };
}

export async function createTask(user: User, input: { name: string; description?: string; departmentId: number; assignedUserId?: number; frequency: "one_time" | "daily" | "every_shift" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom"; dueTime: string; priority: "critical" | "high" | "medium" | "low"; category: string; instructions?: string; evidenceRequired?: boolean; photoRequired?: boolean; approvalRequired?: boolean; checklist: string[] }) {
  ensureManager(user);
  const db = await requireDb();
  const ids = await db.insert(tasks).values({ ...input, assignedUserId: input.assignedUserId ?? null, description: input.description ?? null, instructions: input.instructions ?? null, evidenceRequired: input.evidenceRequired ?? false, photoRequired: input.photoRequired ?? false, approvalRequired: input.approvalRequired ?? false, createdBy: user.id }).$returningId();
  const taskId = ids[0]!.id;
  if (input.checklist.length) await db.insert(taskChecklists).values(input.checklist.filter(Boolean).map((label, position) => ({ taskId, label, position, required: true })));
  const dueAt = new Date(`${dateKey()}T${input.dueTime}:00`);
  const assignment = await db.insert(taskAssignments).values({ taskId, departmentId: input.departmentId, assignedUserId: input.assignedUserId ?? null, dueAt }).$returningId();
  if (input.frequency !== "one_time") await db.insert(recurringTasks).values({ taskId, nextRunAt: computeNextDueDate(input.frequency, dueAt) });
  await writeAudit(user.id, "task_created", "task", taskId, { assignmentId: assignment[0]!.id, frequency: input.frequency });
  return { taskId, assignmentId: assignment[0]!.id };
}

export async function listIssues(user: User) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const rows = await db.select({ issue: issues, departmentName: departments.name, reporterName: users.name }).from(issues).innerJoin(departments, eq(issues.departmentId, departments.id)).leftJoin(users, eq(issues.reportedBy, users.id)).orderBy(desc(issues.updatedAt));
  return rows;
}

export async function createIssue(user: User, input: { title: string; description?: string; departmentId: number; category: string; priority: "critical" | "high" | "medium" | "low"; dueAt?: Date }) {
  const db = await requireDb();
  const created = await db.insert(issues).values({ code: `ISS-${String(Date.now()).slice(-6)}`, title: input.title, description: input.description ?? null, departmentId: input.departmentId, category: input.category, priority: input.priority, reportedBy: user.id, dueAt: input.dueAt ?? null }).$returningId();
  await db.insert(notifications).values({ departmentId: input.departmentId, type: "issue", title: "New issue reported", body: input.title, entityType: "issue", entityId: created[0]!.id });
  await writeAudit(user.id, "issue_created", "issue", created[0]!.id, { priority: input.priority });
  return { id: created[0]!.id };
}

export async function resolveIssue(user: User, input: { issueId: number; resolution: string }) {
  ensureManager(user);
  const db = await requireDb();
  const existing = (await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1))[0];
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  await db.update(issues).set({ status: "resolved", resolution: input.resolution, closedBy: user.id, closedAt: new Date() }).where(eq(issues.id, input.issueId));
  await writeAudit(user.id, "issue_resolved", "issue", input.issueId, { resolution: input.resolution });
  return { success: true };
}

export async function getIssueHistory(user: User, issueId: number) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const issue = (await db.select().from(issues).where(eq(issues.id, issueId)).limit(1))[0];
  if (!issue) throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  const [comments, history] = await Promise.all([
    db.select({ comment: issueComments, userName: users.name }).from(issueComments).leftJoin(users, eq(issueComments.userId, users.id)).where(eq(issueComments.issueId, issueId)).orderBy(asc(issueComments.createdAt)),
    db.select({ audit: auditLogs, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(and(eq(auditLogs.entityType, "issue"), eq(auditLogs.entityId, issueId))).orderBy(asc(auditLogs.createdAt)),
  ]);
  return { issue, comments, history };
}

export async function getOperationsModules(user: User) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const [departmentRows, equipmentRows, inventoryRows, expiryRows, rosterRows, handovers, auditRows, staffRows] = await Promise.all([
    db.select().from(departments).where(eq(departments.active, true)).orderBy(asc(departments.name)),
    db.select({ equipment, departmentName: departments.name }).from(equipment).innerJoin(departments, eq(equipment.departmentId, departments.id)).orderBy(asc(equipment.name)),
    db.select({ inventory, departmentName: departments.name }).from(inventory).innerJoin(departments, eq(inventory.departmentId, departments.id)).orderBy(asc(inventory.name)),
    db.select({ expiry: expiryItems, departmentName: departments.name }).from(expiryItems).innerJoin(departments, eq(expiryItems.departmentId, departments.id)).orderBy(asc(expiryItems.expiryDate)),
    db.select({ roster: dutyRosters, departmentName: departments.name, staffName: users.name }).from(dutyRosters).innerJoin(departments, eq(dutyRosters.departmentId, departments.id)).innerJoin(users, eq(dutyRosters.userId, users.id)).where(eq(dutyRosters.dutyDate, new Date(dateKey()))).orderBy(asc(dutyRosters.startTime)),
    db.select({ handover: shiftHandovers, departmentName: departments.name, fromUserName: users.name }).from(shiftHandovers).innerJoin(departments, eq(shiftHandovers.departmentId, departments.id)).innerJoin(users, eq(shiftHandovers.fromUserId, users.id)).orderBy(desc(shiftHandovers.createdAt)),
    db.select({ audit: auditLogs, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(20),
    db.select({ id: users.id, name: users.name, role: users.role, departmentId: staffProfiles.departmentId, title: staffProfiles.title }).from(users).innerJoin(staffProfiles, eq(users.id, staffProfiles.userId)).where(eq(staffProfiles.active, true)).orderBy(asc(users.name)),
  ]);
  return { departments: departmentRows, equipment: equipmentRows, inventory: inventoryRows.map(row => ({ ...row, lowStock: row.inventory.quantity <= row.inventory.reorderLevel })), expiry: expiryRows.map(row => ({ ...row, health: expiryHealth(new Date(row.expiry.expiryDate)) })), rosters: rosterRows, handovers, auditLogs: auditRows, staff: staffRows };
}

export async function createHandover(user: User, input: { departmentId: number; shift: string; pendingTasks?: string; equipmentProblems?: string; stockShortages?: string; incidents?: string; operationalNotes?: string }) {
  const db = await requireDb();
  const created = await db.insert(shiftHandovers).values({ ...input, fromUserId: user.id, handoverDate: new Date(dateKey()), pendingTasks: input.pendingTasks ?? null, equipmentProblems: input.equipmentProblems ?? null, stockShortages: input.stockShortages ?? null, incidents: input.incidents ?? null, operationalNotes: input.operationalNotes ?? null }).$returningId();
  await writeAudit(user.id, "shift_handover_created", "shift_handover", created[0]!.id);
  return { id: created[0]!.id };
}

export async function getReports(user: User) {
  ensureManager(user);
  const dashboard = await getDashboard(user);
  const db = await requireDb();
  const [departmentRows, rosterRows, issueRows] = await Promise.all([
    db.select().from(departments).where(eq(departments.active, true)),
    db.select().from(dutyRosters).where(eq(dutyRosters.dutyDate, new Date(dateKey()))),
    db.select().from(issues),
  ]);
  return {
    generatedAt: new Date(),
    dashboard,
    departmentPerformance: dashboard.departmentHealth.map(department => ({ name: department.name, assigned: department.total, completed: department.completed, completionRate: department.total ? Math.round((department.completed / department.total) * 100) : 0, overdue: department.overdue, openIssues: department.activeIssues })),
    attendance: { scheduled: rosterRows.length, absent: rosterRows.filter(row => row.attendance === "absent" || row.attendance === "leave").length, late: rosterRows.filter(row => row.attendance === "late").length, replacements: rosterRows.filter(row => row.attendance === "replacement").length },
    issueSummary: { total: issueRows.length, open: issueRows.filter(row => !["resolved", "closed"].includes(row.status)).length, critical: issueRows.filter(row => row.priority === "critical" && !["resolved", "closed"].includes(row.status)).length },
    departmentCount: departmentRows.length,
  };
}

export async function manageDepartment(user: User, input: { name: string; code: string; description?: string }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can manage departments." });
  const db = await requireDb();
  const created = await db.insert(departments).values({ name: input.name, code: input.code.toUpperCase(), description: input.description ?? null }).$returningId();
  await writeAudit(user.id, "department_created", "department", created[0]!.id, input);
  return { id: created[0]!.id };
}

export async function manageStaff(user: User, input: { name: string; email?: string; departmentId: number; role: "hospital_admin" | "department_head" | "supervisor" | "staff" | "viewer"; title?: string; username?: string; temporaryPassword?: string }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can add staff." });
  const db = await requireDb();
  const hasCredentials = Boolean(input.username || input.temporaryPassword);
  if (hasCredentials && (!input.username || !input.temporaryPassword)) throw new TRPCError({ code: "BAD_REQUEST", message: "Provide both an account name and a temporary password." });
  const username = input.username ? normalizeUsername(input.username) : null;
  const passwordError = input.temporaryPassword ? passwordPolicyError(input.temporaryPassword) : null;
  if (username && !/^[a-z0-9._-]{3,64}$/.test(username)) throw new TRPCError({ code: "BAD_REQUEST", message: "Account name must use 3–64 lower-case letters, numbers, dots, hyphens, or underscores." });
  if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
  const openId = `staff-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const created = await db.insert(users).values({ openId, name: input.name, email: input.email ?? null, loginMethod: "managed", role: input.role }).$returningId();
  const userId = created[0]!.id;
  await db.insert(staffProfiles).values({ userId, departmentId: input.departmentId, employeeCode: `EMP-${String(userId).padStart(4, "0")}`, title: input.title ?? null });
  if (username && input.temporaryPassword) {
    try {
      await db.insert(staffCredentials).values({ userId, username, passwordHash: await hashPassword(input.temporaryPassword), mustChangePassword: true });
    } catch (error) {
      await db.delete(staffProfiles).where(eq(staffProfiles.userId, userId));
      await db.delete(users).where(eq(users.id, userId));
      throw new TRPCError({ code: "CONFLICT", message: "That account name is already in use." });
    }
  }
  await writeAudit(user.id, "staff_added", "user", userId, { departmentId: input.departmentId, role: input.role, username });
  return { id: userId, username };
}

export async function resetStaffPassword(user: User, input: { userId: number; temporaryPassword: string }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can reset staff passwords." });
  const passwordError = passwordPolicyError(input.temporaryPassword);
  if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
  const db = await requireDb();
  const credential = (await db.select().from(staffCredentials).where(eq(staffCredentials.userId, input.userId)).limit(1))[0];
  if (!credential) throw new TRPCError({ code: "NOT_FOUND", message: "This staff member does not have a local account." });
  await db.update(staffCredentials).set({ passwordHash: await hashPassword(input.temporaryPassword), mustChangePassword: true, passwordChangedAt: new Date() }).where(eq(staffCredentials.userId, input.userId));
  await writeAudit(user.id, "staff_password_reset", "user", input.userId, {});
  return { success: true };
}

export async function authenticateStaffAccount(input: { username: string; password: string }) {
  const db = await requireDb();
  const username = normalizeUsername(input.username);
  const row = (await db.select({ user: users, profile: staffProfiles, credential: staffCredentials }).from(staffCredentials).innerJoin(users, eq(staffCredentials.userId, users.id)).leftJoin(staffProfiles, eq(users.id, staffProfiles.userId)).where(eq(staffCredentials.username, username)).limit(1))[0];
  const invalid = () => { throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid account name or password." }); };
  if (!row || !row.profile?.active || !(await verifyPassword(input.password, row.credential.passwordHash))) invalid();
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, row.user.id));
  return { user: row.user, mustChangePassword: row.credential.mustChangePassword };
}

export async function changeStaffPassword(user: User, input: { currentPassword: string; newPassword: string }) {
  const passwordError = passwordPolicyError(input.newPassword);
  if (passwordError) throw new TRPCError({ code: "BAD_REQUEST", message: passwordError });
  const db = await requireDb();
  const credential = (await db.select().from(staffCredentials).where(eq(staffCredentials.userId, user.id)).limit(1))[0];
  if (!credential || !(await verifyPassword(input.currentPassword, credential.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });
  await db.update(staffCredentials).set({ passwordHash: await hashPassword(input.newPassword), mustChangePassword: false, passwordChangedAt: new Date() }).where(eq(staffCredentials.userId, user.id));
  await writeAudit(user.id, "staff_password_changed", "user", user.id, {});
  return { success: true };
}

export async function passwordChangeRequired(userId: number) {
  const db = await requireDb();
  const credential = (await db.select({ mustChangePassword: staffCredentials.mustChangePassword }).from(staffCredentials).where(eq(staffCredentials.userId, userId)).limit(1))[0];
  return credential?.mustChangePassword ?? false;
}

export async function setDepartmentActive(user: User, input: { departmentId: number; active: boolean }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can activate or deactivate departments." });
  const db = await requireDb();
  await db.update(departments).set({ active: input.active }).where(eq(departments.id, input.departmentId));
  await writeAudit(user.id, input.active ? "department_activated" : "department_deactivated", "department", input.departmentId, input);
  return { success: true };
}

export async function updateDepartment(user: User, input: { departmentId: number; name: string; code: string; description?: string }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can edit departments." });
  const db = await requireDb();
  await db.update(departments).set({ name: input.name, code: input.code.toUpperCase(), description: input.description ?? null }).where(eq(departments.id, input.departmentId));
  await writeAudit(user.id, "department_updated", "department", input.departmentId, input);
  return { success: true };
}

export async function setStaffActive(user: User, input: { userId: number; active: boolean }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can activate or deactivate staff." });
  const db = await requireDb();
  await db.update(staffProfiles).set({ active: input.active }).where(eq(staffProfiles.userId, input.userId));
  await writeAudit(user.id, input.active ? "staff_activated" : "staff_deactivated", "user", input.userId, input);
  return { success: true };
}

export async function updateStaff(user: User, input: { userId: number; name: string; email?: string; departmentId: number; role: "hospital_admin" | "department_head" | "supervisor" | "staff" | "viewer"; title?: string }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can edit staff." });
  const db = await requireDb();
  await db.update(users).set({ name: input.name, email: input.email ?? null, role: input.role }).where(eq(users.id, input.userId));
  await db.update(staffProfiles).set({ departmentId: input.departmentId, title: input.title ?? null }).where(eq(staffProfiles.userId, input.userId));
  await writeAudit(user.id, "staff_updated", "user", input.userId, input);
  return { success: true };
}

export async function createInventoryItem(user: User, input: { name: string; category: string; departmentId: number; quantity: number; reorderLevel: number; unit: string }) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db.insert(inventory).values({ ...input, responsibleUserId: user.id }).$returningId();
  await writeAudit(user.id, "inventory_item_created", "inventory", created[0]!.id, input);
  return { id: created[0]!.id };
}

export async function assignIssue(user: User, input: { issueId: number; assignedTo: number; dueAt?: Date }) {
  ensureManager(user);
  const db = await requireDb();
  const issue = (await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1))[0];
  if (!issue) throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  await db.update(issues).set({ assignedTo: input.assignedTo, dueAt: input.dueAt ?? issue.dueAt, status: "assigned" }).where(eq(issues.id, input.issueId));
  await db.insert(notifications).values({ userId: input.assignedTo, departmentId: issue.departmentId, type: "issue_assignment", title: "Issue assigned to you", body: `${issue.code}: ${issue.title}`, entityType: "issue", entityId: issue.id });
  await writeAudit(user.id, "issue_assigned", "issue", input.issueId, { assignedTo: input.assignedTo, dueAt: input.dueAt?.toISOString() ?? issue.dueAt?.toISOString() });
  return { success: true };
}

export async function createExpiryItem(user: User, input: { name: string; category: string; departmentId: number; batchNumber?: string; quantity: number; expiryDate: Date; storageLocation?: string }) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db.insert(expiryItems).values({ ...input, batchNumber: input.batchNumber ?? null, storageLocation: input.storageLocation ?? null, responsibleUserId: user.id }).$returningId();
  await writeAudit(user.id, "expiry_item_created", "expiry_item", created[0]!.id, { name: input.name, expiryDate: input.expiryDate.toISOString() });
  return { id: created[0]!.id };
}

export async function createEquipmentMaintenance(user: User, input: { equipmentId: number; maintenanceType: string; scheduledAt: Date; vendor?: string; notes?: string }) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db.insert(equipmentMaintenance).values({ equipmentId: input.equipmentId, maintenanceType: input.maintenanceType, scheduledAt: input.scheduledAt, vendor: input.vendor ?? null, notes: input.notes ?? null }).$returningId();
  await db.update(equipment).set({ status: "under_maintenance", nextServiceAt: input.scheduledAt }).where(eq(equipment.id, input.equipmentId));
  await writeAudit(user.id, "maintenance_scheduled", "equipment_maintenance", created[0]!.id, { equipmentId: input.equipmentId, scheduledAt: input.scheduledAt.toISOString() });
  return { id: created[0]!.id };
}

export async function updateDutyAttendance(user: User, input: { rosterId: number; attendance: "present" | "absent" | "late" | "leave" | "replacement"; replacementUserId?: number; notes?: string }) {
  ensureManager(user);
  const db = await requireDb();
  const roster = (await db.select().from(dutyRosters).where(eq(dutyRosters.id, input.rosterId)).limit(1))[0];
  if (!roster) throw new TRPCError({ code: "NOT_FOUND", message: "Duty roster entry not found." });
  await db.update(dutyRosters).set({ attendance: input.attendance, replacementUserId: input.replacementUserId ?? null, notes: input.notes ?? null }).where(eq(dutyRosters.id, input.rosterId));
  if (["absent", "leave"].includes(input.attendance)) await db.insert(notifications).values({ departmentId: roster.departmentId, type: "replacement_required", title: "Replacement required", body: "A scheduled duty has an attendance exception and needs coverage.", entityType: "duty_roster", entityId: roster.id });
  await writeAudit(user.id, "duty_attendance_updated", "duty_roster", input.rosterId, { attendance: input.attendance, replacementUserId: input.replacementUserId ?? null });
  return { success: true };
}

export async function getCalendar(user: User) {
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const [assignmentRows, maintenanceRows, expiryRows, rosterRows] = await Promise.all([
    db.select({ id: taskAssignments.id, title: tasks.name, date: taskAssignments.dueAt, type: tasks.category, status: taskAssignments.status, departmentName: departments.name }).from(taskAssignments).innerJoin(tasks, eq(taskAssignments.taskId, tasks.id)).innerJoin(departments, eq(taskAssignments.departmentId, departments.id)).orderBy(asc(taskAssignments.dueAt)),
    db.select({ id: equipmentMaintenance.id, title: equipment.name, date: equipmentMaintenance.scheduledAt, type: equipmentMaintenance.maintenanceType, status: equipmentMaintenance.status, departmentName: departments.name }).from(equipmentMaintenance).innerJoin(equipment, eq(equipmentMaintenance.equipmentId, equipment.id)).innerJoin(departments, eq(equipment.departmentId, departments.id)).orderBy(asc(equipmentMaintenance.scheduledAt)),
    db.select({ id: expiryItems.id, title: expiryItems.name, date: expiryItems.expiryDate, type: expiryItems.category, departmentName: departments.name }).from(expiryItems).innerJoin(departments, eq(expiryItems.departmentId, departments.id)).orderBy(asc(expiryItems.expiryDate)),
    db.select({ id: dutyRosters.id, title: users.name, date: dutyRosters.dutyDate, type: dutyRosters.shift, status: dutyRosters.attendance, departmentName: departments.name }).from(dutyRosters).innerJoin(users, eq(dutyRosters.userId, users.id)).innerJoin(departments, eq(dutyRosters.departmentId, departments.id)).orderBy(asc(dutyRosters.dutyDate)),
  ]);
  return { tasks: assignmentRows, maintenance: maintenanceRows, expiry: expiryRows, duties: rosterRows };
}

export async function getSettings(user: User) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can access hospital-wide settings." });
  const db = await requireDb();
  await ensureNotificationRuleDefaults();
  const [rules, notificationRuleRows, departmentRows, people] = await Promise.all([
    db.select().from(escalationRules).orderBy(asc(escalationRules.name)),
    db.select().from(notificationRules).orderBy(asc(notificationRules.label)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select({ user: users, profile: staffProfiles, credential: { username: staffCredentials.username, mustChangePassword: staffCredentials.mustChangePassword } }).from(users).leftJoin(staffProfiles, eq(users.id, staffProfiles.userId)).leftJoin(staffCredentials, eq(users.id, staffCredentials.userId)).orderBy(asc(users.name)),
  ]);
  return { rules, notificationRules: notificationRuleRows, departments: departmentRows, staff: people };
}

export async function updateEscalationRule(user: User, input: { ruleId: number; firstReminderMinutes: number; departmentHeadMinutes: number; adminMinutes: number; active: boolean }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can update escalation rules." });
  const db = await requireDb();
  await db.update(escalationRules).set(input).where(eq(escalationRules.id, input.ruleId));
  await writeAudit(user.id, "escalation_rule_updated", "escalation_rule", input.ruleId, input);
  return { success: true };
}

export async function updateNotificationRule(user: User, input: { ruleId: number; inAppEnabled: boolean; emailEnabled: boolean; leadMinutes: number; active: boolean }) {
  if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only hospital administrators can update notification rules." });
  const db = await requireDb();
  await db.update(notificationRules).set(input).where(eq(notificationRules.id, input.ruleId));
  await writeAudit(user.id, "notification_rule_updated", "notification_rule", input.ruleId, input);
  return { success: true };
}

export async function runOperationalCycle() {
  const db = await requireDb();
  const now = new Date();
  const today = dateKey(now);
  const activeRules = await db.select().from(escalationRules).where(eq(escalationRules.active, true));
  const escalationStage = (overdueAt: Date, rule: { firstReminderMinutes: number; departmentHeadMinutes: number; adminMinutes: number }) => {
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - overdueAt.getTime()) / 60_000));
    if (elapsedMinutes >= rule.adminMinutes) return "admin";
    if (elapsedMinutes >= rule.departmentHeadMinutes) return "department_head";
    if (elapsedMinutes >= rule.firstReminderMinutes) return "staff";
    return null;
  };
  const recurring = await db.select({ recurring: recurringTasks, task: tasks }).from(recurringTasks).innerJoin(tasks, eq(recurringTasks.taskId, tasks.id)).where(and(eq(recurringTasks.active, true), eq(tasks.active, true)));
  let generatedAssignments = 0;
  for (const row of recurring) {
    if (row.recurring.lastGeneratedFor === today) continue;
    const [hour, minute] = row.task.dueTime.split(":").map(Number);
    const dueAt = new Date(now);
    dueAt.setHours(hour ?? 0, minute ?? 0, 0, 0);
    await db.insert(taskAssignments).values({ taskId: row.task.id, departmentId: row.task.departmentId, assignedUserId: row.task.assignedUserId, dueAt });
    await db.update(recurringTasks).set({ lastGeneratedFor: today, nextRunAt: computeNextDueDate(row.task.frequency, dueAt) }).where(eq(recurringTasks.id, row.recurring.id));
    generatedAssignments += 1;
  }
  const overdueCandidates = await db.select().from(taskAssignments).where(and(lt(taskAssignments.dueAt, now), inArray(taskAssignments.status, ["not_started", "in_progress", "reopened"])));
  for (const assignment of overdueCandidates) {
    await db.update(taskAssignments).set({ status: "overdue" }).where(eq(taskAssignments.id, assignment.id));
    const rule = activeRules.find(item => item.appliesTo === "task") ?? activeRules[0];
    const stage = rule ? escalationStage(assignment.dueAt, rule) : "staff";
    if (stage) {
      await db.insert(notifications).values({ userId: assignment.assignedUserId, departmentId: assignment.departmentId, type: "overdue_task", title: `Task overdue — ${stage.replaceAll("_", " ")} escalation`, body: "An operational task has passed its deadline and reached the configured escalation stage.", entityType: "task_assignment", entityId: assignment.id });
      await writeAudit(null, `task_escalated_${stage}`, "task_assignment", assignment.id, { ruleId: rule?.id ?? null, dueAt: assignment.dueAt.toISOString() });
    }
  }
  const overdueIssues = await db.select().from(issues).where(and(lt(issues.dueAt, now), inArray(issues.status, ["open", "assigned", "in_progress"])));
  for (const issue of overdueIssues) {
    const rule = activeRules.find(item => item.appliesTo === "issue" && (!item.priority || item.priority === issue.priority)) ?? activeRules.find(item => item.appliesTo === "issue") ?? activeRules[0];
    const stage = rule ? escalationStage(issue.dueAt!, rule) : "staff";
    if (stage) {
      await db.update(issues).set({ status: "escalated" }).where(eq(issues.id, issue.id));
      await db.insert(notifications).values({ userId: issue.assignedTo, departmentId: issue.departmentId, type: "issue_escalated", title: `Issue escalated — ${stage.replaceAll("_", " ")}`, body: `${issue.code}: ${issue.title} exceeded its due date and reached the configured escalation stage.`, entityType: "issue", entityId: issue.id });
      await writeAudit(null, `issue_escalated_${stage}`, "issue", issue.id, { ruleId: rule?.id ?? null, dueAt: issue.dueAt?.toISOString() });
    }
  }
  return { generatedAssignments, markedOverdue: overdueCandidates.length, escalatedIssues: overdueIssues.length, processedAt: now.toISOString() };
}
