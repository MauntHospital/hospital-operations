import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { completeTask, createTask, getDashboard, getReports, getTaskDetail, manageDepartment, manageStaff, resolveIssue, saveChecklistResult } from "../server/operationsData.ts";

const db = await getDb();
if (!db) throw new Error("Database connection was unavailable for end-to-end verification.");

const actor = (await db.select().from(users).where(eq(users.role, "super_admin")).limit(1))[0];
if (!actor) throw new Error("A super-admin account was not available for workflow verification.");

const stamp = Date.now();
const department = await manageDepartment(actor, {
  name: `Verification Unit ${stamp}`,
  code: `V${String(stamp).slice(-6)}`,
  description: "Temporary department created by the end-to-end operational workflow verification.",
});
const staff = await manageStaff(actor, {
  name: `Verification Staff ${stamp}`,
  departmentId: department.id,
  role: "staff",
  title: "Verification Technician",
});
const staffUser = (await db.select().from(users).where(eq(users.id, staff.id)).limit(1))[0];
if (!staffUser) throw new Error("Verification staff profile was not created.");
const created = await createTask(actor, {
  name: `Workflow verification safety check ${stamp}`,
  departmentId: department.id,
  assignedUserId: staffUser.id,
  frequency: "one_time",
  dueTime: "23:30",
  priority: "high",
  category: "Safety",
  instructions: "Automated end-to-end verification of checklist-to-issue workflow.",
  checklist: ["Protective item condition verified"],
});

const detail = await getTaskDetail(staffUser, created.assignmentId);
const checklistId = detail.checklist[0]?.id;
if (!checklistId) throw new Error("Verification task checklist was not created.");

const finding = await saveChecklistResult(staffUser, {
  assignmentId: created.assignmentId,
  checklistId,
  status: "damaged",
  note: "Automated verification finding: protective item marked damaged.",
});
if (!finding.issueId) throw new Error("Checklist failure did not create an issue.");

const completion = await completeTask(staffUser, {
  assignmentId: created.assignmentId,
  notes: "Automated verification task submitted after checklist completion.",
});
await resolveIssue(actor, {
  issueId: finding.issueId,
  resolution: "Automated verification resolution recorded after checklist-to-issue workflow.",
});

const [dashboard, report] = await Promise.all([getDashboard(actor), getReports(actor)]);
const outcome = {
  verifiedAt: new Date().toISOString(),
  departmentId: department.id,
  staffId: staffUser.id,
  taskId: created.taskId,
  assignmentId: created.assignmentId,
  createdIssueId: finding.issueId,
  completionStatus: completion.status,
  dashboardOpenIssues: dashboard.issueCounts.open,
  reportDepartmentCount: report.departmentCount,
};

console.log(JSON.stringify(outcome, null, 2));
process.exit(0);
