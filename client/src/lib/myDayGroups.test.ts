import { describe, expect, it } from "vitest";
import { groupMyDayTasks, type MyDayTask } from "./myDayGroups";

const task = (
  id: number,
  frequency: string,
  priority: string,
  name: string
): MyDayTask => ({
  assignment: {
    id,
    dueAt: new Date(`2026-08-${20 + id}T09:00:00Z`),
    status: "not_started",
  },
  task: { name, frequency, priority, category: "Operations" },
  departmentName: "Radiology",
  effectiveStatus: "not_started",
});

describe("groupMyDayTasks", () => {
  it("separates critical response work, daily checks, weekly weekend checks, and monthly administration", () => {
    const groups = groupMyDayTasks([
      task(1, "daily", "critical", "Emergency trolley readiness"),
      task(2, "daily", "medium", "X-ray room opening check"),
      task(3, "weekly", "medium", "Weekend stock reconciliation"),
      task(4, "monthly", "low", "Monthly attendance checking"),
    ]);

    expect(groups.map(group => [group.key, group.tasks.length])).toEqual([
      ["emergency", 1],
      ["daily", 1],
      ["weekly", 1],
      ["monthly", 1],
      ["completed", 0],
    ]);
    expect(groups.find(group => group.key === "weekly")?.description).toMatch(
      /Saturday or Sunday/
    );
    expect(groups.find(group => group.key === "monthly")?.description).toMatch(
      /Data collection/
    );
  });

  it("moves completed work out of active emergency and daily task cards", () => {
    const completedEmergency = {
      ...task(5, "daily", "critical", "Emergency trolley check"),
      effectiveStatus: "completed",
    };
    const groups = groupMyDayTasks([
      completedEmergency,
      task(6, "daily", "medium", "Daily room check"),
    ]);

    expect(groups.find(group => group.key === "emergency")?.tasks).toHaveLength(
      0
    );
    expect(groups.find(group => group.key === "daily")?.tasks).toHaveLength(1);
    expect(groups.find(group => group.key === "completed")?.tasks).toEqual([
      completedEmergency,
    ]);
  });
});
