import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  notInArray,
  sql,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  auditLogs,
  departmentPointEvents,
  departmentStaffingTargets,
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
  operationalIndicatorRules,
  recurringTasks,
  risks,
  shiftHandovers,
  staffProfiles,
  taskAssignments,
  taskChecklistResults,
  taskChecklists,
  taskCompletions,
  taskLifecycleEvents,
  taskScoringRules,
  tasks,
  users,
  managementActions,
  whatsappTaskDispatches,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  computeNextDueDate,
  expiryHealth,
  findingCreatesIssue,
  initialTaskDueDate,
  isMyDayAssignmentVisible,
  operationalAssignmentStatus,
  priorityForFinding,
  taskCompletionBlockReason,
  type FindingStatus,
} from "./operationsLogic";

const adminRoles = ["super_admin", "hospital_admin"] as const;
const managerRoles = [
  "super_admin",
  "hospital_admin",
  "department_head",
  "supervisor",
] as const;

const dateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const pointsFromTenths = (value: number) => value / 10;
const atTime = (hour: number, minute = 0, offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
};

async function requireDb() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Operational database is unavailable.",
    });
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
    {
      eventType: "maintenance_due",
      label: "Equipment maintenance due",
      leadMinutes: 1440,
    },
    {
      eventType: "expiry_alert",
      label: "Item expiring soon",
      leadMinutes: 43200,
    },
    {
      eventType: "replacement_required",
      label: "Replacement required",
      leadMinutes: 0,
    },
  ]);
}

async function ensureVersion2Defaults() {
  const db = await requireDb();
  const [scoringCount, indicatorCount] = await Promise.all([
    db.select({ value: count() }).from(taskScoringRules),
    db.select({ value: count() }).from(operationalIndicatorRules),
  ]);
  if ((scoringCount[0]?.value ?? 0) === 0) {
    await db.insert(taskScoringRules).values([
      { priority: "critical", weightTenths: 50 },
      { priority: "high", weightTenths: 30 },
      { priority: "medium", weightTenths: 10 },
      { priority: "low", weightTenths: 5 },
    ]);
  }
  if ((indicatorCount[0]?.value ?? 0) === 0) {
    await db.insert(operationalIndicatorRules).values([
      {
        code: "overdue_tasks",
        label: "Overdue tasks",
        warningThreshold: 1,
        criticalThreshold: 3,
      },
      {
        code: "critical_issues",
        label: "Critical issues",
        warningThreshold: 1,
        criticalThreshold: 3,
      },
      {
        code: "equipment_out",
        label: "Equipment out of service",
        warningThreshold: 1,
        criticalThreshold: 2,
      },
      {
        code: "stock_outs",
        label: "Inventory stock-outs",
        warningThreshold: 1,
        criticalThreshold: 2,
      },
      {
        code: "staffing_shortfalls",
        label: "Staffing shortages",
        warningThreshold: 1,
        criticalThreshold: 2,
      },
      {
        code: "overdue_actions",
        label: "Overdue management actions",
        warningThreshold: 1,
        criticalThreshold: 2,
      },
    ]);
  }
}

async function writeTaskLifecycleEvent(
  userId: number,
  assignmentId: number,
  eventType: string,
  options: {
    dispatchId?: number | null;
    note?: string | null;
    metadata?: unknown;
  } = {}
) {
  const db = await requireDb();
  await db.insert(taskLifecycleEvents).values({
    assignmentId,
    dispatchId: options.dispatchId ?? null,
    eventType,
    note: options.note ?? null,
    metadata: options.metadata ?? null,
    recordedByUserId: userId,
  });
}

export function isManager(user: User) {
  return managerRoles.includes(user.role as (typeof managerRoles)[number]);
}

export function isAdmin(user: User) {
  return adminRoles.includes(user.role as (typeof adminRoles)[number]);
}

export async function getTaskScoringRules(user: User) {
  ensureManager(user);
  await ensureVersion2Defaults();
  const db = await requireDb();
  return db
    .select()
    .from(taskScoringRules)
    .orderBy(asc(taskScoringRules.weightTenths));
}

export async function updateTaskScoringRule(
  user: User,
  input: { ruleId: number; weightTenths: number }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only hospital administrators can update task-scoring rules.",
    });
  await ensureVersion2Defaults();
  const db = await requireDb();
  const rule = (
    await db
      .select()
      .from(taskScoringRules)
      .where(eq(taskScoringRules.id, input.ruleId))
      .limit(1)
  )[0];
  if (!rule)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Scoring rule not found.",
    });
  await db
    .update(taskScoringRules)
    .set({ weightTenths: input.weightTenths })
    .where(eq(taskScoringRules.id, input.ruleId));
  await writeAudit(
    user.id,
    "task_scoring_rule_updated",
    "task_scoring_rule",
    input.ruleId,
    { priority: rule.priority, weightTenths: input.weightTenths }
  );
  return { success: true };
}

export function ensureManager(user: User) {
  if (!isManager(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This action requires supervisor or administrator access.",
    });
}

export function ensureSuperAdmin(user: User) {
  if (user.role !== "super_admin")
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only the super administrator can create or manage department task schedules.",
    });
}

export async function writeAudit(
  actorUserId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  newValue?: Record<string, unknown>
) {
  const db = await requireDb();
  await db.insert(auditLogs).values({
    actorUserId,
    action,
    entityType,
    entityId,
    newValue: newValue ?? null,
  });
}

