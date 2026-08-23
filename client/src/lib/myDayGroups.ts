export type MyDayTask = {
  assignment: { id: number; dueAt: Date | string; status: string };
  task: {
    name: string;
    frequency: string;
    category?: string | null;
    priority: string;
  };
  departmentName: string;
  effectiveStatus: string;
};

export type MyDayGroupKey =
  | "emergency"
  | "daily"
  | "weekly"
  | "monthly"
  | "completed";

export type MyDayTaskGroup = {
  key: MyDayGroupKey;
  label: string;
  description: string;
  tasks: MyDayTask[];
};

const groupOrder: MyDayGroupKey[] = [
  "emergency",
  "daily",
  "weekly",
  "monthly",
  "completed",
];

function groupForTask(item: MyDayTask): MyDayGroupKey {
  const text = `${item.task.name} ${item.task.category ?? ""}`.toLowerCase();
  if (item.effectiveStatus === "completed") return "completed";
  if (item.task.priority === "critical" || text.includes("emergency"))
    return "emergency";
  if (item.task.frequency === "weekly") return "weekly";
  if (item.task.frequency === "monthly") return "monthly";
  return "daily";
}

export function groupMyDayTasks(tasks: MyDayTask[]): MyDayTaskGroup[] {
  const groups: Record<MyDayGroupKey, MyDayTaskGroup> = {
    emergency: {
      key: "emergency",
      label: "Emergency tasks",
      description: "Critical response and readiness tasks",
      tasks: [],
    },
    daily: {
      key: "daily",
      label: "Daily checks",
      description: "Routine daily and shift-based checks",
      tasks: [],
    },
    weekly: {
      key: "weekly",
      label: "Weekly checks",
      description: "Weekend checks scheduled for Saturday or Sunday",
      tasks: [],
    },
    monthly: {
      key: "monthly",
      label: "Monthly administration",
      description: "Data collection, attendance checks, and monthly records",
      tasks: [],
    },
    completed: {
      key: "completed",
      label: "Completed tasks",
      description: "Tasks completed during the current operating day",
      tasks: [],
    },
  };
  for (const task of tasks) groups[groupForTask(task)].tasks.push(task);
  return groupOrder.map(key => ({
    ...groups[key],
    tasks: [...groups[key].tasks].sort(
      (a, b) =>
        new Date(a.assignment.dueAt).getTime() -
        new Date(b.assignment.dueAt).getTime()
    ),
  }));
}
