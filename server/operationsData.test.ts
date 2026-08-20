import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));

vi.mock("./db", () => ({
  getDb: async () => state.db,
}));

import { completeTask, createManagementAction, createOperationalFollowUpTask, createRisk, createTask, dispatchWhatsAppTask, getDashboard, getMyDay, getReports, recordWhatsAppTaskOutcome, runOperationalCycle, saveChecklistResult, updateTaskScoringRule } from "./operationsData";

function query(rows: any[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (resolve: (value: any[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function makeDb(selectResults: any[][]) {
  const writes: any[] = [];
  let cursor = 0;
  const db: any = {
    select: () => query(selectResults[cursor++] ?? []),
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        writes.push({ table, payload });
        return { $returningId: async () => [{ id: 501 }], onDuplicateKeyUpdate: async () => ({}) };
      },
    }),
    update: (table: unknown) => ({ set: (payload: unknown) => ({ where: async () => { writes.push({ table, payload, kind: "update" }); return {}; } }) }),
    delete: () => ({ where: async () => ({}) }),
  };
  return { db, writes };
}

const actor: User = {
  id: 7,
  openId: "test-user",
  name: "Test User",
  email: "test@hospital.example",
  loginMethod: "test",
  role: "staff",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const admin: User = { ...actor, id: 1, openId: "admin-user", role: "hospital_admin" };
const superAdmin: User = { ...actor, id: 2, openId: "super-admin-user", role: "super_admin" };

const detail = {
  assignment: { id: 77, taskId: 5, departmentId: 4, assignedUserId: 7, dueAt: new Date("2026-08-19T09:00:00.000Z"), status: "not_started" },
  task: { id: 5, name: "Lead apron safety check", category: "Safety", evidenceRequired: false, approvalRequired: false },
  department: { id: 4, name: "Radiology" },
};

const requiredChecklist = { id: 12, taskId: 5, label: "Lead apron undamaged", required: true, active: true, position: 0 };

describe("operational backend mutations", () => {
  it("creates an issue, notification, audit entry, and checklist result for a damaging checklist finding", async () => {
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [requiredChecklist],
      [],
      [],
    ]);
    state.db = fake.db;

    const result = await saveChecklistResult(actor, { assignmentId: 77, checklistId: 12, status: "damaged", note: "Seam split found during opening check." });

    expect(result).toEqual({ issueId: 501, createdIssue: true });
    expect(fake.writes.some(write => (write.payload as any)?.title?.includes("Lead apron undamaged"))).toBe(true);
    expect(fake.writes.some(write => (write.payload as any)?.type === "issue")).toBe(true);
    expect(fake.writes.some(write => (write.payload as any)?.checklistId === 12 && (write.payload as any)?.createdIssueId === 501)).toBe(true);
  });

  it("rejects completion through completeTask when a required checklist item has not been recorded", async () => {
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [requiredChecklist],
      [],
    ]);
    state.db = fake.db;

    await expect(completeTask(actor, { assignmentId: 77 })).rejects.toMatchObject({ message: expect.stringMatching(/required checklist items/i) });
  });

  it("changes an overdue assignment to completed after its required checklist is recorded and submitted", async () => {
    const overdueDetail = { ...detail, assignment: { ...detail.assignment, status: "overdue", dueAt: new Date("2026-08-20T08:00:00.000Z") }, task: { ...detail.task, evidenceRequired: false, approvalRequired: false } };
    const recordedResult = { id: 18, assignmentId: 77, checklistId: 12, status: "available" };
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [overdueDetail], [requiredChecklist], [recordedResult],
    ]);
    state.db = fake.db;

    await expect(completeTask(actor, { assignmentId: 77, notes: "All checks completed." })).resolves.toEqual({ status: "completed" });
    expect(fake.writes.some(write => write.kind === "update" && (write.payload as any)?.status === "completed" && (write.payload as any)?.completedAt instanceof Date)).toBe(true);
  });

  it("completes two separate ready assignments in sequence without retaining the first task state", async () => {
    const firstResult = { id: 18, assignmentId: 77, checklistId: 12, status: "available" };
    const secondDetail = { ...detail, assignment: { ...detail.assignment, id: 78, taskId: 6 }, task: { ...detail.task, id: 6, name: "Radiation barrier inspection" } };
    const secondChecklist = { ...requiredChecklist, id: 13, taskId: 6, label: "Barrier is intact" };
    const secondResult = { id: 19, assignmentId: 78, checklistId: 13, status: "available" };
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [detail], [requiredChecklist], [firstResult],
      [{ value: 1 }], [{ value: 1 }], [secondDetail], [secondChecklist], [secondResult],
    ]);
    state.db = fake.db;

    await expect(completeTask(actor, { assignmentId: 77 })).resolves.toEqual({ status: "completed" });
    await expect(completeTask(actor, { assignmentId: 78 })).resolves.toEqual({ status: "completed" });

    const completionWrites = fake.writes.filter(write => write.kind === "update" && (write.payload as any)?.status === "completed");
    expect(completionWrites).toHaveLength(2);
    expect(fake.writes.filter(write => (write.payload as any)?.assignmentId === 77 || (write.payload as any)?.assignmentId === 78).length).toBeGreaterThanOrEqual(2);
  });

  it("refreshes My Day between two task completions without requiring evidence for the second task", async () => {
    const dueAt = new Date(Date.now() + 60 * 60_000);
    const firstDetail = { ...detail, assignment: { ...detail.assignment, id: 77, dueAt, status: "in_progress" }, task: { ...detail.task, evidenceRequired: false, photoRequired: false, frequency: "daily", priority: "high" } };
    const secondDetail = { ...detail, assignment: { ...detail.assignment, id: 78, taskId: 6, dueAt, status: "in_progress" }, task: { ...detail.task, id: 6, name: "Radiation barrier inspection", evidenceRequired: true, photoRequired: true, frequency: "daily", priority: "high" } };
    const firstResult = { id: 18, assignmentId: 77, checklistId: 12, status: "available" };
    const secondChecklist = { ...requiredChecklist, id: 13, taskId: 6, label: "Barrier is intact" };
    const secondResult = { id: 19, assignmentId: 78, checklistId: 13, status: "available" };
    const beforeCompletion = [
      { assignment: firstDetail.assignment, task: firstDetail.task, departmentName: "Radiology" },
      { assignment: secondDetail.assignment, task: secondDetail.task, departmentName: "Radiology" },
    ];
    const afterFirstCompletion = [
      { assignment: { ...firstDetail.assignment, status: "completed", completedAt: new Date() }, task: firstDetail.task, departmentName: "Radiology" },
      { assignment: secondDetail.assignment, task: secondDetail.task, departmentName: "Radiology" },
    ];
    const afterSecondCompletion = afterFirstCompletion.map(row => row.assignment.id === 78 ? { ...row, assignment: { ...row.assignment, status: "completed", completedAt: new Date() } } : row);
    const profile = { userId: actor.id, departmentId: 4, active: true };
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [profile], beforeCompletion,
      [{ value: 1 }], [{ value: 1 }], [firstDetail], [requiredChecklist], [firstResult],
      [{ value: 1 }], [{ value: 1 }], [profile], afterFirstCompletion,
      [{ value: 1 }], [{ value: 1 }], [secondDetail], [secondChecklist], [secondResult],
      [{ value: 1 }], [{ value: 1 }], [profile], afterSecondCompletion,
    ]);
    state.db = fake.db;

    expect((await getMyDay(actor)).counts.completed).toBe(0);
    await expect(completeTask(actor, { assignmentId: 77 })).resolves.toEqual({ status: "completed" });
    const afterFirstRefresh = await getMyDay(actor);
    expect(afterFirstRefresh.counts.completed).toBe(1);
    expect(afterFirstRefresh.tasks.find(row => row.assignment.id === 78)?.effectiveStatus).toBe("in_progress");

    await expect(completeTask(actor, { assignmentId: 78 })).resolves.toEqual({ status: "completed" });
    const afterSecondRefresh = await getMyDay(actor);
    expect(afterSecondRefresh.counts.completed).toBe(2);
    expect(afterSecondRefresh.counts.pending).toBe(0);
    expect(fake.writes.some(write => (write.payload as any)?.assignmentId === 78 && (write.payload as any)?.evidenceUrl === null)).toBe(true);
  });

  it("shows a completed status in refreshed My Day after submitting an overdue assignment", async () => {
    const overdueDetail = { ...detail, assignment: { ...detail.assignment, status: "overdue", dueAt: new Date() }, task: { ...detail.task, evidenceRequired: false, approvalRequired: false, frequency: "daily", priority: "high" } };
    const recordedResult = { id: 18, assignmentId: 77, checklistId: 12, status: "available" };
    const refreshedMyDayRow = { assignment: { ...overdueDetail.assignment, status: "completed", completedAt: new Date() }, task: overdueDetail.task, departmentName: "Radiology" };
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [overdueDetail], [requiredChecklist], [recordedResult],
      [{ value: 1 }], [{ value: 1 }], [{ userId: actor.id, departmentId: 4, active: true }], [refreshedMyDayRow],
    ]);
    state.db = fake.db;

    await completeTask(actor, { assignmentId: 77 });
    const refreshed = await getMyDay(actor);

    expect(refreshed.tasks).toHaveLength(1);
    expect(refreshed.tasks[0]).toMatchObject({ assignment: { id: 77, status: "completed" }, effectiveStatus: "completed" });
    expect(refreshed.counts.completed).toBe(1);
    expect(refreshed.counts.overdue).toBe(0);
  });

  it("records a manager-sent WhatsApp task with a copy-ready department message", async () => {
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [detail], [],
    ]);
    state.db = fake.db;

    const result = await dispatchWhatsAppTask(admin, { assignmentId: 77 });

    expect(result).toMatchObject({ dispatchId: 501, alreadyDispatched: false });
    expect(result.messageText).toMatch(/Radiology/);
    expect(result.messageText).toMatch(/Lead apron safety check/);
    expect(fake.writes.some(write => (write.payload as any)?.assignmentId === 77 && (write.payload as any)?.channel === undefined)).toBe(true);
  });

  it("uses the weekly or monthly cadence in the manager's WhatsApp message", async () => {
    const weeklyDetail = { ...detail, task: { ...detail.task, frequency: "weekly" } };
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [weeklyDetail], [],
    ]);
    state.db = fake.db;

    const result = await dispatchWhatsAppTask(admin, { assignmentId: 77 });

    expect(result.messageText).toMatch(/Weekly task/);
  });

  it("applies the configured weighted deduction exactly once when an end-of-day WhatsApp task stays pending or receives no reply", async () => {
    const initialDispatch = { id: 501, assignmentId: 77, taskId: 5, departmentId: 4, sentByUserId: admin.id, status: "sent", penaltyApplied: false };
    const scoredTask = { id: 5, priority: "high", pointWeightTenths: 30 };
    const penaltyFake = makeDb([[{ value: 1 }], [{ value: 1 }], [{ dispatch: initialDispatch, task: scoredTask }], [{ priority: "high", weightTenths: 30 }]]);
    state.db = penaltyFake.db;

    await expect(recordWhatsAppTaskOutcome(admin, { dispatchId: 501, outcome: "no_reply", note: "No WhatsApp reply by close of shift." })).resolves.toEqual({ status: "no_reply", penaltyApplied: true, penaltyTenths: 30 });
    expect(penaltyFake.writes.some(write => (write.payload as any)?.pointDelta === -30 && (write.payload as any)?.dispatchId === 501)).toBe(true);

    const penalizedDispatch = { ...initialDispatch, status: "no_reply", penaltyApplied: true };
    const noDuplicateFake = makeDb([[{ value: 1 }], [{ value: 1 }], [{ dispatch: penalizedDispatch, task: scoredTask }]]);
    state.db = noDuplicateFake.db;
    await expect(recordWhatsAppTaskOutcome(admin, { dispatchId: 501, outcome: "pending" })).resolves.toEqual({ status: "pending", penaltyApplied: false, penaltyTenths: 0 });
    expect(noDuplicateFake.writes.some(write => (write.payload as any)?.pointDelta === -30)).toBe(false);
  });

  it("shows manual WhatsApp outcomes, point deductions, and report aggregates for the department scorecard", async () => {
    const now = new Date();
    const fake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [{ value: 1 }], [{ value: 1 }],
      [{ id: 77, status: "in_progress", dueAt: new Date(now.getTime() + 60_000), taskName: "Lead apron safety check", priority: "high", departmentId: 4, departmentName: "Radiology", assignedUserId: actor.id }],
      [], [], [], [], [{ id: 4, name: "Radiology", active: true }], [],
      [{ id: 501, assignmentId: 77, departmentId: 4, status: "pending" }, { id: 502, assignmentId: 78, departmentId: 4, status: "completed" }],
      [{ id: 801, departmentId: 4, pointDelta: -10, createdAt: now }, { id: 802, departmentId: 4, pointDelta: -10, createdAt: now }],
    ]);
    state.db = fake.db;

    const dashboard = await getDashboard(admin);

    expect(dashboard.departmentAccountability).toEqual([expect.objectContaining({ departmentId: 4, score: 98, pointsLost: 2, dispatched: 2, completed: 1, pending: 1, awaitingReply: 0 })]);

    const reportFake = makeDb([
      [{ value: 1 }], [{ value: 1 }], [{ value: 1 }], [{ value: 1 }],
      [{ id: 77, status: "in_progress", dueAt: new Date(now.getTime() + 60_000), taskName: "Lead apron safety check", priority: "high", departmentId: 4, departmentName: "Radiology", assignedUserId: actor.id }],
      [], [], [], [], [{ id: 4, name: "Radiology", active: true }], [],
      [{ id: 501, assignmentId: 77, departmentId: 4, status: "pending" }, { id: 502, assignmentId: 78, departmentId: 4, status: "completed" }],
      [{ id: 801, departmentId: 4, pointDelta: -10, createdAt: now }, { id: 802, departmentId: 4, pointDelta: -10, createdAt: now }],
      [], [], [], [], [], [],
      [{ id: 4, name: "Radiology", active: true }], [], [], [{ departmentId: 4, departmentName: "Radiology", pointDelta: -10, reason: "No WhatsApp reply", createdAt: now }],
    ]);
    state.db = reportFake.db;
    const report = await getReports(admin);
    expect(report.whatsappSummary).toMatchObject({ dispatched: 2, completed: 1, pendingOrNoReply: 1, pointsLost: 2 });
    expect(report.whatsappAccountability).toEqual([expect.objectContaining({ departmentName: "Radiology", score: 98 })]);
    expect(report.departmentPointTrends).toEqual([expect.objectContaining({ departmentName: "Radiology", events: [expect.objectContaining({ pointDelta: -10, scoreAfter: 99 })] })]);
    expect(report.complianceSummary).toMatchObject({ hospitalRate: 50, dispatched: 2, completed: 1 });
    expect(report.responseTimeAnalytics).toMatchObject({ acknowledgedCount: 0, respondedCount: 0, averageAcknowledgementMinutes: null, averageResponseMinutes: null });
  });

  it("persists the super-admin-selected Saturday or Sunday weekly schedule into the created task and assignment", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    const base = { departmentId: 4, frequency: "weekly" as const, dueTime: "09:30", priority: "medium" as const, category: "Safety", checklist: [] };

    await createTask(superAdmin, { ...base, name: "Saturday generator check", weeklyDay: "saturday" });
    await createTask(superAdmin, { ...base, name: "Sunday attendance review", weeklyDay: "sunday" });

    const saturdayTask = fake.writes.find(write => (write.payload as any)?.name === "Saturday generator check")?.payload as any;
    const sundayTask = fake.writes.find(write => (write.payload as any)?.name === "Sunday attendance review")?.payload as any;
    const assignments = fake.writes.filter(write => (write.payload as any)?.dueAt instanceof Date).map(write => (write.payload as any).dueAt as Date);
    expect(saturdayTask.recurrenceRule).toBe("weekly:saturday");
    expect(sundayTask.recurrenceRule).toBe("weekly:sunday");
    expect(assignments.some(dueAt => dueAt.getDay() === 6)).toBe(true);
    expect(assignments.some(dueAt => dueAt.getDay() === 0)).toBe(true);
  });

  it("denies hospital administrators from creating department task schedules reserved for the super administrator", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(createTask(admin, { name: "Daily safety check", departmentId: 4, frequency: "daily", dueTime: "08:00", priority: "medium", category: "Safety", checklist: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies non-administrator managers from changing weighted task deductions", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(updateTaskScoringRule(actor, { ruleId: 1, weightTenths: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toEqual([]);
  });

  it("denies staff users from creating Version 2 risks, management actions, and linked follow-up tasks", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(createRisk(actor, { description: "Unresolved generator alarm", category: "Safety", departmentId: 4, likelihood: 3, impact: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createManagementAction(actor, { title: "Verify generator alarm", departmentId: 4, priority: "high" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createOperationalFollowUpTask(actor, { sourceType: "equipment", sourceId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toEqual([]);
  });

  it("generates the next daily assignment and surfaces it in My Day instead of prior-day completed work", async () => {
    const now = new Date("2026-08-21T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const recurringTask = { recurring: { id: 31, taskId: 6, lastGeneratedFor: "2026-08-20", nextRunAt: new Date("2026-08-21T09:00:00.000Z"), active: true }, task: { id: 6, departmentId: 4, assignedUserId: actor.id, dueTime: "09:00", frequency: "daily", active: true } };
      const generatedAssignment = { assignment: { id: 501, taskId: 6, departmentId: 4, assignedUserId: actor.id, dueAt: new Date("2026-08-21T09:00:00.000Z"), status: "not_started" }, task: { id: 6, name: "Portable oxygen check", priority: "high", frequency: "daily" }, departmentName: "Radiology" };
      const priorCompleted = { assignment: { id: 401, taskId: 7, departmentId: 4, assignedUserId: actor.id, dueAt: new Date("2026-08-20T09:00:00.000Z"), status: "completed" }, task: { id: 7, name: "Prior daily stock check", priority: "medium", frequency: "daily" }, departmentName: "Radiology" };
      const criticalCarryOver = { assignment: { id: 402, taskId: 8, departmentId: 4, assignedUserId: actor.id, dueAt: new Date("2026-08-20T08:00:00.000Z"), status: "overdue" }, task: { id: 8, name: "Emergency oxygen escalation", priority: "critical", frequency: "daily" }, departmentName: "Radiology" };
      const fake = makeDb([
        [], [recurringTask], [], [],
        [{ value: 1 }], [{ value: 1 }], [{ userId: actor.id, departmentId: 4, active: true }], [generatedAssignment, priorCompleted, criticalCarryOver],
      ]);
      state.db = fake.db;

      const cycle = await runOperationalCycle();
      const day = await getMyDay(actor);

      expect(cycle.generatedAssignments).toBe(1);
      expect(fake.writes.some(write => (write.payload as any)?.dueAt?.toISOString() === "2026-08-21T09:00:00.000Z")).toBe(true);
      expect(day.tasks).toHaveLength(2);
      expect(day.tasks.map(item => item.task.name)).toEqual(expect.arrayContaining(["Portable oxygen check", "Emergency oxygen escalation"]));
      expect(day.tasks.map(item => item.task.name)).not.toContain("Prior daily stock check");
      expect(day.tasks.find(item => item.task.name === "Portable oxygen check")?.assignment.dueAt.toISOString()).toBe("2026-08-21T09:00:00.000Z");
      expect(day.tasks.find(item => item.task.name === "Emergency oxygen escalation")?.effectiveStatus).toBe("overdue");
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates daily, weekly, and monthly WhatsApp task assignments only on each cadence's scheduled date", async () => {
    const now = new Date("2026-08-22T06:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const recurring = [
        { recurring: { id: 31, taskId: 6, lastGeneratedFor: "2026-08-21", nextRunAt: new Date("2026-08-22T09:00:00.000Z"), active: true }, task: { id: 6, departmentId: 4, assignedUserId: null, dueTime: "09:00", frequency: "daily", active: true } },
        { recurring: { id: 32, taskId: 7, lastGeneratedFor: "2026-08-15", nextRunAt: new Date("2026-08-22T10:00:00.000Z"), active: true }, task: { id: 7, departmentId: 4, assignedUserId: null, dueTime: "10:00", frequency: "weekly", active: true } },
        { recurring: { id: 33, taskId: 8, lastGeneratedFor: "2026-07-22", nextRunAt: new Date("2026-08-22T11:00:00.000Z"), active: true }, task: { id: 8, departmentId: 4, assignedUserId: null, dueTime: "11:00", frequency: "monthly", active: true } },
        { recurring: { id: 34, taskId: 9, lastGeneratedFor: "2026-08-15", nextRunAt: new Date("2026-08-29T10:00:00.000Z"), active: true }, task: { id: 9, departmentId: 4, assignedUserId: null, dueTime: "10:00", frequency: "weekly", active: true } },
      ];
      const fake = makeDb([[], recurring, []]);
      state.db = fake.db;

      const cycle = await runOperationalCycle();

      expect(cycle.generatedAssignments).toBe(3);
      const generatedTaskIds = fake.writes.filter(write => (write.payload as any)?.taskId).map(write => (write.payload as any).taskId);
      expect(generatedTaskIds).toEqual(expect.arrayContaining([6, 7, 8]));
      expect(generatedTaskIds).not.toContain(9);
    } finally {
      vi.useRealTimers();
    }
  });
});