export async function ensureOperationalDemo(actor: User) {
  const db = await requireDb();
  await ensureNotificationRuleDefaults();
  const existing = await db.select({ value: count() }).from(departments);
  if ((existing[0]?.value ?? 0) > 0) return;

  const demoPeople = [
    {
      openId: "demo-radiology-head",
      name: "Dr. Maya Shah",
      email: "maya.shah@hospital.demo",
      role: "department_head" as const,
    },
    {
      openId: "demo-pharmacy-lead",
      name: "Nina Patel",
      email: "nina.patel@hospital.demo",
      role: "department_head" as const,
    },
    {
      openId: "demo-emergency-lead",
      name: "Dr. Daniel Wong",
      email: "daniel.wong@hospital.demo",
      role: "department_head" as const,
    },
    {
      openId: "demo-technician",
      name: "Alex Morgan",
      email: "alex.morgan@hospital.demo",
      role: "staff" as const,
    },
    {
      openId: "demo-nurse",
      name: "Priya Nair",
      email: "priya.nair@hospital.demo",
      role: "staff" as const,
    },
    {
      openId: "demo-maintenance",
      name: "Jordan Lee",
      email: "jordan.lee@hospital.demo",
      role: "supervisor" as const,
    },
  ];
  for (const person of demoPeople) {
    await db
      .insert(users)
      .values({ ...person, loginMethod: "demo" })
      .onDuplicateKeyUpdate({ set: { name: person.name, role: person.role } });
  }
  const people = await db
    .select()
    .from(users)
    .where(
      inArray(
        users.openId,
        demoPeople.map(person => person.openId)
      )
    );
  const personId = Object.fromEntries(
    people.map(person => [person.openId, person.id])
  );

  const depRows = [
    {
      name: "Radiology",
      code: "RAD",
      description:
        "Imaging operations, radiation safety, and diagnostic equipment.",
    },
    {
      name: "Pharmacy",
      code: "PHA",
      description:
        "Medication availability, storage, and controlled expiry monitoring.",
    },
    {
      name: "Emergency",
      code: "ED",
      description:
        "Shift-critical readiness, resuscitation equipment, and patient-flow operations.",
    },
    {
      name: "Nursing",
      code: "NUR",
      description: "Ward nursing operations and bedside support readiness.",
    },
    {
      name: "Housekeeping",
      code: "HSK",
      description:
        "Environmental hygiene, waste management, and cleaning inspections.",
    },
    {
      name: "Maintenance",
      code: "MNT",
      description:
        "Utilities, medical equipment service, and infrastructure maintenance.",
    },
  ];
  const insertedDepartments = await db
    .insert(departments)
    .values(depRows)
    .$returningId();
  const departmentId = Object.fromEntries(
    depRows.map((row, index) => [row.code, insertedDepartments[index]!.id])
  );
  await db
    .update(departments)
    .set({ headUserId: personId["demo-radiology-head"] })
    .where(eq(departments.id, departmentId.RAD));
  await db
    .update(departments)
    .set({ headUserId: personId["demo-pharmacy-lead"] })
    .where(eq(departments.id, departmentId.PHA));
  await db
    .update(departments)
    .set({ headUserId: personId["demo-emergency-lead"] })
    .where(eq(departments.id, departmentId.ED));
  await db
    .update(departments)
    .set({ headUserId: personId["demo-maintenance"] })
    .where(eq(departments.id, departmentId.MNT));

  const locationRows = [
    {
      name: "Imaging Suite A",
      building: "Main Building",
      floor: "Ground",
      departmentId: departmentId.RAD,
    },
    {
      name: "Pharmacy Cold Store",
      building: "Main Building",
      floor: "Ground",
      departmentId: departmentId.PHA,
    },
    {
      name: "Resuscitation Bay",
      building: "Emergency Block",
      floor: "Ground",
      departmentId: departmentId.ED,
    },
    {
      name: "Plant Room",
      building: "Service Block",
      floor: "Basement",
      departmentId: departmentId.MNT,
    },
  ];
  const insertedLocations = await db
    .insert(locations)
    .values(locationRows)
    .$returningId();
  const locationId = {
    imaging: insertedLocations[0]!.id,
    pharmacy: insertedLocations[1]!.id,
    emergency: insertedLocations[2]!.id,
    plant: insertedLocations[3]!.id,
  };

  const profiles = [
    {
      userId: actor.id,
      departmentId: departmentId.RAD,
      employeeCode: "OPS-001",
      title: "Operations Administrator",
    },
    {
      userId: personId["demo-radiology-head"],
      departmentId: departmentId.RAD,
      employeeCode: "RAD-101",
      title: "Radiologist & Department Head",
    },
    {
      userId: personId["demo-pharmacy-lead"],
      departmentId: departmentId.PHA,
      employeeCode: "PHA-201",
      title: "Pharmacy Lead",
    },
    {
      userId: personId["demo-emergency-lead"],
      departmentId: departmentId.ED,
      employeeCode: "ED-301",
      title: "Emergency Department Head",
    },
    {
      userId: personId["demo-technician"],
      departmentId: departmentId.RAD,
      employeeCode: "RAD-112",
      title: "Imaging Technician",
    },
    {
      userId: personId["demo-nurse"],
      departmentId: departmentId.ED,
      employeeCode: "ED-322",
      title: "Senior Nurse",
    },
    {
      userId: personId["demo-maintenance"],
      departmentId: departmentId.MNT,
      employeeCode: "MNT-401",
      title: "Maintenance Supervisor",
    },
  ];
  await db
    .insert(staffProfiles)
    .values(profiles)
    .onDuplicateKeyUpdate({ set: { active: true } });

  const taskRows = [
    {
      name: "X-ray machine operational check",
      departmentId: departmentId.RAD,
      assignedUserId: personId["demo-technician"],
      frequency: "daily" as const,
      dueTime: "09:00",
      priority: "high" as const,
      category: "Equipment",
      instructions:
        "Verify system readiness and record all safety findings before first imaging session.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: false,
      createdBy: actor.id,
    },
    {
      name: "Lead apron and radiation safety check",
      departmentId: departmentId.RAD,
      assignedUserId: personId["demo-technician"],
      frequency: "daily" as const,
      dueTime: "09:15",
      priority: "high" as const,
      category: "Safety",
      instructions:
        "Confirm protective equipment availability, condition, and correct location.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: false,
      createdBy: actor.id,
    },
    {
      name: "Essential medicine availability",
      departmentId: departmentId.PHA,
      assignedUserId: personId["demo-pharmacy-lead"],
      frequency: "daily" as const,
      dueTime: "09:30",
      priority: "critical" as const,
      category: "Inventory",
      instructions:
        "Review critical medication stock and near-expiry items for the emergency formulary.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: true,
      createdBy: actor.id,
    },
    {
      name: "Emergency trolley check",
      departmentId: departmentId.ED,
      assignedUserId: personId["demo-nurse"],
      frequency: "every_shift" as const,
      dueTime: "10:00",
      priority: "critical" as const,
      category: "Emergency readiness",
      instructions:
        "Inspect trolley, defibrillator, oxygen, suction, emergency medicines, and monitoring equipment.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: true,
      createdBy: actor.id,
    },
    {
      name: "Generator and medical gas system check",
      departmentId: departmentId.MNT,
      assignedUserId: personId["demo-maintenance"],
      frequency: "daily" as const,
      dueTime: "08:30",
      priority: "critical" as const,
      category: "Infrastructure",
      instructions:
        "Confirm generator transfer readiness and medical gas pressure indicators.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: false,
      createdBy: actor.id,
    },
    {
      name: "Emergency cleaning and waste inspection",
      departmentId: departmentId.HSK,
      assignedUserId: actor.id,
      frequency: "daily" as const,
      dueTime: "11:00",
      priority: "medium" as const,
      category: "Housekeeping",
      instructions:
        "Inspect environmental hygiene, sharps handling, and cleaning supplies.",
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: false,
      createdBy: actor.id,
    },
  ];
  const insertedTasks = await db.insert(tasks).values(taskRows).$returningId();
  const taskId = insertedTasks.map(row => row.id);
  const checklistLabels = [
    [
      "X-ray machine powers on normally",
      "Radiation warning sign visible",
      "Emergency equipment available",
    ],
    [
      "Lead apron available",
      "Lead apron undamaged",
      "Lead apron stored in Imaging Suite A",
    ],
    [
      "Emergency medicines above reorder level",
      "Refrigerator temperature in range",
      "Near-expiry medicines reviewed",
    ],
    [
      "Defibrillator charged",
      "Oxygen cylinder available",
      "Suction functioning",
      "Emergency medicines sealed",
    ],
    [
      "Generator fuel level acceptable",
      "Medical gas pressure normal",
      "Backup power alarm tested",
    ],
    [
      "Emergency bay cleaned",
      "Waste segregated",
      "Cleaning supplies available",
    ],
  ];
  await db.insert(taskChecklists).values(
    checklistLabels.flatMap((labels, taskIndex) =>
      labels.map((label, position) => ({
        taskId: taskId[taskIndex]!,
        label,
        position,
        required: true,
        expectedLocation:
          taskIndex === 1 && position === 2 ? "Imaging Suite A" : null,
      }))
    )
  );

  await db.insert(taskAssignments).values([
    {
      taskId: taskId[0]!,
      departmentId: departmentId.RAD,
      assignedUserId: personId["demo-technician"],
      dueAt: atTime(9, 0),
      status: "completed",
      completedAt: atTime(8, 52),
    },
    {
      taskId: taskId[1]!,
      departmentId: departmentId.RAD,
      assignedUserId: personId["demo-technician"],
      dueAt: atTime(9, 15),
      status: "in_progress",
    },
    {
      taskId: taskId[2]!,
      departmentId: departmentId.PHA,
      assignedUserId: personId["demo-pharmacy-lead"],
      dueAt: atTime(9, 30),
      status: "pending_approval",
      completedAt: atTime(9, 12),
    },
    {
      taskId: taskId[3]!,
      departmentId: departmentId.ED,
      assignedUserId: personId["demo-nurse"],
      dueAt: atTime(10, 0),
      status: "not_started",
    },
    {
      taskId: taskId[4]!,
      departmentId: departmentId.MNT,
      assignedUserId: personId["demo-maintenance"],
      dueAt: atTime(8, 30),
      status: "not_started",
    },
    {
      taskId: taskId[5]!,
      departmentId: departmentId.HSK,
      assignedUserId: actor.id,
      dueAt: atTime(11, 0),
      status: "not_started",
    },
  ]);
  for (const id of taskId)
    await db
      .insert(recurringTasks)
      .values({ taskId: id, nextRunAt: computeNextDueDate("daily") });

  const equipmentRows = [
    {
      name: "Digital X-ray System",
      equipmentCode: "EQ-RAD-001",
      departmentId: departmentId.RAD,
      locationId: locationId.imaging,
      manufacturer: "Mediview",
      model: "DX-400",
      serialNumber: "DX4-2026-118",
      nextServiceAt: atTime(0, 0, 18),
      nextCalibrationAt: atTime(0, 0, 35),
      responsibleUserId: personId["demo-technician"],
      maintenanceCompany: "Clinical Engineering Services",
      status: "working" as const,
    },
    {
      name: "Emergency Defibrillator",
      equipmentCode: "EQ-ED-014",
      departmentId: departmentId.ED,
      locationId: locationId.emergency,
      manufacturer: "Lifeline",
      model: "Rescue Pro",
      serialNumber: "RP-8841",
      nextServiceAt: atTime(0, 0, 4),
      nextCalibrationAt: atTime(0, 0, 95),
      responsibleUserId: personId["demo-nurse"],
      maintenanceCompany: "Clinical Engineering Services",
      status: "under_maintenance" as const,
    },
    {
      name: "Backup Generator",
      equipmentCode: "EQ-MNT-002",
      departmentId: departmentId.MNT,
      locationId: locationId.plant,
      manufacturer: "PowerSafe",
      model: "PS-80",
      serialNumber: "PS80-540",
      nextServiceAt: atTime(0, 0, -1),
      responsibleUserId: personId["demo-maintenance"],
      maintenanceCompany: "PowerSafe Support",
      status: "working" as const,
    },
  ];
  const insertedEquipment = await db
    .insert(equipment)
    .values(equipmentRows)
    .$returningId();
  await db.insert(equipmentMaintenance).values([
    {
      equipmentId: insertedEquipment[1]!.id,
      maintenanceType: "Preventive service",
      scheduledAt: atTime(0, 0, 4),
      vendor: "Clinical Engineering Services",
      status: "scheduled",
    },
    {
      equipmentId: insertedEquipment[2]!.id,
      maintenanceType: "Quarterly inspection",
      scheduledAt: atTime(0, 0, -1),
      vendor: "PowerSafe Support",
      status: "overdue",
    },
  ]);

  const inventoryRows = [
    {
      name: "Lead aprons",
      category: "Radiology protection",
      departmentId: departmentId.RAD,
      locationId: locationId.imaging,
      quantity: 4,
      reorderLevel: 5,
      unit: "items",
      responsibleUserId: personId["demo-technician"],
    },
    {
      name: "Emergency medicines",
      category: "Critical medicines",
      departmentId: departmentId.PHA,
      locationId: locationId.pharmacy,
      quantity: 55,
      reorderLevel: 40,
      unit: "ampoules",
      responsibleUserId: personId["demo-pharmacy-lead"],
    },
    {
      name: "Oxygen cylinders",
      category: "Medical gas",
      departmentId: departmentId.ED,
      locationId: locationId.emergency,
      quantity: 2,
      reorderLevel: 3,
      unit: "cylinders",
      responsibleUserId: personId["demo-nurse"],
    },
  ];
  const insertedInventory = await db
    .insert(inventory)
    .values(inventoryRows)
    .$returningId();
  await db.insert(expiryItems).values([
    {
      inventoryId: insertedInventory[1]!.id,
      name: "Adrenaline 1mg/mL",
      category: "Emergency medicines",
      departmentId: departmentId.PHA,
      batchNumber: "AD-26-092",
      quantity: 18,
      expiryDate: new Date(dateKey(atTime(0, 0, 17))),
      storageLocation: "Pharmacy Cold Store",
      responsibleUserId: personId["demo-pharmacy-lead"],
    },
    {
      inventoryId: insertedInventory[1]!.id,
      name: "Contrast media",
      category: "Radiology consumables",
      departmentId: departmentId.RAD,
      batchNumber: "CM-26-011",
      quantity: 8,
      expiryDate: new Date(dateKey(atTime(0, 0, 46))),
      storageLocation: "Imaging Suite A",
      responsibleUserId: personId["demo-technician"],
    },
    {
      name: "Generator service certificate",
      category: "Certificate",
      departmentId: departmentId.MNT,
      batchNumber: "GEN-CERT-2026",
      quantity: 1,
      expiryDate: new Date(dateKey(atTime(0, 0, -2))),
      storageLocation: "Plant Room",
      responsibleUserId: personId["demo-maintenance"],
    },
  ]);

  const issueRows = [
    {
      code: "ISS-1042",
      title: "Lead apron seam damaged",
      description:
        "A damaged lead apron was found during the daily radiology safety check.",
      departmentId: departmentId.RAD,
      category: "Equipment",
      priority: "high" as const,
      status: "open" as const,
      sourceType: "checklist",
      reportedBy: personId["demo-technician"],
      assignedTo: personId["demo-maintenance"],
      dueAt: atTime(14, 0),
    },
    {
      code: "ISS-1043",
      title: "Defibrillator preventive service due",
      description:
        "Preventive maintenance is scheduled before the next emergency shift change.",
      departmentId: departmentId.ED,
      category: "Equipment",
      priority: "critical" as const,
      status: "in_progress" as const,
      sourceType: "maintenance",
      reportedBy: personId["demo-nurse"],
      assignedTo: personId["demo-maintenance"],
      dueAt: atTime(13, 0),
    },
    {
      code: "ISS-1044",
      title: "Generator inspection overdue",
      description: "Quarterly generator inspection has not been recorded.",
      departmentId: departmentId.MNT,
      category: "Maintenance",
      priority: "high" as const,
      status: "escalated" as const,
      sourceType: "maintenance",
      reportedBy: personId["demo-maintenance"],
      assignedTo: personId["demo-maintenance"],
      dueAt: atTime(8, 0),
    },
  ];
  const insertedIssues = await db
    .insert(issues)
    .values(issueRows)
    .$returningId();
  await db.insert(issueComments).values({
    issueId: insertedIssues[0]!.id,
    userId: personId["demo-radiology-head"],
    body: "Replacement apron requested from Stores; retain damaged item for safety inspection.",
  });
  await db.insert(dutyRosters).values([
    {
      departmentId: departmentId.ED,
      userId: personId["demo-emergency-lead"],
      dutyDate: new Date(dateKey()),
      shift: "Day",
      startTime: "08:00",
      endTime: "16:00",
      assignedDuty: "Emergency clinical lead",
      attendance: "present",
    },
    {
      departmentId: departmentId.ED,
      userId: personId["demo-nurse"],
      dutyDate: new Date(dateKey()),
      shift: "Day",
      startTime: "08:00",
      endTime: "16:00",
      assignedDuty: "Resuscitation bay nurse",
      attendance: "present",
    },
    {
      departmentId: departmentId.RAD,
      userId: personId["demo-technician"],
      dutyDate: new Date(dateKey()),
      shift: "Day",
      startTime: "08:00",
      endTime: "16:00",
      assignedDuty: "Imaging technician",
      attendance: "late",
      notes: "Arrived at 08:18; coverage confirmed.",
    },
  ]);
  await db.insert(shiftHandovers).values({
    departmentId: departmentId.ED,
    fromUserId: personId["demo-nurse"],
    shift: "Night to Day",
    handoverDate: new Date(dateKey()),
    pendingTasks: "Confirm oxygen cylinder replacement before 13:00.",
    equipmentProblems:
      "Defibrillator service ticket ISS-1043 remains in progress.",
    stockShortages: "Two oxygen cylinders on hand; replacement request open.",
    operationalNotes: "Maintain readiness checks until service team signs off.",
    unresolved: true,
  });
  await db.insert(escalationRules).values({
    name: "Critical operational task escalation",
    appliesTo: "task",
    priority: "critical",
    firstReminderMinutes: 15,
    departmentHeadMinutes: 60,
    adminMinutes: 180,
  });
  await db.insert(notifications).values([
    {
      departmentId: departmentId.RAD,
      type: "issue",
      title: "High-priority equipment issue",
      body: "Lead apron seam damaged. Issue ISS-1042 requires action today.",
      entityType: "issue",
      entityId: insertedIssues[0]!.id,
    },
    {
      departmentId: departmentId.ED,
      type: "maintenance",
      title: "Service due",
      body: "Emergency Defibrillator service is due within four days.",
      entityType: "equipment",
      entityId: insertedEquipment[1]!.id,
    },
    {
      userId: actor.id,
      type: "handover",
      title: "Unresolved ED handover",
      body: "Emergency Department has unresolved items awaiting day-shift follow-up.",
      entityType: "handover",
      entityId: 1,
    },
  ]);
  await writeAudit(
    actor.id,
    "seeded_operational_workspace",
    "workspace",
    null,
    {
      departments: depRows.length,
      tasks: taskRows.length,
      issues: issueRows.length,
    }
  );
}

