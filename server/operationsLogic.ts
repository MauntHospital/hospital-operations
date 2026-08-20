import type { findingStatuses, taskStatuses } from "../drizzle/schema";

export type FindingStatus = (typeof findingStatuses)[number];
export type TaskStatus = (typeof taskStatuses)[number];

const issueCreatingStatuses: FindingStatus[] = [
  "not_available",
  "damaged",
  "expired",
  "low_stock",
  "under_maintenance",
  "missing",
  "wrong_location",
];

export function findingCreatesIssue(status: FindingStatus) {
  return issueCreatingStatuses.includes(status);
}

export function priorityForFinding(status: FindingStatus) {
  if (status === "expired") return "critical" as const;
  if (["damaged", "not_available", "under_maintenance", "missing"].includes(status)) return "high" as const;
  return "medium" as const;
}

export function operationalAssignmentStatus(status: TaskStatus, dueAt: Date, now = new Date()): TaskStatus {
  if (["completed", "failed", "skipped", "pending_approval"].includes(status)) return status;
  return dueAt.getTime() < now.getTime() ? "overdue" : status;
}

export function isMyDayAssignmentVisible(input: { frequency: string; priority: string; status: TaskStatus; dueAt: Date }, now = new Date()) {
  const status = operationalAssignmentStatus(input.status, input.dueAt, now);
  const sameOperatingDay = input.dueAt.getFullYear() === now.getFullYear() && input.dueAt.getMonth() === now.getMonth() && input.dueAt.getDate() === now.getDate();
  if (status === "completed") return sameOperatingDay;
  if (sameOperatingDay) return true;
  return input.priority === "critical";
}

export function expiryHealth(expiryDate: Date, now = new Date()) {
  const days = Math.ceil((expiryDate.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return "expired" as const;
  if (days <= 30) return "within_30_days" as const;
  if (days <= 60) return "within_60_days" as const;
  return "safe" as const;
}

export function computeNextDueDate(frequency: string, reference = new Date()) {
  const next = new Date(reference);
  if (frequency === "daily" || frequency === "every_shift") next.setDate(next.getDate() + 1);
  if (frequency === "weekly") next.setDate(next.getDate() + 7);
  if (frequency === "monthly") next.setMonth(next.getMonth() + 1);
  if (frequency === "quarterly") next.setMonth(next.getMonth() + 3);
  if (frequency === "yearly") next.setFullYear(next.getFullYear() + 1);
  return next;
}

export function initialTaskDueDate(frequency: string, dueTime: string, weeklyDay: "saturday" | "sunday" = "saturday", now = new Date()) {
  const [hour, minute] = dueTime.split(":").map(Number);
  const dueAt = new Date(now);
  dueAt.setHours(hour ?? 0, minute ?? 0, 0, 0);
  if (frequency !== "weekly") return dueAt;
  const targetDay = weeklyDay === "sunday" ? 0 : 6;
  const offset = (targetDay - now.getDay() + 7) % 7;
  dueAt.setDate(dueAt.getDate() + offset);
  if (dueAt.getTime() <= now.getTime()) dueAt.setDate(dueAt.getDate() + 7);
  return dueAt;
}

export function taskCompletionBlockReason(input: { requiredChecklistCount: number; completedChecklistCount: number }) {
  const remaining = input.requiredChecklistCount - input.completedChecklistCount;
  if (remaining > 0) return `Complete all required checklist items before submitting (${remaining} remaining).`;
  return null;
}
