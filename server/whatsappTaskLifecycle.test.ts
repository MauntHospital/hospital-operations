import { describe, expect, it } from "vitest";
import {
  classifyDispatchTiming,
  hospitalDateAtTime,
  hospitalDateKey,
  initialHospitalDueAt,
  isAwaitingDepartmentReply,
  isTerminalDispatchStatus,
  lifecycleLabel,
  nextHospitalDueAt,
} from "./whatsappTaskLifecycle";

describe("WhatsApp command-center lifecycle rules", () => {
  it("constructs hospital-local task deadlines in Asia/Kathmandu", () => {
    expect(
      hospitalDateAtTime({ dateKey: "2026-08-24", time: "17:00" }).toISOString()
    ).toBe("2026-08-24T11:15:00.000Z");
    expect(hospitalDateKey(new Date("2026-08-24T18:30:00.000Z"))).toBe(
      "2026-08-25"
    );
  });

  it("keeps recurring task times on the hospital calendar", () => {
    const current = hospitalDateAtTime({ dateKey: "2026-08-24", time: "17:00" });
    expect(
      nextHospitalDueAt({ frequency: "daily", currentDueAt: current, dueTime: "17:00" }).toISOString()
    ).toBe("2026-08-25T11:15:00.000Z");
    expect(
      nextHospitalDueAt({ frequency: "monthly", currentDueAt: current, dueTime: "17:00" }).toISOString()
    ).toBe("2026-09-24T11:15:00.000Z");
  });

  it("selects the next configured weekly occurrence in hospital time", () => {
    const due = initialHospitalDueAt({
      frequency: "weekly",
      dueTime: "09:00",
      weeklyDay: "sunday",
      now: new Date("2026-08-22T10:00:00.000Z"),
    });
    expect(hospitalDateKey(due)).toBe("2026-08-23");
  });

  it("distinguishes late, overdue after grace, and escalated after the configured threshold", () => {
    const dueAt = new Date("2026-08-24T09:00:00.000Z");
    const base = { dueAt, gracePeriodMinutes: 30, escalationDelayMinutes: 60, status: "awaiting_reply" as const };
    expect(classifyDispatchTiming({ ...base, now: new Date("2026-08-24T09:10:00.000Z") })).toBe("late");
    expect(classifyDispatchTiming({ ...base, now: new Date("2026-08-24T09:31:00.000Z") })).toBe("overdue");
    expect(classifyDispatchTiming({ ...base, now: new Date("2026-08-24T10:01:00.000Z") })).toBe("escalated");
  });

  it("does not automatically overdue completed, excepted, cancelled, rescheduled, or manager-completed work", () => {
    for (const status of ["completed", "valid_exception", "cancelled", "rescheduled", "manager_completed"] as const) {
      expect(isTerminalDispatchStatus(status)).toBe(true);
      expect(classifyDispatchTiming({ dueAt: new Date(0), gracePeriodMinutes: 0, escalationDelayMinutes: 0, status, now: new Date() })).toBe("terminal");
    }
  });

  it("uses clear manager-facing lifecycle labels and awaiting-reply classification", () => {
    expect(lifecycleLabel("awaiting_reply")).toBe("Awaiting Reply");
    expect(lifecycleLabel("rework_required")).toBe("Rework Required");
    expect(lifecycleLabel("valid_exception")).toBe("Valid Exception");
    expect(isAwaitingDepartmentReply("awaiting_reply")).toBe(true);
    expect(isAwaitingDepartmentReply("under_review")).toBe(false);
  });
});