export async function getDashboard(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  await ensureVersion2Defaults();
  const db = await requireDb();
  const [
    assignmentRows,
    issueRows,
    equipmentRows,
    inventoryRows,
    expiryRows,
    departmentRows,
    notificationRows,
    dispatchRows,
    pointRows,
    riskRows,
    managementActionRows,
    historicalHandoverRows,
    staffingTargetRows,
    rosterRows,
    indicatorRules,
  ] = await Promise.all([
    db
      .select({
        id: taskAssignments.id,
        status: taskAssignments.status,
        dueAt: taskAssignments.dueAt,
        taskName: tasks.name,
        priority: tasks.priority,
        frequency: tasks.frequency,
        departmentId: departments.id,
        departmentName: departments.name,
        assignedUserId: taskAssignments.assignedUserId,
        whatsappDispatchId: whatsappTaskDispatches.id,
        whatsappStatus: whatsappTaskDispatches.status,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
      .leftJoin(
        whatsappTaskDispatches,
        eq(whatsappTaskDispatches.assignmentId, taskAssignments.id)
      ),
    db.select().from(issues).orderBy(desc(issues.updatedAt)),
    db.select().from(equipment),
    db.select().from(inventory),
    db.select().from(expiryItems),
    db.select().from(departments).where(eq(departments.active, true)),
    db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(6),
    db.select().from(whatsappTaskDispatches),
    db.select().from(departmentPointEvents),
    db.select().from(risks),
    db.select().from(managementActions),
    db.select().from(shiftHandovers).where(eq(shiftHandovers.unresolved, true)),
    db
      .select()
      .from(departmentStaffingTargets)
      .where(eq(departmentStaffingTargets.active, true)),
    db
      .select()
      .from(dutyRosters)
      .where(eq(dutyRosters.dutyDate, new Date(dateKey()))),
    db
      .select()
      .from(operationalIndicatorRules)
      .where(eq(operationalIndicatorRules.active, true)),
  ]);
  void historicalHandoverRows;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const todayAssignmentRows = assignmentRows.filter(assignment => {
    const dueAt = new Date(assignment.dueAt);
    return dueAt >= todayStart && dueAt < tomorrowStart;
  });
  const activeAssignmentRows = assignmentRows.filter(assignment => {
    const dueAt = new Date(assignment.dueAt);
    const closedStatus = [
      "completed",
      "pending_approval",
      "skipped",
      "failed",
    ].includes(assignment.status);
    const dueToday =
      dueAt >= todayStart &&
      dueAt < tomorrowStart &&
      !["skipped", "failed"].includes(assignment.status);
    const unresolvedCarryOver = dueAt < todayStart && !closedStatus;
    return dueToday || unresolvedCarryOver;
  });
  const statusCounts = activeAssignmentRows.reduce<Record<string, number>>(
    (total, assignment) => {
      const status = operationalAssignmentStatus(
        assignment.status,
        assignment.dueAt,
        now
      );
      total[status] = (total[status] ?? 0) + 1;
      return total;
    },
    {}
  );
  const todayDispatches = dispatchRows.filter(
    row => new Date(row.createdAt).toDateString() === now.toDateString()
  );
  const staffingShortfalls = staffingTargetRows
    .map(target => {
      const present = rosterRows.filter(
        row =>
          row.departmentId === target.departmentId &&
          row.shift === target.shift &&
          ["present", "late", "replacement"].includes(row.attendance)
      ).length;
      const shortfall = Math.max(0, target.requiredStaff - present);
      const coveragePercent = target.requiredStaff
        ? Math.round((present / target.requiredStaff) * 100)
        : 100;
      const severity =
        coveragePercent <= target.criticalCoveragePercent
          ? "critical"
          : coveragePercent < target.warningCoveragePercent
            ? "high"
            : "normal";
      return { ...target, present, shortfall, coveragePercent, severity };
    })
    .filter(target => target.shortfall > 0);
  const equipmentOutOfService = equipmentRows.filter(
    row => row.status === "out_of_service"
  );
  const maintenanceOverdue = equipmentRows.filter(
    row => row.nextServiceAt && new Date(row.nextServiceAt) < now
  );
  const stockOuts = inventoryRows.filter(item => item.quantity === 0);
  const lowStockItems = inventoryRows.filter(
    item =>
      item.quantity > 0 &&
      item.quantity <= Math.max(item.reorderLevel, item.minimumStock ?? 0)
  );
  const overdueManagementActions = managementActionRows.filter(
    action =>
      !["completed", "cancelled"].includes(action.status) &&
      action.dueAt &&
      new Date(action.dueAt) < now
  );
  const openRisks = riskRows.filter(
    risk => !["resolved", "closed"].includes(risk.status)
  );
  const indicatorValues: Record<string, number> = {
    overdue_tasks: statusCounts.overdue ?? 0,
    critical_issues: issueRows.filter(
      issue =>
        issue.priority === "critical" &&
        !["resolved", "closed"].includes(issue.status)
    ).length,
    equipment_out: equipmentOutOfService.length,
    stock_outs: stockOuts.length,
    staffing_shortfalls: staffingShortfalls.length,
    overdue_actions: overdueManagementActions.length,
  };
  const indicatorStates = indicatorRules.map(rule => {
    const value = indicatorValues[rule.code] ?? 0;
    return {
      ...rule,
      value,
      state:
        value >= rule.criticalThreshold
          ? "critical"
          : value >= rule.warningThreshold
            ? "attention"
            : "normal",
    };
  });
  const operationalStatus = indicatorStates.some(
    rule => rule.state === "critical"
  )
    ? "critical"
    : indicatorStates.some(rule => rule.state === "attention")
      ? "attention_required"
      : "normal";
  const attentionItems = [
    ...issueRows
      .filter(
        issue =>
          !["resolved", "closed"].includes(issue.status) &&
          ["critical", "high"].includes(issue.priority)
      )
      .map(issue => ({
        key: `issue-${issue.id}`,
        severity: issue.priority,
        title: issue.title,
        departmentId: issue.departmentId,
        owner: issue.assignedTo ? "Assigned manager" : "Unassigned",
        detail:
          issue.dueAt && new Date(issue.dueAt) < now
            ? "Overdue issue"
            : "Open issue",
        route: "/issues",
      })),
    ...equipmentOutOfService.map(item => ({
      key: `equipment-${item.id}`,
      severity: item.criticality === "critical" ? "critical" : "high",
      title: `${item.name} unavailable`,
      departmentId: item.departmentId,
      owner: item.responsibleUserId ? "Equipment owner" : "Maintenance",
      detail: "Out of service",
      route: "/equipment",
    })),
    ...stockOuts.map(item => ({
      key: `inventory-${item.id}`,
      severity: "high",
      title: `${item.name} stock-out`,
      departmentId: item.departmentId,
      owner: item.responsibleUserId ? "Inventory owner" : "Department manager",
      detail: "Restock decision required",
      route: "/inventory",
    })),
    ...staffingShortfalls.map(target => ({
      key: `staffing-${target.departmentId}-${target.shift}`,
      severity: target.severity === "critical" ? "critical" : "high",
      title: `${target.shift} staffing shortfall`,
      departmentId: target.departmentId,
      owner: "Department head",
      detail: `Required ${target.requiredStaff}; present ${target.present}`,
      route: "/roster",
    })),
    ...overdueManagementActions.map(action => ({
      key: `action-${action.id}`,
      severity: action.priority,
      title: action.title,
      departmentId: action.departmentId,
      owner: action.ownerUserId ? "Assigned manager" : "Unassigned",
      detail: "Management action overdue",
      route: "/management-actions",
    })),
  ]
    .sort((a, b) => {
      const weights = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      return (
        weights[a.severity as keyof typeof weights] -
        weights[b.severity as keyof typeof weights]
      );
    })
    .slice(0, 12);
  const departmentHealth = departmentRows.map(department => {
    const group = activeAssignmentRows.filter(
      row => row.departmentId === department.id
    );
    const overdue = group.filter(
      row =>
        operationalAssignmentStatus(row.status, row.dueAt, now) === "overdue"
    ).length;
    const activeIssues = issueRows.filter(
      issue =>
        issue.departmentId === department.id &&
        !["resolved", "closed"].includes(issue.status)
    ).length;
    const completed = group.filter(row => row.status === "completed").length;
    return {
      ...department,
      completed,
      total: group.length,
      overdue,
      activeIssues,
      health:
        overdue > 0 || activeIssues > 1
          ? "attention"
          : completed === group.length && group.length > 0
            ? "normal"
            : "watch",
    };
  });
  const expiryCounts = expiryRows.reduce<Record<string, number>>(
    (total, item) => {
      const key = expiryHealth(new Date(item.expiryDate));
      total[key] = (total[key] ?? 0) + 1;
      return total;
    },
    {}
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const departmentAccountability = departmentRows
    .map(department => {
      const departmentDispatches = dispatchRows.filter(
        row => row.departmentId === department.id
      );
      const monthPointEvents = pointRows.filter(
        row =>
          row.departmentId === department.id &&
          new Date(row.createdAt) >= monthStart
      );
      const pointDelta = monthPointEvents.reduce(
        (total, event) => total + event.pointDelta,
        0
      );
      return {
        departmentId: department.id,
        departmentName: department.name,
        score: Math.max(0, 100 + pointsFromTenths(pointDelta)),
        pointsLost: pointsFromTenths(Math.abs(pointDelta)),
        dispatched: departmentDispatches.length,
        completed: departmentDispatches.filter(row =>
          ["completed", "reviewed", "closed"].includes(row.status)
        ).length,
        complianceRate: departmentDispatches.length
          ? Math.round(
              (departmentDispatches.filter(row =>
                ["completed", "reviewed", "closed"].includes(row.status)
              ).length /
                departmentDispatches.length) *
                100
            )
          : 100,
        pending: departmentDispatches.filter(row =>
          ["pending", "no_reply"].includes(row.status)
        ).length,
        awaitingReply: departmentDispatches.filter(row => row.status === "sent")
          .length,
      };
    })
    .sort((a, b) => a.score - b.score || b.pending - a.pending);
  const totalDispatched = departmentAccountability.reduce(
    (total, department) => total + department.dispatched,
    0
  );
  const totalCompleted = departmentAccountability.reduce(
    (total, department) => total + department.completed,
    0
  );
  return {
    operationalStatus,
    indicatorStates,
    attentionItems,
    taskCounts: {
      total: activeAssignmentRows.length,
      scheduledToday: todayAssignmentRows.length,
      completed: statusCounts.completed ?? 0,
      pending:
        (statusCounts.not_started ?? 0) +
        (statusCounts.in_progress ?? 0) +
        (statusCounts.pending_approval ?? 0),
      overdue: statusCounts.overdue ?? 0,
      noReply: todayDispatches.filter(
        dispatch => dispatch.status === "no_reply"
      ).length,
      awaitingReply: todayDispatches.filter(dispatch =>
        ["sent", "acknowledged"].includes(dispatch.status)
      ).length,
    },
    issueCounts: {
      critical: issueRows.filter(
        issue =>
          issue.priority === "critical" &&
          !["resolved", "closed"].includes(issue.status)
      ).length,
      high: issueRows.filter(
        issue =>
          issue.priority === "high" &&
          !["resolved", "closed"].includes(issue.status)
      ).length,
      open: issueRows.filter(
        issue => !["resolved", "closed"].includes(issue.status)
      ).length,
    },
    equipmentCounts: {
      total: equipmentRows.length,
      working: equipmentRows.filter(row => row.status === "working").length,
      attention: equipmentRows.filter(row => row.status !== "working").length,
      outOfService: equipmentOutOfService.length,
      maintenanceOverdue: maintenanceOverdue.length,
    },
    inventoryCounts: {
      shortages: inventoryRows.filter(
        item =>
          item.quantity <= Math.max(item.reorderLevel, item.minimumStock ?? 0)
      ).length,
      stockOuts: stockOuts.length,
      lowStock: lowStockItems.length,
      expiringSoon:
        (expiryCounts.within_30_days ?? 0) + (expiryCounts.within_60_days ?? 0),
      expired: expiryCounts.expired ?? 0,
    },
    riskCounts: {
      critical: openRisks.filter(risk => risk.severity === "critical").length,
      high: openRisks.filter(risk => risk.severity === "high").length,
      open: openRisks.length,
    },
    staffingCounts: {
      shortages: staffingShortfalls.length,
      required: staffingTargetRows.reduce(
        (total, row) => total + row.requiredStaff,
        0
      ),
      present: staffingTargetRows.reduce(
        (total, target) =>
          total +
          (staffingShortfalls.find(shortfall => shortfall.id === target.id)
            ?.present ?? target.requiredStaff),
        0
      ),
    },
    managementActionCounts: {
      overdue: overdueManagementActions.length,
      open: managementActionRows.filter(
        action => !["completed", "cancelled"].includes(action.status)
      ).length,
    },
    departmentHealth,
    departmentAccountability,
    complianceSummary: {
      hospitalRate: totalDispatched
        ? Math.round((totalCompleted / totalDispatched) * 100)
        : 100,
      dispatched: totalDispatched,
      completed: totalCompleted,
    },
    notifications: notificationRows,
    recentAssignments: activeAssignmentRows.slice(0, 6).map(row => ({
      ...row,
      effectiveStatus: operationalAssignmentStatus(row.status, row.dueAt, now),
    })),
    overdueManagerAssignments: activeAssignmentRows
      .filter(
        row =>
          operationalAssignmentStatus(row.status, row.dueAt, now) ===
            "overdue" && !row.whatsappDispatchId
      )
      .map(row => ({ ...row, effectiveStatus: "overdue" as const })),
    whatsappTodayAssignments: todayAssignmentRows
      .filter(row => ["daily", "weekly", "monthly"].includes(row.frequency))
      .map(row => ({
        ...row,
        effectiveStatus:
          row.whatsappStatus ??
          (row.status === "completed"
            ? "completed"
            : operationalAssignmentStatus(row.status, row.dueAt, now)),
        workflowStatus:
          row.whatsappStatus ??
          (row.status === "completed"
            ? "manager_completed"
            : "not_distributed"),
      })),
  };
}

export async function getMyDay(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const profile = (
    await db
      .select()
      .from(staffProfiles)
      .where(eq(staffProfiles.userId, user.id))
      .limit(1)
  )[0];
  const rows = await db
    .select({
      assignment: taskAssignments,
      task: tasks,
      departmentName: departments.name,
    })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
    .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
    .where(
      isAdmin(user)
        ? undefined
        : profile
          ? sql`(${taskAssignments.assignedUserId} = ${user.id} OR ${taskAssignments.departmentId} = ${profile.departmentId})`
          : eq(taskAssignments.assignedUserId, user.id)
    )
    .orderBy(asc(taskAssignments.dueAt));
  const now = new Date();
  const active = rows
    .map(row => ({
      ...row,
      effectiveStatus: operationalAssignmentStatus(
        row.assignment.status,
        row.assignment.dueAt,
        now
      ),
    }))
    .filter(row =>
      isMyDayAssignmentVisible(
        {
          frequency: row.task.frequency,
          priority: row.task.priority,
          status: row.assignment.status,
          dueAt: row.assignment.dueAt,
        },
        now
      )
    );
  return {
    tasks: active,
    counts: {
      total: active.length,
      overdue: active.filter(row => row.effectiveStatus === "overdue").length,
      completed: active.filter(row => row.effectiveStatus === "completed")
        .length,
      pending: active.filter(
        row => !["completed", "overdue"].includes(row.effectiveStatus)
      ).length,
    },
  };
}

type WhatsAppDispatchOutcome = "completed" | "pending" | "no_reply" | "excused";

function whatsappTaskMessage(input: {
  taskName: string;
  departmentName: string;
  dueAt: Date;
  frequency: string;
}) {
  const due = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input.dueAt));
  const cadence =
    input.frequency === "monthly"
      ? "Monthly task"
      : input.frequency === "weekly"
        ? "Weekly task"
        : "Daily task";
  return `*${input.departmentName} — ${cadence}*\n\nTask: ${input.taskName}\nDue: ${due}\n\nPlease complete this task and reply in this department WhatsApp group by the end of the day with:\n• Completed — brief confirmation\n• Pending — reason and expected completion time\n\nUnresolved or no-reply tasks remain pending for the department and are recorded in the department accountability scorecard.`;
}

export async function getWhatsAppTaskRegister(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  await ensureVersion2Defaults();
  const db = await requireDb();
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const rows = await db
    .select({
      assignment: taskAssignments,
      task: tasks,
      department: departments,
      dispatch: whatsappTaskDispatches,
    })
    .from(taskAssignments)
    .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
    .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
    .leftJoin(
      whatsappTaskDispatches,
      eq(whatsappTaskDispatches.assignmentId, taskAssignments.id)
    )
    .where(
      and(
        gt(taskAssignments.dueAt, new Date(dayStart.getTime() - 1)),
        lt(taskAssignments.dueAt, dayEnd),
        inArray(tasks.frequency, ["daily", "weekly", "monthly"])
      )
    )
    .orderBy(asc(taskAssignments.dueAt));
  const scheduleRows = await db
    .select({ task: tasks, department: departments })
    .from(tasks)
    .innerJoin(departments, eq(tasks.departmentId, departments.id))
    .where(
      and(
        eq(tasks.active, true),
        inArray(tasks.frequency, ["daily", "weekly", "monthly"])
      )
    )
    .orderBy(asc(tasks.name));
  const pointRows = await db.select().from(departmentPointEvents);
  const departmentRows = await db
    .select()
    .from(departments)
    .where(eq(departments.active, true));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const scorecards = departmentRows
    .map(department => {
      const events = pointRows.filter(
        event =>
          event.departmentId === department.id &&
          new Date(event.createdAt) >= monthStart
      );
      const pointsLost = events.reduce(
        (total, event) => total + Math.abs(event.pointDelta),
        0
      );
      return {
        departmentId: department.id,
        departmentName: department.name,
        score: Math.max(0, 100 - pointsFromTenths(pointsLost)),
        pointsLost: pointsFromTenths(pointsLost),
      };
    })
    .sort((a, b) => a.score - b.score);
  const cadenceSummary = (["daily", "weekly", "monthly"] as const).map(
    frequency => {
      const schedules = scheduleRows.filter(
        row => row.task.frequency === frequency
      );
      const dueToday = rows.filter(row => row.task.frequency === frequency);
      return {
        frequency,
        scheduledPlanCount: schedules.length,
        dueTodayCount: dueToday.length,
        scheduledPlans: schedules.map(row => ({
          taskId: row.task.id,
          taskName: row.task.name,
          departmentName: row.department.name,
          dueTime: row.task.dueTime,
          recurrenceRule: row.task.recurrenceRule,
        })),
        dueTodayTasks: dueToday.map(row => ({
          assignmentId: row.assignment.id,
          taskName: row.task.name,
          departmentName: row.department.name,
          dueAt: row.assignment.dueAt,
        })),
      };
    }
  );
  return {
    tasks: rows.map(row => ({
      ...row,
      suggestedMessage: whatsappTaskMessage({
        taskName: row.task.name,
        departmentName: row.department.name,
        dueAt: row.assignment.dueAt,
        frequency: row.task.frequency,
      }),
    })),
    scorecards,
    summary: {
      sent: rows.filter(
        row =>
          row.dispatch && !["prepared", "copied"].includes(row.dispatch.status)
      ).length,
      completed: rows.filter(
        row =>
          row.dispatch?.status === "completed" ||
          row.dispatch?.status === "reviewed" ||
          row.dispatch?.status === "closed"
      ).length,
      pending: rows.filter(row =>
        ["pending", "no_reply"].includes(row.dispatch?.status ?? "")
      ).length,
      excused: rows.filter(row => row.dispatch?.status === "excused").length,
      awaitingAcknowledgement: rows.filter(
        row => row.dispatch?.status === "sent"
      ).length,
      notSent: rows.filter(
        row =>
          row.assignment.status !== "completed" &&
          (!row.dispatch ||
            ["prepared", "copied"].includes(row.dispatch.status))
      ).length,
    },
    cadenceSummary,
  };
}

async function getWhatsAppTaskContext(assignmentId: number) {
  const db = await requireDb();
  const row = (
    await db
      .select({
        assignment: taskAssignments,
        task: tasks,
        department: departments,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
      .where(eq(taskAssignments.id, assignmentId))
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Task assignment not found.",
    });
  return row;
}

export async function prepareWhatsAppTask(
  user: User,
  input: { assignmentId: number; messageText?: string }
) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const row = await getWhatsAppTaskContext(input.assignmentId);
  if (row.assignment.status === "completed")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This task was completed directly and cannot be added to the WhatsApp workflow.",
    });
  const existing = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.assignmentId, input.assignmentId))
      .limit(1)
  )[0];
  const messageText =
    input.messageText?.trim() ||
    whatsappTaskMessage({
      taskName: row.task.name,
      departmentName: row.department.name,
      dueAt: row.assignment.dueAt,
      frequency: row.task.frequency,
    });
  if (existing)
    return {
      dispatchId: existing.id,
      messageText: existing.messageText,
      status: existing.status,
      alreadyPrepared: true,
    };
  const created = await db
    .insert(whatsappTaskDispatches)
    .values({
      assignmentId: row.assignment.id,
      taskId: row.task.id,
      departmentId: row.department.id,
      sentByUserId: user.id,
      messageText,
      status: "prepared",
      preparedAt: new Date(),
    })
    .$returningId();
  await writeTaskLifecycleEvent(user.id, row.assignment.id, "prepared", {
    dispatchId: created[0]!.id,
    metadata: { departmentId: row.department.id },
  });
  await writeAudit(
    user.id,
    "whatsapp_task_prepared",
    "task_assignment",
    row.assignment.id,
    { dispatchId: created[0]!.id, departmentId: row.department.id }
  );
  return {
    dispatchId: created[0]!.id,
    messageText,
    status: "prepared",
    alreadyPrepared: false,
  };
}

