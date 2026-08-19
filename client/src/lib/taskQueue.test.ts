import { describe, expect, it } from "vitest";
import { filterAndSortOperationalTasks } from "./taskQueue";

const tasks = [
  { id: 1, priority: "medium" as const, status: "not_started", effectiveStatus: "not_started", dueAt: "2026-08-19T11:00:00.000Z" },
  { id: 2, priority: "critical" as const, status: "overdue", effectiveStatus: "overdue", dueAt: "2026-08-19T09:00:00.000Z" },
  { id: 3, priority: "high" as const, status: "in_progress", effectiveStatus: "in_progress", dueAt: "2026-08-19T10:00:00.000Z" },
];

describe("filterAndSortOperationalTasks", () => {
  it("returns only the selected priority", () => {
    expect(filterAndSortOperationalTasks(tasks, { priorityFilter: "high", statusFilter: "all", sortBy: "due_soon" }).map(task => task.id)).toEqual([3]);
  });

  it("isolates overdue tasks and places them first when requested", () => {
    expect(filterAndSortOperationalTasks(tasks, { priorityFilter: "all", statusFilter: "overdue", sortBy: "due_soon" }).map(task => task.id)).toEqual([2]);
    expect(filterAndSortOperationalTasks(tasks, { priorityFilter: "all", statusFilter: "all", sortBy: "overdue_first" }).map(task => task.id)).toEqual([2, 3, 1]);
  });

  it("sorts the queue by operational priority", () => {
    expect(filterAndSortOperationalTasks(tasks, { priorityFilter: "all", statusFilter: "all", sortBy: "priority" }).map(task => task.id)).toEqual([2, 3, 1]);
  });
});
