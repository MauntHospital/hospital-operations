import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));

vi.mock("./db", () => ({
  getDb: async () => state.db,
}));

vi.mock("./localAuth", () => ({
  normalizeUsername: (value: string) => value.trim().toLowerCase(),
  passwordPolicyError: (value: string) => value.length >= 12 ? null : "Use at least 12 characters for the temporary password.",
  hashPassword: async () => "scrypt$test$hash",
  verifyPassword: async (value: string) => value === "AValidPassword2026",
}));

import { authenticateStaffAccount, completeTask, createTask, getMyDay, manageStaff, resetStaffPassword, runOperationalCycle, saveChecklistResult } from "./operationsData";

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
    update: () => ({ set: () => ({ where: async () => ({}) }) }),
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

  it("lets a manager provision a staff profile with a hashed local account credential", async () => {
    const fake = makeDb([]);
    state.db = fake.db;

    const result = await manageStaff(admin, { name: "Priya Nair", departmentId: 4, role: "staff", username: "Priya.Nair", temporaryPassword: "AValidPassword2026" });

    expect(result).toEqual({ id: 501, username: "priya.nair" });
    expect(fake.writes.some(write => (write.payload as any)?.username === "priya.nair" && (write.payload as any)?.passwordHash === "scrypt$test$hash")).toBe(true);
  });

  it("denies non-administrators from provisioning accounts or resetting staff passwords", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(manageStaff(actor, { name: "Priya Nair", departmentId: 4, role: "staff", username: "priya.nair", temporaryPassword: "AValidPassword2026" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(resetStaffPassword(actor, { userId: 11, temporaryPassword: "AValidPassword2026" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("verifies an active local account, supports a password reset, and denies inactive account access", async () => {
    const localUser = { ...actor, id: 11, openId: "staff-11", name: "Priya Nair" };
    const active = makeDb([[{ user: localUser, profile: { active: true }, credential: { passwordHash: "scrypt$test$hash", mustChangePassword: true } }]]);
    state.db = active.db;
    await expect(authenticateStaffAccount({ username: "PRIYA.NAIR", password: "AValidPassword2026" })).resolves.toMatchObject({ user: localUser, mustChangePassword: true });

    const reset = makeDb([[{ userId: 11, passwordHash: "scrypt$test$hash" }]]);
    state.db = reset.db;
    await expect(resetStaffPassword(admin, { userId: 11, temporaryPassword: "AValidPassword2026" })).resolves.toEqual({ success: true });

    const inactive = makeDb([[{ user: localUser, profile: { active: false }, credential: { passwordHash: "scrypt$test$hash", mustChangePassword: false } }]]);
    state.db = inactive.db;
    await expect(authenticateStaffAccount({ username: "priya.nair", password: "AValidPassword2026" })).rejects.toMatchObject({ message: expect.stringMatching(/invalid account name or password/i) });
  });

  it("returns a staff member's daily task queue after local-account authentication", async () => {
    const staffTask = { assignment: { id: 88, taskId: 6, departmentId: 4, assignedUserId: actor.id, dueAt: new Date("2026-08-20T11:00:00.000Z"), status: "not_started" }, task: { id: 6, name: "Portable oxygen check", priority: "high" }, departmentName: "Radiology" };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ userId: actor.id, departmentId: 4, active: true }],
      [staffTask],
    ]);
    state.db = fake.db;

    const day = await getMyDay(actor);

    expect(day.counts.total).toBe(1);
    expect(day.tasks[0]).toMatchObject({ task: { name: "Portable oxygen check" }, departmentName: "Radiology" });
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

  it("generates the next daily assignment and surfaces it in My Day instead of prior-day completed work", async () => {
    const now = new Date("2026-08-21T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const recurringTask = { recurring: { id: 31, taskId: 6, lastGeneratedFor: "2026-08-20", active: true }, task: { id: 6, departmentId: 4, assignedUserId: actor.id, dueTime: "09:00", frequency: "daily", active: true } };
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
});