export async function recordWhatsAppTaskCopied(
  user: User,
  input: { dispatchId: number }
) {
  ensureManager(user);
  const db = await requireDb();
  const dispatch = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.id, input.dispatchId))
      .limit(1)
  )[0];
  if (!dispatch)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "WhatsApp task dispatch not found.",
    });
  if (dispatch.status === "prepared") {
    await db
      .update(whatsappTaskDispatches)
      .set({ status: "copied", copiedAt: new Date() })
      .where(eq(whatsappTaskDispatches.id, dispatch.id));
    await writeTaskLifecycleEvent(user.id, dispatch.assignmentId, "copied", {
      dispatchId: dispatch.id,
    });
    await writeAudit(
      user.id,
      "whatsapp_task_copied",
      "whatsapp_dispatch",
      dispatch.id,
      {}
    );
  }
  return {
    status: dispatch.status === "prepared" ? "copied" : dispatch.status,
  };
}

export async function dispatchWhatsAppTask(
  user: User,
  input: { assignmentId: number; messageText?: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const prepared = await prepareWhatsAppTask(user, input);
  if (!["prepared", "copied"].includes(prepared.status))
    return {
      dispatchId: prepared.dispatchId,
      messageText: prepared.messageText,
      alreadyDispatched: true,
    };
  const now = new Date();
  await db
    .update(whatsappTaskDispatches)
    .set({ status: "sent", sentAt: now, messageText: prepared.messageText })
    .where(eq(whatsappTaskDispatches.id, prepared.dispatchId));
  await writeTaskLifecycleEvent(user.id, input.assignmentId, "sent", {
    dispatchId: prepared.dispatchId,
  });
  await writeAudit(
    user.id,
    "whatsapp_task_dispatched",
    "task_assignment",
    input.assignmentId,
    { dispatchId: prepared.dispatchId }
  );
  return {
    dispatchId: prepared.dispatchId,
    messageText: prepared.messageText,
    alreadyDispatched: prepared.status === "sent",
  };
}

export async function acknowledgeWhatsAppTask(
  user: User,
  input: { dispatchId: number; note?: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const dispatch = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.id, input.dispatchId))
      .limit(1)
  )[0];
  if (!dispatch)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "WhatsApp task dispatch not found.",
    });
  if (["prepared", "copied"].includes(dispatch.status))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Confirm the manual WhatsApp send before recording acknowledgement.",
    });
  if (!["sent", "acknowledged"].includes(dispatch.status))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This WhatsApp task already has an end-of-day outcome and cannot be acknowledged again.",
    });
  await db
    .update(whatsappTaskDispatches)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      responseNote: input.note?.trim() || dispatch.responseNote,
    })
    .where(eq(whatsappTaskDispatches.id, dispatch.id));
  await writeTaskLifecycleEvent(
    user.id,
    dispatch.assignmentId,
    "acknowledged",
    { dispatchId: dispatch.id, note: input.note }
  );
  await writeAudit(
    user.id,
    "whatsapp_task_acknowledged",
    "whatsapp_dispatch",
    dispatch.id,
    { note: input.note }
  );
  return { status: "acknowledged" as const };
}

export async function recordWhatsAppTaskOutcome(
  user: User,
  input: {
    dispatchId: number;
    outcome: WhatsAppDispatchOutcome;
    note?: string;
    excusedReason?: string;
  }
) {
  ensureManager(user);
  await ensureVersion2Defaults();
  const db = await requireDb();
  const row = (
    await db
      .select({ dispatch: whatsappTaskDispatches, task: tasks })
      .from(whatsappTaskDispatches)
      .innerJoin(tasks, eq(whatsappTaskDispatches.taskId, tasks.id))
      .where(eq(whatsappTaskDispatches.id, input.dispatchId))
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "WhatsApp task dispatch not found.",
    });
  const dispatch = row.dispatch;
  if (!["sent", "acknowledged"].includes(dispatch.status))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This WhatsApp task already has a recorded outcome. Review or close it instead of replacing the outcome.",
    });
  if (input.outcome === "excused" && !input.excusedReason?.trim())
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Select or record an excused-task reason.",
    });
  const shouldPenaltyApply =
    ["pending", "no_reply"].includes(input.outcome) && !dispatch.penaltyApplied;
  const now = new Date();
  await db
    .update(whatsappTaskDispatches)
    .set({
      status: input.outcome,
      respondedAt: now,
      responseNote: input.note?.trim() || null,
      excusedReason:
        input.outcome === "excused" ? input.excusedReason!.trim() : null,
      penaltyApplied: dispatch.penaltyApplied || shouldPenaltyApply,
    })
    .where(eq(whatsappTaskDispatches.id, dispatch.id));
  await db
    .update(taskAssignments)
    .set({
      status: ["completed", "excused"].includes(input.outcome)
        ? "completed"
        : "in_progress",
      completedAt: ["completed", "excused"].includes(input.outcome)
        ? now
        : null,
    })
    .where(eq(taskAssignments.id, dispatch.assignmentId));
  let penaltyTenths = 0;
  if (shouldPenaltyApply) {
    const scoringRule = (
      await db
        .select()
        .from(taskScoringRules)
        .where(eq(taskScoringRules.priority, row.task.priority))
        .limit(1)
    )[0];
    penaltyTenths = scoringRule?.weightTenths ?? row.task.pointWeightTenths;
    await db.insert(departmentPointEvents).values({
      departmentId: dispatch.departmentId,
      dispatchId: dispatch.id,
      pointDelta: -penaltyTenths,
      reason:
        input.outcome === "no_reply"
          ? "No end-of-day response to WhatsApp task"
          : "Task remained pending at end of day",
      recordedByUserId: user.id,
    });
  }
  await writeTaskLifecycleEvent(user.id, dispatch.assignmentId, input.outcome, {
    dispatchId: dispatch.id,
    note: input.note,
    metadata: { excusedReason: input.excusedReason ?? null, penaltyTenths },
  });
  await writeAudit(
    user.id,
    "whatsapp_task_outcome_recorded",
    "whatsapp_dispatch",
    dispatch.id,
    {
      outcome: input.outcome,
      penaltyApplied: shouldPenaltyApply,
      penaltyTenths,
      excusedReason: input.excusedReason ?? null,
    }
  );
  return {
    status: input.outcome,
    penaltyApplied: shouldPenaltyApply,
    penaltyTenths,
  };
}

