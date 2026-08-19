import { describe, expect, it } from "vitest";
import { getRosterAvailability, getRosterHandover } from "./rosterStatus";

describe("roster status indicators", () => {
  it("labels present, late, and absent staff with operationally meaningful availability states", () => {
    expect(getRosterAvailability("present", "Dr. Wong", "Day")).toMatchObject({ label: "Available", tone: "success" });
    expect(getRosterAvailability("late", "Alex Morgan", "Day")).toMatchObject({ label: "At risk", tone: "warning" });
    expect(getRosterAvailability("absent", "Priya Nair", "Night")).toMatchObject({ label: "Unavailable", tone: "danger" });
  });

  it("surfaces unresolved handover content while retaining a clear state for departments without one", () => {
    expect(getRosterHandover({ shift: "Night to Day", pendingTasks: "Confirm trolley seal" }, "Emergency")).toMatchObject({ label: "Follow-up", tone: "warning" });
    expect(getRosterHandover(undefined, "Radiology")).toEqual({ label: "Clear", tone: "success", detail: "No unresolved handover items are recorded for Radiology." });
  });
});
