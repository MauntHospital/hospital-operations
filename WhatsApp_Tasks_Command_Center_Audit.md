# WhatsApp Tasks Command Center Audit

## Baseline findings

The current module already preserves the intended manager-led manual WhatsApp boundary. A manager can prepare a message, record copying, confirm manual sending, record an acknowledgement or a coarse end-of-day outcome, review the outcome, and close the lifecycle. The system does not claim that WhatsApp delivered a message automatically, and this boundary will remain unchanged.

| Area | Current behavior | Upgrade required |
|---|---|---|
| Lifecycle | Dispatch states are `prepared`, `copied`, `sent`, `acknowledged`, `completed`, `pending`, `no_reply`, `excused`, `reviewed`, and `closed`. | Add a normalized task lifecycle with awaiting reply, replied, verification, rework, overdue, escalation, cancellation, rescheduling, valid exception, and manager-completed states. |
| Message flow | Preparation, copying, and manual send confirmation are separate. | Retain the separation, improve the professional message template, and expose clearer sent/awaiting-reply counts. |
| Replies | A manager records one coarse outcome and optional note. | Add structured reply fields, validation, review decisions, clarification/rework, and an immutable task timeline. |
| Evidence | Task definitions include evidence and approval flags, but the WhatsApp flow does not capture configurable evidence metadata. | Add task-configurable evidence support without forcing evidence for every task. |
| Scoring | `pending` and `no_reply` immediately deduct the priority weight once. | Make accountability decision-based so manager non-distribution, cancellation, valid exception, reschedule, direct manager completion, and reported operational problems do not automatically penalize a department. |
| Timing | All 68 imported active schedules currently use `17:00`. Date generation mixes UTC date keys with local `Date` calculations, and overdue logic starts immediately after `dueAt`. | Keep existing values until managers configure them, add due/grace/escalation settings, and centralize the hospital timezone/date calculation. |
| Scheduling | Recurring generation uses a task-and-due-time uniqueness safeguard and a scheduled operational cycle. | Preserve idempotency, add occurrence identity and per-task timing rules, and calculate late/overdue/escalated states without duplicate notifications. |
| Dashboard | Existing metrics are coarse and the overdue shortcut is implemented. | Add filterable lifecycle metrics, a priority-sorted action queue, compact responsive task cards, and useful zero states. |
| Accountability | Department scores are based on point events with a basic monthly scorecard. | Add assigned/completed/late/overdue/escalated/exception/compliance/trend indicators and monthly history. |
| Permissions and audit | Existing manager guards, lifecycle events, and audit entries are present. | Enforce state-specific manager actions server-side and record prior/new state, actor, role, and relevant structured details for every transition. |

## Preserved data and configuration

No current task, assignment, dispatch, lifecycle event, score event, department, or audit record will be deleted by this upgrade. The active catalogue contains 68 imported schedules across nine active departments. The current `Housekeeping` and `Housekeeping/Infection Control` records are separate active department definitions; they will remain separate unless an administrator explicitly changes the department configuration.

## Scheduling architecture decision

The application already exposes a protected scheduled operational-cycle endpoint and has a platform-managed background-job integration. The upgrade must either use that existing path for reliable deadline, grace, and escalation evaluation or retain a lighter on-demand calculation that only updates when a manager opens or acts in the app. The automatic option is needed to satisfy the requested escalation and deadline behavior reliably.