export async function reviewWhatsAppTask(
  user: User,
  input: { dispatchId: number; close?: boolean; note?: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const dispatch = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.id, input.dispatchId))
      .limit(1)
  )[0];
  if (!dispatch)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "WhatsApp task dispatch not found.",
    });
  if (dispatch.status === "closed")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This WhatsApp task lifecycle is already closed.",
    });
  if (
    ![
      "completed",
      "pending",
      "no_reply",
      "excused",
      "reviewed",
      "closed",
    ].includes(dispatch.status)
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Record a department outcome before reviewing this task.",
    });
  const now = new Date();
  const status = input.close ? "closed" : "reviewed";
  await db
    .update(whatsappTaskDispatches)
    .set({
      status,
      reviewedAt: now,
      closedAt: input.close ? now : dispatch.closedAt,
      responseNote: input.note?.trim() || dispatch.responseNote,
    })
    .where(eq(whatsappTaskDispatches.id, dispatch.id));
  await writeTaskLifecycleEvent(user.id, dispatch.assignmentId, status, {
    dispatchId: dispatch.id,
    note: input.note,
  });
  await writeAudit(
    user.id,
    `whatsapp_task_${status}`,
    "whatsapp_dispatch",
    dispatch.id,
    { note: input.note }
  );
  return { status };
}

export async function getTaskDetail(user: User, assignmentId: number) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const row = (
    await db
      .select({
        assignment: taskAssignments,
        task: tasks,
        department: departments,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
      .where(eq(taskAssignments.id, assignmentId))
      .limit(1)
  )[0];
  if (!row)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Task assignment not found.",
    });
  if (
    !isAdmin(user) &&
    row.assignment.assignedUserId !== user.id &&
    !isManager(user)
  )
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You can only open tasks assigned to you.",
    });
  const [checklist, results] = await Promise.all([
    db
      .select()
      .from(taskChecklists)
      .where(
        and(
          eq(taskChecklists.taskId, row.task.id),
          eq(taskChecklists.active, true)
        )
      )
      .orderBy(asc(taskChecklists.position)),
    db
      .select()
      .from(taskChecklistResults)
      .where(eq(taskChecklistResults.assignmentId, assignmentId)),
  ]);
  const byChecklist = new Map(
    results.map(result => [result.checklistId, result])
  );
  return {
    ...row,
    effectiveStatus: operationalAssignmentStatus(
      row.assignment.status,
      row.assignment.dueAt
    ),
    checklist: checklist.map(item => ({
      ...item,
      result: byChecklist.get(item.id) ?? null,
    })),
  };
}

export async function saveChecklistResult(
  user: User,
  input: {
    assignmentId: number;
    checklistId: number;
    status: FindingStatus;
    note?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const detail = await getTaskDetail(user, input.assignmentId);
  const checklist = detail.checklist.find(
    item => item.id === input.checklistId
  );
  if (!checklist)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Checklist item does not belong to this task.",
    });
  const existing = (
    await db
      .select()
      .from(taskChecklistResults)
      .where(
        and(
          eq(taskChecklistResults.assignmentId, input.assignmentId),
          eq(taskChecklistResults.checklistId, input.checklistId)
        )
      )
      .limit(1)
  )[0];
  let issueId = existing?.createdIssueId ?? null;
  if (findingCreatesIssue(input.status) && !issueId) {
    const created = await db
      .insert(issues)
      .values({
        code: `ISS-${String(Date.now()).slice(-6)}`,
        title: `${checklist.label}: ${input.status.replaceAll("_", " ")}`,
        description:
          input.note ??
          `Checklist finding recorded during ${detail.task.name}.`,
        departmentId: detail.department.id,
        category: detail.task.category,
        priority: priorityForFinding(input.status),
        sourceType: "checklist_result",
        sourceId: input.assignmentId,
        reportedBy: user.id,
        dueAt:
          priorityForFinding(input.status) === "critical"
            ? new Date(Date.now() + 4 * 60 * 60_000)
            : new Date(Date.now() + 24 * 60 * 60_000),
      })
      .$returningId();
    issueId = created[0]!.id;
    await db.insert(notifications).values({
      departmentId: detail.department.id,
      type: "issue",
      title: "New operational issue",
      body: `${checklist.label} was reported as ${input.status.replaceAll("_", " ")}.`,
      entityType: "issue",
      entityId: issueId,
    });
    await writeAudit(
      user.id,
      "issue_created_from_checklist",
      "issue",
      issueId,
      { status: input.status, assignmentId: input.assignmentId }
    );
  }
  if (existing) {
    await db
      .update(taskChecklistResults)
      .set({
        status: input.status,
        note: input.note ?? null,
        evidenceUrl: null,
        reportedBy: user.id,
        createdIssueId: issueId,
      })
      .where(eq(taskChecklistResults.id, existing.id));
  } else {
    await db.insert(taskChecklistResults).values({
      assignmentId: input.assignmentId,
      checklistId: input.checklistId,
      status: input.status,
      note: input.note ?? null,
      evidenceUrl: null,
      reportedBy: user.id,
      createdIssueId: issueId,
    });
  }
  await db
    .update(taskAssignments)
    .set({ status: "in_progress" })
    .where(
      and(
        eq(taskAssignments.id, input.assignmentId),
        notInArray(taskAssignments.status, ["completed", "pending_approval"])
      )
    );
  await writeAudit(
    user.id,
    "checklist_result_saved",
    "task_assignment",
    input.assignmentId,
    { checklistId: input.checklistId, status: input.status, issueId }
  );
  return {
    issueId,
    createdIssue: Boolean(issueId && !existing?.createdIssueId),
  };
}

export async function completeTask(
  user: User,
  input: { assignmentId: number; notes?: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const detail = await getTaskDetail(user, input.assignmentId);
  const dispatch = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.assignmentId, input.assignmentId))
      .limit(1)
  )[0];
  if (dispatch)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This task is already in the WhatsApp workflow. Record its outcome through the manager task register.",
    });
  const requiredChecklist = detail.checklist.filter(item => item.required);
  const completionBlock = taskCompletionBlockReason({
    requiredChecklistCount: requiredChecklist.length,
    completedChecklistCount: requiredChecklist.filter(item => item.result)
      .length,
  });
  if (completionBlock)
    throw new TRPCError({ code: "BAD_REQUEST", message: completionBlock });
  const needsApproval = detail.task.approvalRequired;
  const finalStatus = needsApproval
    ? "pending_approval"
    : ("completed" as const);
  await db
    .update(taskAssignments)
    .set({ status: finalStatus, completedAt: new Date() })
    .where(eq(taskAssignments.id, input.assignmentId));
  await db
    .insert(taskCompletions)
    .values({
      assignmentId: input.assignmentId,
      taskId: detail.task.id,
      userId: user.id,
      departmentId: detail.department.id,
      status: finalStatus,
      notes: input.notes ?? null,
      evidenceUrl: null,
      approvalStatus: needsApproval ? "pending" : "not_required",
    })
    .onDuplicateKeyUpdate({
      set: {
        status: finalStatus,
        notes: input.notes ?? null,
        evidenceUrl: null,
        completedAt: new Date(),
      },
    });
  await writeAudit(
    user.id,
    "task_submitted",
    "task_assignment",
    input.assignmentId,
    { status: finalStatus }
  );
  return { status: finalStatus };
}

export async function completeTaskDirectlyByManager(
  user: User,
  input: { assignmentId: number; notes?: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const detail = await getTaskDetail(user, input.assignmentId);
  const dispatch = (
    await db
      .select()
      .from(whatsappTaskDispatches)
      .where(eq(whatsappTaskDispatches.assignmentId, input.assignmentId))
      .limit(1)
  )[0];
  if (dispatch)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "This task is already in the WhatsApp workflow. Record its outcome through the task lifecycle instead.",
    });
  if (detail.assignment.status === "completed")
    return { status: "completed" as const, alreadyCompleted: true };

  const notes =
    input.notes?.trim() ||
    "Completed directly by the operations manager; no WhatsApp distribution required.";
  await db
    .update(taskAssignments)
    .set({ status: "completed", completedAt: new Date() })
    .where(eq(taskAssignments.id, input.assignmentId));
  await db
    .insert(taskCompletions)
    .values({
      assignmentId: input.assignmentId,
      taskId: detail.task.id,
      userId: user.id,
      departmentId: detail.department.id,
      status: "completed",
      notes,
      evidenceUrl: null,
      approvalStatus: "not_required",
    })
    .onDuplicateKeyUpdate({
      set: {
        status: "completed",
        notes,
        evidenceUrl: null,
        completedAt: new Date(),
      },
    });
  await writeAudit(
    user.id,
    "task_completed_directly_by_manager",
    "task_assignment",
    input.assignmentId,
    { directManagerCompletion: true, whatsappDistributed: false }
  );
  return { status: "completed" as const, alreadyCompleted: false };
}

export async function createTask(
  user: User,
  input: {
    name: string;
    description?: string;
    departmentId: number;
    assignedUserId?: number;
    frequency:
      | "one_time"
      | "daily"
      | "every_shift"
      | "weekly"
      | "monthly"
      | "quarterly"
      | "yearly"
      | "custom";
    dueTime: string;
    priority: "critical" | "high" | "medium" | "low";
    category: string;
    instructions?: string;
    approvalRequired?: boolean;
    weeklyDay?: "saturday" | "sunday";
    checklist: string[];
  }
) {
  ensureSuperAdmin(user);
  const db = await requireDb();
  const { weeklyDay, ...taskInput } = input;
  const ids = await db
    .insert(tasks)
    .values({
      ...taskInput,
      assignedUserId: input.assignedUserId ?? null,
      description: input.description ?? null,
      instructions: input.instructions ?? null,
      recurrenceRule:
        input.frequency === "weekly"
          ? `weekly:${weeklyDay ?? "saturday"}`
          : null,
      evidenceRequired: false,
      photoRequired: false,
      approvalRequired: input.approvalRequired ?? false,
      createdBy: user.id,
    })
    .$returningId();
  const taskId = ids[0]!.id;
  if (input.checklist.length)
    await db.insert(taskChecklists).values(
      input.checklist.filter(Boolean).map((label, position) => ({
        taskId,
        label,
        position,
        required: true,
      }))
    );
  const dueAt = initialTaskDueDate(
    input.frequency,
    input.dueTime,
    weeklyDay ?? "saturday"
  );
  const assignment = await db
    .insert(taskAssignments)
    .values({
      taskId,
      departmentId: input.departmentId,
      assignedUserId: input.assignedUserId ?? null,
      dueAt,
    })
    .$returningId();
  if (input.frequency !== "one_time")
    await db.insert(recurringTasks).values({
      taskId,
      nextRunAt: computeNextDueDate(input.frequency, dueAt),
    });
  await writeAudit(user.id, "task_created", "task", taskId, {
    assignmentId: assignment[0]!.id,
    frequency: input.frequency,
  });
  return { taskId, assignmentId: assignment[0]!.id };
}

export async function getDepartmentTaskSchedules(user: User) {
  ensureSuperAdmin(user);
  const db = await requireDb();
  return db
    .select({
      task: tasks,
      departmentId: departments.id,
      departmentName: departments.name,
      ownerName: users.name,
      nextRunAt: recurringTasks.nextRunAt,
    })
    .from(tasks)
    .innerJoin(departments, eq(tasks.departmentId, departments.id))
    .leftJoin(users, eq(tasks.assignedUserId, users.id))
    .leftJoin(recurringTasks, eq(recurringTasks.taskId, tasks.id))
    .where(inArray(tasks.frequency, ["daily", "weekly", "monthly"]))
    .orderBy(asc(departments.name), asc(tasks.frequency), asc(tasks.name));
}

export async function listIssues(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const rows = await db
    .select({
      issue: issues,
      departmentName: departments.name,
      reporterName: users.name,
    })
    .from(issues)
    .innerJoin(departments, eq(issues.departmentId, departments.id))
    .leftJoin(users, eq(issues.reportedBy, users.id))
    .orderBy(desc(issues.updatedAt));
  return rows;
}

export async function createIssue(
  user: User,
  input: {
    title: string;
    description?: string;
    departmentId: number;
    category: string;
    priority: "critical" | "high" | "medium" | "low";
    dueAt?: Date;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(issues)
    .values({
      code: `ISS-${String(Date.now()).slice(-6)}`,
      title: input.title,
      description: input.description ?? null,
      departmentId: input.departmentId,
      category: input.category,
      priority: input.priority,
      reportedBy: user.id,
      dueAt: input.dueAt ?? null,
    })
    .$returningId();
  await db.insert(notifications).values({
    departmentId: input.departmentId,
    type: "issue",
    title: "New issue reported",
    body: input.title,
    entityType: "issue",
    entityId: created[0]!.id,
  });
  await writeAudit(user.id, "issue_created", "issue", created[0]!.id, {
    priority: input.priority,
  });
  return { id: created[0]!.id };
}

export async function resolveIssue(
  user: User,
  input: { issueId: number; resolution: string }
) {
  ensureManager(user);
  const db = await requireDb();
  const existing = (
    await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1)
  )[0];
  if (!existing)
    throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  await db
    .update(issues)
    .set({
      status: "resolved",
      resolution: input.resolution,
      closedBy: user.id,
      closedAt: new Date(),
    })
    .where(eq(issues.id, input.issueId));
  await writeAudit(user.id, "issue_resolved", "issue", input.issueId, {
    resolution: input.resolution,
  });
  return { success: true };
}

