import { describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { ensureManager, isAdmin, isManager } from "./operationsData";
import { computeNextDueDate, expiryHealth, findingCreatesIssue, initialTaskDueDate, isMyDayAssignmentVisible, operationalAssignmentStatus, priorityForFinding, taskCompletionBlockReason } from "./operationsLogic";

const baseUser: User = {
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

describe("hospital operational workflow logic", () => {
  it("creates a high-priority issue for a damaged safety finding", () => {
    expect(findingCreatesIssue("damaged")).toBe(true);
    expect(priorityForFinding("damaged")).toBe("high");
    expect(findingCreatesIssue("available")).toBe(false);
  });

  it("blocks task completion until every required finding and required evidence are recorded", () => {
    expect(taskCompletionBlockReason({ requiredChecklistCount: 3, completedChecklistCount: 2, evidenceRequired: false })).toMatch(/1 remaining/);
    expect(taskCompletionBlockReason({ requiredChecklistCount: 3, completedChecklistCount: 3, evidenceRequired: true })).toMatch(/evidence is required/i);
    expect(taskCompletionBlockReason({ requiredChecklistCount: 3, completedChecklistCount: 3, evidenceRequired: true, evidenceUrl: "https://evidence.example/task-1.jpg" })).toBeNull();
  });

  it("retains final task statuses but marks unfinished past-due work as overdue", () => {
    const past = new Date(Date.now() - 60_000);
    expect(operationalAssignmentStatus("not_started", past)).toBe("overdue");
    expect(operationalAssignmentStatus("completed", past)).toBe("completed");
    expect(operationalAssignmentStatus("pending_approval", past)).toBe("pending_approval");
  });

  it("classifies expiry risks against configured alert windows", () => {
    const now = new Date("2026-08-19T00:00:00.000Z");
    expect(expiryHealth(new Date("2026-08-18T00:00:00.000Z"), now)).toBe("expired");
    expect(expiryHealth(new Date("2026-09-10T00:00:00.000Z"), now)).toBe("within_30_days");
    expect(expiryHealth(new Date("2026-10-10T00:00:00.000Z"), now)).toBe("within_60_days");
    expect(expiryHealth(new Date("2026-12-31T00:00:00.000Z"), now)).toBe("safe");
  });

  it("computes the next recurring task date using the task frequency", () => {
    const reference = new Date("2026-08-19T08:00:00.000Z");
    expect(computeNextDueDate("daily", reference).toISOString()).toBe("2026-08-20T08:00:00.000Z");
    expect(computeNextDueDate("weekly", reference).toISOString()).toBe("2026-08-26T08:00:00.000Z");
  });

  it("anchors new weekly checks to the selected Saturday or Sunday", () => {
    const wednesday = new Date("2026-08-19T08:00:00.000Z");
    expect(initialTaskDueDate("weekly", "09:30", "saturday", wednesday).toISOString()).toBe("2026-08-22T09:30:00.000Z");
    expect(initialTaskDueDate("weekly", "09:30", "sunday", wednesday).toISOString()).toBe("2026-08-23T09:30:00.000Z");
  });

  it("shows daily work only for the current operating day while retaining unresolved critical work", () => {
    const now = new Date("2026-08-20T10:00:00.000Z");
    expect(isMyDayAssignmentVisible({ frequency: "daily", priority: "medium", status: "not_started", dueAt: new Date("2026-08-19T09:00:00.000Z") }, now)).toBe(false);
    expect(isMyDayAssignmentVisible({ frequency: "daily", priority: "medium", status: "not_started", dueAt: new Date("2026-08-20T11:00:00.000Z") }, now)).toBe(true);
    expect(isMyDayAssignmentVisible({ frequency: "daily", priority: "medium", status: "not_started", dueAt: new Date("2026-08-21T09:00:00.000Z") }, now)).toBe(false);
    expect(isMyDayAssignmentVisible({ frequency: "daily", priority: "medium", status: "completed", dueAt: new Date("2026-08-19T09:00:00.000Z") }, now)).toBe(false);
    expect(isMyDayAssignmentVisible({ frequency: "daily", priority: "critical", status: "overdue", dueAt: new Date("2026-08-19T09:00:00.000Z") }, now)).toBe(true);
  });

  it("allows operational managers while preventing staff from administrative workflow creation", () => {
    expect(isManager(baseUser)).toBe(false);
    expect(isAdmin(baseUser)).toBe(false);
    expect(() => ensureManager(baseUser)).toThrow(/supervisor or administrator/i);
    const supervisor = { ...baseUser, role: "supervisor" as const };
    const administrator = { ...baseUser, role: "hospital_admin" as const };
    expect(isManager(supervisor)).toBe(true);
    expect(isManager(administrator)).toBe(true);
    expect(isAdmin(administrator)).toBe(true);
    expect(() => ensureManager(supervisor)).not.toThrow();
  });
});
