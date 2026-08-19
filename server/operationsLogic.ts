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

export function taskCompletionBlockReason(input: { requiredChecklistCount: number; completedChecklistCount: number; evidenceRequired: boolean; evidenceUrl?: string }) {
  const remaining = input.requiredChecklistCount - input.completedChecklistCount;
  if (remaining > 0) return `Complete all required checklist items before submitting (${remaining} remaining).`;
  if (input.evidenceRequired && !input.evidenceUrl) return "Evidence is required for this task.";
  return null;
}