export async function getRiskRegister(user: User) {
  ensureManager(user);
  const db = await requireDb();
  const rows = await db
    .select({ risk: risks, departmentName: departments.name })
    .from(risks)
    .innerJoin(departments, eq(risks.departmentId, departments.id))
    .orderBy(desc(risks.updatedAt));
  return rows.map(row => ({
    ...row,
    riskScore: row.risk.likelihood * row.risk.impact,
    reviewOverdue: Boolean(
      row.risk.reviewDate &&
        new Date(row.risk.reviewDate) < new Date() &&
        !["resolved", "closed"].includes(row.risk.status)
    ),
  }));
}

export async function createRisk(
  user: User,
  input: {
    description: string;
    category: string;
    departmentId: number;
    likelihood: number;
    impact: number;
    ownerUserId?: number;
    mitigationPlan?: string;
    reviewDate?: Date;
    relatedIssueId?: number;
    relatedTaskId?: number;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const score = input.likelihood * input.impact;
  const severity =
    score >= 16
      ? "critical"
      : score >= 10
        ? "high"
        : score >= 5
          ? "medium"
          : ("low" as const);
  const created = await db
    .insert(risks)
    .values({
      code: `RSK-${String(Date.now()).slice(-6)}`,
      description: input.description,
      category: input.category,
      departmentId: input.departmentId,
      likelihood: input.likelihood,
      impact: input.impact,
      severity,
      ownerUserId: input.ownerUserId ?? null,
      mitigationPlan: input.mitigationPlan ?? null,
      reviewDate: input.reviewDate ?? null,
      relatedIssueId: input.relatedIssueId ?? null,
      relatedTaskId: input.relatedTaskId ?? null,
      createdByUserId: user.id,
    })
    .$returningId();
  await writeAudit(user.id, "risk_created", "risk", created[0]!.id, {
    ...input,
    severity,
    score,
  });
  return { id: created[0]!.id, severity, score };
}

export async function updateRisk(
  user: User,
  input: {
    riskId: number;
    status: "open" | "mitigating" | "accepted" | "resolved" | "closed";
    mitigationPlan?: string;
    residualRisk?: number;
    reviewDate?: Date;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const current = (
    await db.select().from(risks).where(eq(risks.id, input.riskId)).limit(1)
  )[0];
  if (!current)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Risk record not found.",
    });
  await db
    .update(risks)
    .set({
      status: input.status,
      mitigationPlan: input.mitigationPlan ?? current.mitigationPlan,
      residualRisk: input.residualRisk ?? current.residualRisk,
      reviewDate: input.reviewDate ?? current.reviewDate,
    })
    .where(eq(risks.id, input.riskId));
  await writeAudit(user.id, "risk_updated", "risk", input.riskId, input);
  return { success: true };
}

export async function getManagementActions(user: User) {
  ensureManager(user);
  const db = await requireDb();
  const now = new Date();
  const rows = await db
    .select({ action: managementActions, departmentName: departments.name })
    .from(managementActions)
    .innerJoin(departments, eq(managementActions.departmentId, departments.id))
    .orderBy(desc(managementActions.updatedAt));
  return rows.map(row => ({
    ...row,
    effectiveStatus:
      !["completed", "cancelled"].includes(row.action.status) &&
      row.action.dueAt &&
      new Date(row.action.dueAt) < now
        ? "overdue"
        : row.action.status,
  }));
}

export async function createManagementAction(
  user: User,
  input: {
    title: string;
    reason?: string;
    departmentId: number;
    ownerUserId?: number;
    priority: "critical" | "high" | "medium" | "low";
    dueAt?: Date;
    relatedIssueId?: number;
    relatedRiskId?: number;
    relatedTaskId?: number;
    meetingReference?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(managementActions)
    .values({
      title: input.title,
      reason: input.reason ?? null,
      departmentId: input.departmentId,
      ownerUserId: input.ownerUserId ?? null,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      relatedIssueId: input.relatedIssueId ?? null,
      relatedRiskId: input.relatedRiskId ?? null,
      relatedTaskId: input.relatedTaskId ?? null,
      meetingReference: input.meetingReference ?? null,
      createdByUserId: user.id,
    })
    .$returningId();
  await writeAudit(
    user.id,
    "management_action_created",
    "management_action",
    created[0]!.id,
    input
  );
  return { id: created[0]!.id };
}

export async function updateManagementAction(
  user: User,
  input: {
    actionId: number;
    status: "open" | "in_progress" | "completed" | "overdue" | "cancelled";
    completionNotes?: string;
    verification?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const action = (
    await db
      .select()
      .from(managementActions)
      .where(eq(managementActions.id, input.actionId))
      .limit(1)
  )[0];
  if (!action)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Management action not found.",
    });
  const verified = Boolean(input.verification?.trim());
  await db
    .update(managementActions)
    .set({
      status: input.status,
      completionNotes: input.completionNotes ?? action.completionNotes,
      verification: input.verification ?? action.verification,
      verifiedByUserId: verified ? user.id : action.verifiedByUserId,
      verifiedAt: verified ? new Date() : action.verifiedAt,
    })
    .where(eq(managementActions.id, input.actionId));
  await writeAudit(
    user.id,
    "management_action_updated",
    "management_action",
    input.actionId,
    input
  );
  return { success: true };
}

export async function getIssueHistory(user: User, issueId: number) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const issue = (
    await db.select().from(issues).where(eq(issues.id, issueId)).limit(1)
  )[0];
  if (!issue)
    throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  const [comments, history] = await Promise.all([
    db
      .select({ comment: issueComments, userName: users.name })
      .from(issueComments)
      .leftJoin(users, eq(issueComments.userId, users.id))
      .where(eq(issueComments.issueId, issueId))
      .orderBy(asc(issueComments.createdAt)),
    db
      .select({ audit: auditLogs, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(
        and(eq(auditLogs.entityType, "issue"), eq(auditLogs.entityId, issueId))
      )
      .orderBy(asc(auditLogs.createdAt)),
  ]);
  return { issue, comments, history };
}

export async function getOperationsModules(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const [
    departmentRows,
    equipmentRows,
    inventoryRows,
    expiryRows,
    rosterRows,
    handovers,
    auditRows,
    staffRows,
  ] = await Promise.all([
    db
      .select()
      .from(departments)
      .where(eq(departments.active, true))
      .orderBy(asc(departments.name)),
    db
      .select({ equipment, departmentName: departments.name })
      .from(equipment)
      .innerJoin(departments, eq(equipment.departmentId, departments.id))
      .orderBy(asc(equipment.name)),
    db
      .select({ inventory, departmentName: departments.name })
      .from(inventory)
      .innerJoin(departments, eq(inventory.departmentId, departments.id))
      .orderBy(asc(inventory.name)),
    db
      .select({ expiry: expiryItems, departmentName: departments.name })
      .from(expiryItems)
      .innerJoin(departments, eq(expiryItems.departmentId, departments.id))
      .orderBy(asc(expiryItems.expiryDate)),
    db
      .select({
        roster: dutyRosters,
        departmentName: departments.name,
        staffName: users.name,
      })
      .from(dutyRosters)
      .innerJoin(departments, eq(dutyRosters.departmentId, departments.id))
      .innerJoin(users, eq(dutyRosters.userId, users.id))
      .where(eq(dutyRosters.dutyDate, new Date(dateKey())))
      .orderBy(asc(dutyRosters.startTime)),
    db
      .select({
        handover: shiftHandovers,
        departmentName: departments.name,
        fromUserName: users.name,
      })
      .from(shiftHandovers)
      .innerJoin(departments, eq(shiftHandovers.departmentId, departments.id))
      .innerJoin(users, eq(shiftHandovers.fromUserId, users.id))
      .orderBy(desc(shiftHandovers.createdAt)),
    db
      .select({ audit: auditLogs, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
    db
      .select({
        id: users.id,
        name: users.name,
        role: users.role,
        departmentId: staffProfiles.departmentId,
        title: staffProfiles.title,
      })
      .from(users)
      .innerJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(eq(staffProfiles.active, true))
      .orderBy(asc(users.name)),
  ]);
  return {
    departments: departmentRows,
    equipment: equipmentRows,
    inventory: inventoryRows.map(row => ({
      ...row,
      lowStock: row.inventory.quantity <= row.inventory.reorderLevel,
    })),
    expiry: expiryRows.map(row => ({
      ...row,
      health: expiryHealth(new Date(row.expiry.expiryDate)),
    })),
    rosters: rosterRows,
    handovers,
    auditLogs: auditRows,
    staff: staffRows,
  };
}

export async function createHandover(
  user: User,
  input: {
    departmentId: number;
    shift: string;
    pendingTasks?: string;
    equipmentProblems?: string;
    stockShortages?: string;
    incidents?: string;
    operationalNotes?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(shiftHandovers)
    .values({
      ...input,
      fromUserId: user.id,
      handoverDate: new Date(dateKey()),
      pendingTasks: input.pendingTasks ?? null,
      equipmentProblems: input.equipmentProblems ?? null,
      stockShortages: input.stockShortages ?? null,
      incidents: input.incidents ?? null,
      operationalNotes: input.operationalNotes ?? null,
    })
    .$returningId();
  await writeAudit(
    user.id,
    "shift_handover_created",
    "shift_handover",
    created[0]!.id
  );
  return { id: created[0]!.id };
}

export async function getReports(user: User) {
  ensureManager(user);
  const dashboard = await getDashboard(user);
  const db = await requireDb();
  const reportMonthStart = new Date();
  reportMonthStart.setDate(1);
  reportMonthStart.setHours(0, 0, 0, 0);
  const [
    departmentRows,
    rosterRows,
    issueRows,
    pointEventRows,
    dispatchTimingRows,
  ] = await Promise.all([
    db.select().from(departments).where(eq(departments.active, true)),
    db
      .select()
      .from(dutyRosters)
      .where(eq(dutyRosters.dutyDate, new Date(dateKey()))),
    db.select().from(issues),
    db
      .select({
        departmentId: departmentPointEvents.departmentId,
        departmentName: departments.name,
        pointDelta: departmentPointEvents.pointDelta,
        reason: departmentPointEvents.reason,
        createdAt: departmentPointEvents.createdAt,
      })
      .from(departmentPointEvents)
      .innerJoin(
        departments,
        eq(departmentPointEvents.departmentId, departments.id)
      )
      .where(
        gt(
          departmentPointEvents.createdAt,
          new Date(reportMonthStart.getTime() - 1)
        )
      )
      .orderBy(asc(departmentPointEvents.createdAt)),
    db
      .select({
        sentAt: whatsappTaskDispatches.sentAt,
        acknowledgedAt: whatsappTaskDispatches.acknowledgedAt,
        respondedAt: whatsappTaskDispatches.respondedAt,
      })
      .from(whatsappTaskDispatches)
      .where(
        gt(
          whatsappTaskDispatches.sentAt,
          new Date(reportMonthStart.getTime() - 1)
        )
      ),
  ]);
  const eventsByDepartment = new Map<number, typeof pointEventRows>();
  for (const event of pointEventRows)
    eventsByDepartment.set(event.departmentId, [
      ...(eventsByDepartment.get(event.departmentId) ?? []),
      event,
    ]);
  return {
    generatedAt: new Date(),
    dashboard,
    departmentPerformance: dashboard.departmentHealth.map(department => ({
      name: department.name,
      assigned: department.total,
      completed: department.completed,
      completionRate: department.total
        ? Math.round((department.completed / department.total) * 100)
        : 0,
      overdue: department.overdue,
      openIssues: department.activeIssues,
    })),
    whatsappAccountability: dashboard.departmentAccountability,
    whatsappSummary: {
      dispatched: dashboard.departmentAccountability.reduce(
        (total, department) => total + department.dispatched,
        0
      ),
      completed: dashboard.departmentAccountability.reduce(
        (total, department) => total + department.completed,
        0
      ),
      pendingOrNoReply: dashboard.departmentAccountability.reduce(
        (total, department) =>
          total + department.pending + department.awaitingReply,
        0
      ),
      pointsLost: dashboard.departmentAccountability.reduce(
        (total, department) => total + department.pointsLost,
        0
      ),
    },
    complianceSummary: dashboard.complianceSummary,
    responseTimeAnalytics: {
      acknowledgedCount: dispatchTimingRows.filter(row => row.acknowledgedAt)
        .length,
      respondedCount: dispatchTimingRows.filter(row => row.respondedAt).length,
      averageAcknowledgementMinutes: (() => {
        const values = dispatchTimingRows
          .filter(row => row.acknowledgedAt)
          .map(
            row =>
              (new Date(row.acknowledgedAt!).getTime() -
                new Date(row.sentAt).getTime()) /
              60_000
          );
        return values.length
          ? Math.round(
              values.reduce((sum, value) => sum + value, 0) / values.length
            )
          : null;
      })(),
      averageResponseMinutes: (() => {
        const values = dispatchTimingRows
          .filter(row => row.respondedAt)
          .map(
            row =>
              (new Date(row.respondedAt!).getTime() -
                new Date(row.sentAt).getTime()) /
              60_000
          );
        return values.length
          ? Math.round(
              values.reduce((sum, value) => sum + value, 0) / values.length
            )
          : null;
      })(),
    },
    repeatedProblemTrends: Object.entries(
      issueRows.reduce<Record<string, number>>((counts, issue) => {
        counts[issue.category] = (counts[issue.category] ?? 0) + 1;
        return counts;
      }, {})
    )
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count),
    departmentPointTrends: dashboard.departmentAccountability.map(
      department => {
        let runningScore = 100;
        const events = (
          eventsByDepartment.get(department.departmentId) ?? []
        ).map(event => {
          runningScore += pointsFromTenths(event.pointDelta);
          return { ...event, scoreAfter: runningScore };
        });
        return {
          departmentId: department.departmentId,
          departmentName: department.departmentName,
          currentScore: department.score,
          events,
        };
      }
    ),
    attendance: {
      scheduled: rosterRows.length,
      absent: rosterRows.filter(
        row => row.attendance === "absent" || row.attendance === "leave"
      ).length,
      late: rosterRows.filter(row => row.attendance === "late").length,
      replacements: rosterRows.filter(row => row.attendance === "replacement")
        .length,
    },
    issueSummary: {
      total: issueRows.length,
      open: issueRows.filter(
        row => !["resolved", "closed"].includes(row.status)
      ).length,
      critical: issueRows.filter(
        row =>
          row.priority === "critical" &&
          !["resolved", "closed"].includes(row.status)
      ).length,
    },
    departmentCount: departmentRows.length,
  };
}

export async function manageDepartment(
  user: User,
  input: { name: string; code: string; description?: string }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only hospital administrators can manage departments.",
    });
  const db = await requireDb();
  const created = await db
    .insert(departments)
    .values({
      name: input.name,
      code: input.code.toUpperCase(),
      description: input.description ?? null,
    })
    .$returningId();
  await writeAudit(
    user.id,
    "department_created",
    "department",
    created[0]!.id,
    input
  );
  return { id: created[0]!.id };
}

export async function setDepartmentActive(
  user: User,
  input: { departmentId: number; active: boolean }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only hospital administrators can activate or deactivate departments.",
    });
  const db = await requireDb();
  await db
    .update(departments)
    .set({ active: input.active })
    .where(eq(departments.id, input.departmentId));
  await writeAudit(
    user.id,
    input.active ? "department_activated" : "department_deactivated",
    "department",
    input.departmentId,
    input
  );
  return { success: true };
}

