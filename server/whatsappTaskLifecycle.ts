import type { whatsappDispatchStatuses } from "../drizzle/schema";

export const HOSPITAL_TIMEZONE = "Asia/Kathmandu";

export type WhatsAppDispatchStatus =
  (typeof whatsappDispatchStatuses)[number];

export const terminalDispatchStatuses: WhatsAppDispatchStatus[] = [
  "completed",
  "valid_exception",
  "cancelled",
  "rescheduled",
  "manager_completed",
  "closed",
];

const awaitingReplyStatuses: WhatsAppDispatchStatus[] = [
  "sent",
  "awaiting_reply",
  "acknowledged",
  "overdue",
  "escalated",
];

export function isTerminalDispatchStatus(status: WhatsAppDispatchStatus) {
  return terminalDispatchStatuses.includes(status);
}

export function isAwaitingDepartmentReply(status: WhatsAppDispatchStatus) {
  return awaitingReplyStatuses.includes(status);
}

export function lifecycleLabel(status?: WhatsAppDispatchStatus | null) {
  if (!status) return "Scheduled";
  const labels: Record<WhatsAppDispatchStatus, string> = {
    prepared: "Prepared",
    copied: "Prepared",
    sent: "Awaiting Reply",
    awaiting_reply: "Awaiting Reply",
    acknowledged: "Awaiting Reply",
    replied: "Replied",
    under_review: "Under Review",
    rework_required: "Rework Required",
    replied_again: "Replied Again",
    verified: "Verified",
    completed: "Completed",
    pending: "Legacy Pending",
    no_reply: "Legacy No Reply",
    excused: "Legacy Excused",
    valid_exception: "Valid Exception",
    overdue: "Overdue",
    escalated: "Escalated",
    cancelled: "Cancelled",
    rescheduled: "Rescheduled",
    manager_completed: "Manager Completed",
    reviewed: "Legacy Reviewed",
    closed: "Closed",
  };
  return labels[status];
}

export function classifyDispatchTiming(input: {
  dueAt: Date;
  gracePeriodMinutes: number;
  escalationDelayMinutes: number;
  status: WhatsAppDispatchStatus;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (isTerminalDispatchStatus(input.status)) return "terminal" as const;
  const graceEndsAt = new Date(
    input.dueAt.getTime() + Math.max(0, input.gracePeriodMinutes) * 60_000
  );
  const escalatesAt = new Date(
    input.dueAt.getTime() + Math.max(0, input.escalationDelayMinutes) * 60_000
  );
  if (now >= escalatesAt) return "escalated" as const;
  if (now >= graceEndsAt) return "overdue" as const;
  if (now > input.dueAt) return "late" as const;
  return "on_time" as const;
}

type HospitalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function formatParts(date: Date, timeZone = HOSPITAL_TIMEZONE): HospitalDateParts {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(values.find(item => item.type === type)?.value ?? 0);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

export function hospitalDateKey(
  date = new Date(),
  timeZone = HOSPITAL_TIMEZONE
) {
  const parts = formatParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day
  ).padStart(2, "0")}`;
}

export function hospitalMonthKey(
  date = new Date(),
  timeZone = HOSPITAL_TIMEZONE
) {
  return hospitalDateKey(date, timeZone).slice(0, 7);
}

export function hospitalWeekday(
  date = new Date(),
  timeZone = HOSPITAL_TIMEZONE
) {
  const key = hospitalDateKey(date, timeZone);
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

export function hospitalDateAtTime(input: {
  dateKey: string;
  time: string;
  timeZone?: string;
}) {
  const [year, month, day] = input.dateKey.split("-").map(Number);
  const [hour, minute] = input.time.split(":").map(Number);
  const timeZone = input.timeZone ?? HOSPITAL_TIMEZONE;
  const assumedUtc = Date.UTC(year!, month! - 1, day!, hour ?? 0, minute ?? 0, 0);
  const localAtAssumedUtc = formatParts(new Date(assumedUtc), timeZone);
  const timezoneOffset =
    Date.UTC(
      localAtAssumedUtc.year,
      localAtAssumedUtc.month - 1,
      localAtAssumedUtc.day,
      localAtAssumedUtc.hour,
      localAtAssumedUtc.minute,
      localAtAssumedUtc.second
    ) - assumedUtc;
  return new Date(assumedUtc - timezoneOffset);
}

export function formatHospitalDateTime(
  date: Date,
  timeZone = HOSPITAL_TIMEZONE
) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function nextHospitalDueAt(input: {
  frequency: string;
  currentDueAt: Date;
  dueTime: string;
  timeZone?: string;
}) {
  const currentKey = hospitalDateKey(input.currentDueAt, input.timeZone);
  const nextCalendarDate = new Date(`${currentKey}T12:00:00Z`);
  if (input.frequency === "daily" || input.frequency === "every_shift")
    nextCalendarDate.setUTCDate(nextCalendarDate.getUTCDate() + 1);
  else if (input.frequency === "weekly")
    nextCalendarDate.setUTCDate(nextCalendarDate.getUTCDate() + 7);
  else if (input.frequency === "monthly")
    nextCalendarDate.setUTCMonth(nextCalendarDate.getUTCMonth() + 1);
  else if (input.frequency === "quarterly")
    nextCalendarDate.setUTCMonth(nextCalendarDate.getUTCMonth() + 3);
  else if (input.frequency === "yearly")
    nextCalendarDate.setUTCFullYear(nextCalendarDate.getUTCFullYear() + 1);
  return hospitalDateAtTime({
    dateKey: nextCalendarDate.toISOString().slice(0, 10),
    time: input.dueTime,
    timeZone: input.timeZone,
  });
}

export function initialHospitalDueAt(input: {
  frequency: string;
  dueTime: string;
  weeklyDay?: "saturday" | "sunday";
  now?: Date;
  timeZone?: string;
}) {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? HOSPITAL_TIMEZONE;
  let dueAt = hospitalDateAtTime({
    dateKey: hospitalDateKey(now, timeZone),
    time: input.dueTime,
    timeZone,
  });
  if (input.frequency === "weekly") {
    const target = input.weeklyDay === "sunday" ? 0 : 6;
    const current = hospitalWeekday(now, timeZone);
    const offset = (target - current + 7) % 7;
    const date = new Date(`${hospitalDateKey(now, timeZone)}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    dueAt = hospitalDateAtTime({
      dateKey: date.toISOString().slice(0, 10),
      time: input.dueTime,
      timeZone,
    });
  }
  if (dueAt <= now) return nextHospitalDueAt({
    frequency: input.frequency,
    currentDueAt: dueAt,
    dueTime: input.dueTime,
    timeZone,
  });
  return dueAt;
}
