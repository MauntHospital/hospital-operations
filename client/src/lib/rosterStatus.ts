export type RosterTone = "success" | "warning" | "danger";

export function getRosterAvailability(
  attendance: string,
  staffName: string,
  shift: string
) {
  if (attendance === "present")
    return {
      label: "Available",
      tone: "success" as RosterTone,
      detail: `${staffName} is available for ${shift.toLowerCase()} duty.`,
    };
  if (attendance === "late")
    return {
      label: "At risk",
      tone: "warning" as RosterTone,
      detail: `${staffName} is late. Confirm arrival and coverage for this duty.`,
    };
  return {
    label: "Unavailable",
    tone: "danger" as RosterTone,
    detail: `${staffName} is unavailable. A replacement may be required.`,
  };
}

export function getRosterHandover(
  openHandover:
    | {
        shift: string;
        pendingTasks?: string | null;
        operationalNotes?: string | null;
      }
    | undefined,
  departmentName: string
) {
  if (openHandover)
    return {
      label: "Follow-up",
      tone: "warning" as RosterTone,
      detail: `${openHandover.shift} handover has unresolved items: ${openHandover.pendingTasks || openHandover.operationalNotes || "review handover details"}.`,
    };
  return {
    label: "Clear",
    tone: "success" as RosterTone,
    detail: `No unresolved handover items are recorded for ${departmentName}.`,
  };
}