export async function updateDepartment(
  user: User,
  input: {
    departmentId: number;
    name: string;
    code: string;
    description?: string;
  }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only hospital administrators can edit departments.",
    });
  const db = await requireDb();
  await db
    .update(departments)
    .set({
      name: input.name,
      code: input.code.toUpperCase(),
      description: input.description ?? null,
    })
    .where(eq(departments.id, input.departmentId));
  await writeAudit(
    user.id,
    "department_updated",
    "department",
    input.departmentId,
    input
  );
  return { success: true };
}

export async function createInventoryItem(
  user: User,
  input: {
    name: string;
    category: string;
    departmentId: number;
    quantity: number;
    reorderLevel: number;
    unit: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(inventory)
    .values({ ...input, responsibleUserId: user.id })
    .$returningId();
  await writeAudit(
    user.id,
    "inventory_item_created",
    "inventory",
    created[0]!.id,
    input
  );
  return { id: created[0]!.id };
}

export async function assignIssue(
  user: User,
  input: { issueId: number; assignedTo: number; dueAt?: Date }
) {
  ensureManager(user);
  const db = await requireDb();
  const issue = (
    await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1)
  )[0];
  if (!issue)
    throw new TRPCError({ code: "NOT_FOUND", message: "Issue not found." });
  await db
    .update(issues)
    .set({
      assignedTo: input.assignedTo,
      dueAt: input.dueAt ?? issue.dueAt,
      status: "assigned",
    })
    .where(eq(issues.id, input.issueId));
  await db.insert(notifications).values({
    userId: input.assignedTo,
    departmentId: issue.departmentId,
    type: "issue_assignment",
    title: "Issue assigned to you",
    body: `${issue.code}: ${issue.title}`,
    entityType: "issue",
    entityId: issue.id,
  });
  await writeAudit(user.id, "issue_assigned", "issue", input.issueId, {
    assignedTo: input.assignedTo,
    dueAt: input.dueAt?.toISOString() ?? issue.dueAt?.toISOString(),
  });
  return { success: true };
}

export async function createExpiryItem(
  user: User,
  input: {
    name: string;
    category: string;
    departmentId: number;
    batchNumber?: string;
    quantity: number;
    expiryDate: Date;
    storageLocation?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(expiryItems)
    .values({
      ...input,
      batchNumber: input.batchNumber ?? null,
      storageLocation: input.storageLocation ?? null,
      responsibleUserId: user.id,
    })
    .$returningId();
  await writeAudit(
    user.id,
    "expiry_item_created",
    "expiry_item",
    created[0]!.id,
    { name: input.name, expiryDate: input.expiryDate.toISOString() }
  );
  return { id: created[0]!.id };
}

export async function createEquipmentMaintenance(
  user: User,
  input: {
    equipmentId: number;
    maintenanceType: string;
    scheduledAt: Date;
    vendor?: string;
    notes?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const created = await db
    .insert(equipmentMaintenance)
    .values({
      equipmentId: input.equipmentId,
      maintenanceType: input.maintenanceType,
      scheduledAt: input.scheduledAt,
      vendor: input.vendor ?? null,
      notes: input.notes ?? null,
    })
    .$returningId();
  await db
    .update(equipment)
    .set({ status: "under_maintenance", nextServiceAt: input.scheduledAt })
    .where(eq(equipment.id, input.equipmentId));
  await writeAudit(
    user.id,
    "maintenance_scheduled",
    "equipment_maintenance",
    created[0]!.id,
    {
      equipmentId: input.equipmentId,
      scheduledAt: input.scheduledAt.toISOString(),
    }
  );
  return { id: created[0]!.id };
}

export async function createOperationalFollowUpTask(
  user: User,
  input: { sourceType: "inventory" | "expiry" | "equipment"; sourceId: number }
) {
  ensureManager(user);
  const db = await requireDb();
  const dueAt = new Date();
  dueAt.setHours(dueAt.getHours() + 4, 0, 0, 0);
  let taskName = "Operational follow-up";
  let departmentId = 0;
  let category = "Operational follow-up";
  let priority: "critical" | "high" | "medium" | "low" = "high";
  if (input.sourceType === "inventory") {
    const item = (
      await db
        .select()
        .from(inventory)
        .where(eq(inventory.id, input.sourceId))
        .limit(1)
    )[0];
    if (!item)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Inventory item not found.",
      });
    taskName = `Restock: ${item.name}`;
    departmentId = item.departmentId;
    category = "Inventory check";
    priority = item.quantity === 0 ? "critical" : "high";
  } else if (input.sourceType === "expiry") {
    const item = (
      await db
        .select()
        .from(expiryItems)
        .where(eq(expiryItems.id, input.sourceId))
        .limit(1)
    )[0];
    if (!item)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Expiry item not found.",
      });
    taskName = `Expiry review: ${item.name}`;
    departmentId = item.departmentId;
    category = "Inventory check";
  } else {
    const item = (
      await db
        .select()
        .from(equipment)
        .where(eq(equipment.id, input.sourceId))
        .limit(1)
    )[0];
    if (!item)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Equipment record not found.",
      });
    taskName = `Equipment follow-up: ${item.name}`;
    departmentId = item.departmentId;
    category = "Equipment check";
    priority =
      item.criticality === "critical" || item.status === "out_of_service"
        ? "critical"
        : "high";
  }
  const dueTime = `${String(dueAt.getHours()).padStart(2, "0")}:${String(dueAt.getMinutes()).padStart(2, "0")}`;
  const sourceMarker = `Manager-confirmed follow-up created from ${input.sourceType} record #${input.sourceId}.`;
  const existingOpenFollowUp = (
    await db
      .select({ assignmentId: taskAssignments.id })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .where(
        and(
          eq(tasks.instructions, sourceMarker),
          notInArray(taskAssignments.status, ["completed", "pending_approval"])
        )
      )
      .limit(1)
  )[0];
  if (existingOpenFollowUp)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "An open follow-up task already exists for this operational record.",
    });
  const taskId = (
    await db
      .insert(tasks)
      .values({
        name: taskName,
        departmentId,
        frequency: "one_time",
        dueTime,
        priority,
        category,
        instructions: sourceMarker,
        active: true,
        createdBy: user.id,
        lastModifiedBy: user.id,
      })
      .$returningId()
  )[0]!.id;
  const assignmentId = (
    await db
      .insert(taskAssignments)
      .values({ taskId, departmentId, dueAt, status: "not_started" })
      .$returningId()
  )[0]!.id;
  await writeAudit(
    user.id,
    "operational_follow_up_task_created",
    "task_assignment",
    assignmentId,
    { ...input, taskId }
  );
  return { taskId, assignmentId };
}

export async function updateDutyAttendance(
  user: User,
  input: {
    rosterId: number;
    attendance: "present" | "absent" | "late" | "leave" | "replacement";
    replacementUserId?: number;
    notes?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const roster = (
    await db
      .select()
      .from(dutyRosters)
      .where(eq(dutyRosters.id, input.rosterId))
      .limit(1)
  )[0];
  if (!roster)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Duty roster entry not found.",
    });
  await db
    .update(dutyRosters)
    .set({
      attendance: input.attendance,
      replacementUserId: input.replacementUserId ?? null,
      notes: input.notes ?? null,
    })
    .where(eq(dutyRosters.id, input.rosterId));
  if (["absent", "leave"].includes(input.attendance))
    await db.insert(notifications).values({
      departmentId: roster.departmentId,
      type: "replacement_required",
      title: "Replacement required",
      body: "A scheduled duty has an attendance exception and needs coverage.",
      entityType: "duty_roster",
      entityId: roster.id,
    });
  await writeAudit(
    user.id,
    "duty_attendance_updated",
    "duty_roster",
    input.rosterId,
    {
      attendance: input.attendance,
      replacementUserId: input.replacementUserId ?? null,
    }
  );
  return { success: true };
}

type RosterEntryInput = {
  departmentId: number;
  userId: number;
  dutyDate: Date;
  shift: string;
  startTime: string;
  endTime: string;
  assignedDuty: string;
  attendance?: "present" | "absent" | "late" | "leave" | "replacement";
  notes?: string;
};

async function validateRosterEntry(
  db: Awaited<ReturnType<typeof requireDb>>,
  input: RosterEntryInput
) {
  if (input.startTime >= input.endTime)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Roster start time must be earlier than the end time.",
    });
  const staffMember = (
    await db
      .select({ user: users, profile: staffProfiles })
      .from(users)
      .innerJoin(staffProfiles, eq(staffProfiles.userId, users.id))
      .where(eq(users.id, input.userId))
      .limit(1)
  )[0];
  if (!staffMember?.profile.active)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose an active staff member for this roster entry.",
    });
  if (staffMember.profile.departmentId !== input.departmentId)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "The selected staff member must belong to the selected department.",
    });
  const duplicate = (
    await db
      .select()
      .from(dutyRosters)
      .where(
        and(
          eq(dutyRosters.departmentId, input.departmentId),
          eq(dutyRosters.userId, input.userId),
          eq(dutyRosters.dutyDate, input.dutyDate),
          eq(dutyRosters.shift, input.shift),
          eq(dutyRosters.startTime, input.startTime)
        )
      )
      .limit(1)
  )[0];
  if (duplicate)
    throw new TRPCError({
      code: "CONFLICT",
      message: "This staff member already has a matching roster slot.",
    });
}

export async function createDutyRoster(user: User, input: RosterEntryInput) {
  ensureManager(user);
  const db = await requireDb();
  await validateRosterEntry(db, input);
  const created = await db
    .insert(dutyRosters)
    .values({
      ...input,
      attendance: input.attendance ?? "present",
      notes: input.notes?.trim() || null,
    })
    .$returningId();
  await writeAudit(
    user.id,
    "duty_roster_created",
    "duty_roster",
    created[0]!.id,
    {
      departmentId: input.departmentId,
      userId: input.userId,
      dutyDate: input.dutyDate.toISOString(),
      shift: input.shift,
    }
  );
  return { id: created[0]!.id };
}

export async function importDutyRosters(
  user: User,
  input: { rows: RosterEntryInput[] }
) {
  ensureManager(user);
  const db = await requireDb();
  const created: number[] = [];
  const errors: Array<{ row: number; message: string }> = [];
  for (let index = 0; index < input.rows.length; index += 1) {
    const row = input.rows[index]!;
    try {
      await validateRosterEntry(db, row);
      const roster = await db
        .insert(dutyRosters)
        .values({
          ...row,
          attendance: row.attendance ?? "present",
          notes: row.notes?.trim() || null,
        })
        .$returningId();
      created.push(roster[0]!.id);
      await writeAudit(
        user.id,
        "duty_roster_imported",
        "duty_roster",
        roster[0]!.id,
        {
          importRow: index + 1,
          departmentId: row.departmentId,
          userId: row.userId,
          dutyDate: row.dutyDate.toISOString(),
          shift: row.shift,
        }
      );
    } catch (error) {
      errors.push({
        row: index + 1,
        message:
          error instanceof TRPCError
            ? error.message
            : "Roster row could not be imported.",
      });
    }
  }
  return { createdCount: created.length, errors };
}

