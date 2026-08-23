export type OperationalTaskRow = {
  priority: "critical" | "high" | "medium" | "low";
  status: string;
  effectiveStatus?: string;
  dueAt: Date | string;
};

export type TaskQueueOptions = {
  priorityFilter: string;
  statusFilter: string;
  sortBy: string;
};

const priorityWeight: Record<OperationalTaskRow["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function filterAndSortOperationalTasks<T extends OperationalTaskRow>(
  tasks: T[],
  options: TaskQueueOptions
) {
  return [...tasks]
    .filter(task => {
      const status = task.effectiveStatus ?? task.status;
      const matchesPriority =
        options.priorityFilter === "all" ||
        task.priority === options.priorityFilter;
      const matchesStatus =
        options.statusFilter === "all" ||
        (options.statusFilter === "overdue"
          ? status === "overdue"
          : status !== "overdue");
      return matchesPriority && matchesStatus;
    })
    .sort((left, right) => {
      if (options.sortBy === "priority")
        return priorityWeight[right.priority] - priorityWeight[left.priority];
      if (options.sortBy === "overdue_first")
        return (
          Number((right.effectiveStatus ?? right.status) === "overdue") -
            Number((left.effectiveStatus ?? left.status) === "overdue") ||
          new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime()
        );
      return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
    });
}
