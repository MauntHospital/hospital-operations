import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));

vi.mock("./db", () => ({
  getDb: async () => state.db,
}));

import { completeTask, saveChecklistResult } from "./operationsData";

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
});