export async function getOperationalAlerts(user: User) {
  ensureManager(user);
  const db = await requireDb();
  const [alertRows, managerRows, historyRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(100),
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(inArray(users.role, managerRoles)),
    db
      .select({ audit: auditLogs, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(eq(auditLogs.entityType, "notification"))
      .orderBy(desc(auditLogs.createdAt))
      .limit(300),
  ]);
  const names = new Map(
    managerRows.map(row => [row.id, row.name || `Manager #${row.id}`])
  );
  return {
    managers: managerRows,
    alerts: alertRows.map(alert => ({
      ...alert,
      ownerName: alert.ownerUserId
        ? (names.get(alert.ownerUserId) ?? "Unknown manager")
        : null,
      acknowledgedByName: alert.acknowledgedByUserId
        ? (names.get(alert.acknowledgedByUserId) ?? "Unknown manager")
        : null,
      resolvedByName: alert.resolvedByUserId
        ? (names.get(alert.resolvedByUserId) ?? "Unknown manager")
        : null,
      history: historyRows
        .filter(row => row.audit.entityId === alert.id)
        .slice(0, 4),
    })),
  };
}

export async function updateOperationalAlert(
  user: User,
  input: {
    notificationId: number;
    action: "assign" | "acknowledge" | "resolve" | "reopen";
    ownerUserId?: number;
    note?: string;
  }
) {
  ensureManager(user);
  const db = await requireDb();
  const alert = (
    await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, input.notificationId))
      .limit(1)
  )[0];
  if (!alert)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Operational alert not found.",
    });
  const selectedOwnerId = input.ownerUserId ?? alert.ownerUserId ?? user.id;
  const owner = (
    await db
      .select()
      .from(users)
      .where(
        and(eq(users.id, selectedOwnerId), inArray(users.role, managerRoles))
      )
      .limit(1)
  )[0];
  if (!owner)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a valid manager to own this alert.",
    });
  const now = new Date();
  if (input.action === "assign") {
    await db
      .update(notifications)
      .set({
        ownerUserId: selectedOwnerId,
        handlingNote: input.note?.trim() || alert.handlingNote,
      })
      .where(eq(notifications.id, alert.id));
  } else if (input.action === "acknowledge") {
    if (alert.handlingStatus === "resolved")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Reopen a resolved alert before acknowledging it again.",
      });
    await db
      .update(notifications)
      .set({
        ownerUserId: selectedOwnerId,
        handlingStatus: "acknowledged",
        acknowledgedByUserId: user.id,
        acknowledgedAt: now,
        handlingNote: input.note?.trim() || alert.handlingNote,
      })
      .where(eq(notifications.id, alert.id));
  } else if (input.action === "resolve") {
    await db
      .update(notifications)
      .set({
        ownerUserId: selectedOwnerId,
        handlingStatus: "resolved",
        resolvedByUserId: user.id,
        resolvedAt: now,
        handlingNote: input.note?.trim() || alert.handlingNote,
      })
      .where(eq(notifications.id, alert.id));
  } else {
    await db
      .update(notifications)
      .set({
        handlingStatus: "open",
        resolvedByUserId: null,
        resolvedAt: null,
        handlingNote: input.note?.trim() || alert.handlingNote,
      })
      .where(eq(notifications.id, alert.id));
  }
  await writeAudit(
    user.id,
    `operational_alert_${input.action}`,
    "notification",
    alert.id,
    { ownerUserId: selectedOwnerId, note: input.note?.trim() || null }
  );
  return { success: true };
}

export async function getCalendar(user: User) {
  ensureManager(user);
  await ensureOperationalDemo(user);
  const db = await requireDb();
  const [
    assignmentRows,
    maintenanceRows,
    expiryRows,
    rosterRows,
    riskRows,
    actionRows,
  ] = await Promise.all([
    db
      .select({
        id: taskAssignments.id,
        title: tasks.name,
        date: taskAssignments.dueAt,
        type: tasks.category,
        status: taskAssignments.status,
        departmentName: departments.name,
      })
      .from(taskAssignments)
      .innerJoin(tasks, eq(taskAssignments.taskId, tasks.id))
      .innerJoin(departments, eq(taskAssignments.departmentId, departments.id))
      .orderBy(asc(taskAssignments.dueAt)),
    db
      .select({
        id: equipmentMaintenance.id,
        title: equipment.name,
        date: equipmentMaintenance.scheduledAt,
        type: equipmentMaintenance.maintenanceType,
        status: equipmentMaintenance.status,
        departmentName: departments.name,
      })
      .from(equipmentMaintenance)
      .innerJoin(equipment, eq(equipmentMaintenance.equipmentId, equipment.id))
      .innerJoin(departments, eq(equipment.departmentId, departments.id))
      .orderBy(asc(equipmentMaintenance.scheduledAt)),
    db
      .select({
        id: expiryItems.id,
        title: expiryItems.name,
        date: expiryItems.expiryDate,
        type: expiryItems.category,
        departmentName: departments.name,
      })
      .from(expiryItems)
      .innerJoin(departments, eq(expiryItems.departmentId, departments.id))
      .orderBy(asc(expiryItems.expiryDate)),
    db
      .select({
        id: dutyRosters.id,
        title: users.name,
        date: dutyRosters.dutyDate,
        type: dutyRosters.shift,
        status: dutyRosters.attendance,
        departmentName: departments.name,
      })
      .from(dutyRosters)
      .innerJoin(users, eq(dutyRosters.userId, users.id))
      .innerJoin(departments, eq(dutyRosters.departmentId, departments.id))
      .orderBy(asc(dutyRosters.dutyDate)),
    db
      .select({
        id: risks.id,
        title: risks.description,
        date: risks.reviewDate,
        type: risks.severity,
        status: risks.status,
        departmentName: departments.name,
      })
      .from(risks)
      .innerJoin(departments, eq(risks.departmentId, departments.id))
      .where(isNotNull(risks.reviewDate))
      .orderBy(asc(risks.reviewDate)),
    db
      .select({
        id: managementActions.id,
        title: managementActions.title,
        date: managementActions.dueAt,
        type: managementActions.priority,
        status: managementActions.status,
        departmentName: departments.name,
      })
      .from(managementActions)
      .innerJoin(
        departments,
        eq(managementActions.departmentId, departments.id)
      )
      .where(isNotNull(managementActions.dueAt))
      .orderBy(asc(managementActions.dueAt)),
  ]);
  return {
    tasks: assignmentRows,
    maintenance: maintenanceRows,
    expiry: expiryRows,
    duties: rosterRows,
    risks: riskRows,
    managementActions: actionRows,
  };
}

export async function getSettings(user: User) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Only hospital administrators can access hospital-wide settings.",
    });
  const db = await requireDb();
  await ensureNotificationRuleDefaults();
  const [rules, notificationRuleRows, departmentRows] = await Promise.all([
    db.select().from(escalationRules).orderBy(asc(escalationRules.name)),
    db.select().from(notificationRules).orderBy(asc(notificationRules.label)),
    db.select().from(departments).orderBy(asc(departments.name)),
  ]);
  return {
    rules,
    notificationRules: notificationRuleRows,
    departments: departmentRows,
    staff: [] as const,
  };
}

export async function updateEscalationRule(
  user: User,
  input: {
    ruleId: number;
    firstReminderMinutes: number;
    departmentHeadMinutes: number;
    adminMinutes: number;
    active: boolean;
  }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only hospital administrators can update escalation rules.",
    });
  const db = await requireDb();
  await db
    .update(escalationRules)
    .set(input)
    .where(eq(escalationRules.id, input.ruleId));
  await writeAudit(
    user.id,
    "escalation_rule_updated",
    "escalation_rule",
    input.ruleId,
    input
  );
  return { success: true };
}

export async function updateNotificationRule(
  user: User,
  input: {
    ruleId: number;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    leadMinutes: number;
    active: boolean;
  }
) {
  if (!isAdmin(user))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only hospital administrators can update notification rules.",
    });
  const db = await requireDb();
  await db
    .update(notificationRules)
    .set(input)
    .where(eq(notificationRules.id, input.ruleId));
  await writeAudit(
    user.id,
    "notification_rule_updated",
    "notification_rule",
    input.ruleId,
    input
  );
  return { success: true };
}

export async function runOperationalCycle() {
  const db = await requireDb();
  const now = new Date();
  const today = dateKey(now);
  const activeRules = await db
    .select()
    .from(escalationRules)
    .where(eq(escalationRules.active, true));
  const escalationStage = (
    overdueAt: Date,
    rule: {
      firstReminderMinutes: number;
      departmentHeadMinutes: number;
      adminMinutes: number;
    }
  ) => {
    const elapsedMinutes = Math.max(
      0,
      Math.floor((now.getTime() - overdueAt.getTime()) / 60_000)
    );
    if (elapsedMinutes >= rule.adminMinutes) return "admin";
    if (elapsedMinutes >= rule.departmentHeadMinutes) return "department_head";
    if (elapsedMinutes >= rule.firstReminderMinutes) return "staff";
    return null;
  };
  const recurring = await db
    .select({ recurring: recurringTasks, task: tasks })
    .from(recurringTasks)
    .innerJoin(tasks, eq(recurringTasks.taskId, tasks.id))
    .where(and(eq(recurringTasks.active, true), eq(tasks.active, true)));
  let generatedAssignments = 0;
  for (const row of recurring) {
    const scheduledDate = dateKey(row.recurring.nextRunAt);
    if (row.recurring.lastGeneratedFor === today || scheduledDate > today)
      continue;
    const [hour, minute] = row.task.dueTime.split(":").map(Number);
    const dueAt = new Date(row.recurring.nextRunAt);
    dueAt.setHours(hour ?? 0, minute ?? 0, 0, 0);
    await db
      .insert(taskAssignments)
      .values({
        taskId: row.task.id,
        departmentId: row.task.departmentId,
        assignedUserId: row.task.assignedUserId,
        dueAt,
      })
      .onDuplicateKeyUpdate({ set: { dueAt } });
    await db
      .update(recurringTasks)
      .set({
        lastGeneratedFor: today,
        nextRunAt: computeNextDueDate(row.task.frequency, dueAt),
      })
      .where(eq(recurringTasks.id, row.recurring.id));
    generatedAssignments += 1;
  }
  const overdueCandidates = await db
    .select()
    .from(taskAssignments)
    .where(
      and(
        lt(taskAssignments.dueAt, now),
        inArray(taskAssignments.status, [
          "not_started",
          "in_progress",
          "reopened",
        ])
      )
    );
  for (const assignment of overdueCandidates) {
    await db
      .update(taskAssignments)
      .set({ status: "overdue" })
      .where(eq(taskAssignments.id, assignment.id));
    const rule =
      activeRules.find(item => item.appliesTo === "task") ?? activeRules[0];
    const stage = rule ? escalationStage(assignment.dueAt, rule) : "staff";
    if (stage) {
      await db.insert(notifications).values({
        userId: assignment.assignedUserId,
        departmentId: assignment.departmentId,
        type: "overdue_task",
        title: `Task overdue — ${stage.replaceAll("_", " ")} escalation`,
        body: "An operational task has passed its deadline and reached the configured escalation stage.",
        entityType: "task_assignment",
        entityId: assignment.id,
      });
      await writeAudit(
        null,
        `task_escalated_${stage}`,
        "task_assignment",
        assignment.id,
        { ruleId: rule?.id ?? null, dueAt: assignment.dueAt.toISOString() }
      );
    }
  }
  const overdueIssues = await db
    .select()
    .from(issues)
    .where(
      and(
        lt(issues.dueAt, now),
        inArray(issues.status, ["open", "assigned", "in_progress"])
      )
    );
  for (const issue of overdueIssues) {
    const rule =
      activeRules.find(
        item =>
          item.appliesTo === "issue" &&
          (!item.priority || item.priority === issue.priority)
      ) ??
      activeRules.find(item => item.appliesTo === "issue") ??
      activeRules[0];
    const stage = rule ? escalationStage(issue.dueAt!, rule) : "staff";
    if (stage) {
      await db
        .update(issues)
        .set({ status: "escalated" })
        .where(eq(issues.id, issue.id));
      await db.insert(notifications).values({
        userId: issue.assignedTo,
        departmentId: issue.departmentId,
        type: "issue_escalated",
        title: `Issue escalated — ${stage.replaceAll("_", " ")}`,
        body: `${issue.code}: ${issue.title} exceeded its due date and reached the configured escalation stage.`,
        entityType: "issue",
        entityId: issue.id,
      });
      await writeAudit(null, `issue_escalated_${stage}`, "issue", issue.id, {
        ruleId: rule?.id ?? null,
        dueAt: issue.dueAt?.toISOString(),
      });
    }
  }
  return {
    generatedAssignments,
    markedOverdue: overdueCandidates.length,
    escalatedIssues: overdueIssues.length,
    processedAt: now.toISOString(),
  };
}
