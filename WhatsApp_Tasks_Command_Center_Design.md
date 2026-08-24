# WhatsApp Tasks Command Center Design

## Operating boundary

The module remains a **manager-led accountability system using manual WhatsApp communication**. Preparing, copying, opening WhatsApp, and confirming a send are separate actions. The application records a send only when a manager explicitly confirms it; it never claims delivery, read receipt, or reply capture from WhatsApp itself.

## Lifecycle model

The authoritative lifecycle will be stored on the dispatch record for department-distributed work, with assignment status retained for cross-module operational state. The previous dispatch states will be migrated into their nearest equivalent without deleting existing events.

| Lifecycle state | Meaning | Permitted next actions |
|---|---|---|
| Scheduled | Assignment exists and has not been distributed. | Prepare Message, Complete Myself, Cancel, Reschedule. |
| Prepared | Message text is ready but has not been sent. | Copy Message, Open WhatsApp, Confirm Sent, Cancel. |
| Sent / Awaiting Reply | Manager confirmed manual send. | Record Reply, Mark Valid Exception, Escalate, Cancel, Reschedule. |
| Replied | Manager recorded a structured department response. | Verify, Request Clarification, Reject for Rework, Escalate. |
| Under Review | A reply is waiting for a manager decision. | Verify, Request Clarification, Reject for Rework, Escalate. |
| Rework Required | The response is insufficient or rejected. | Record Replied Again, Escalate, Cancel, Reschedule. |
| Verified | Manager accepted the response. | Complete. |
| Completed | Verified department work is complete. | View details and audit history. |
| Overdue | Deadline plus grace period passed without a valid terminal or exception state. | Escalate, Record Reply, Mark Valid Exception, Cancel, Reschedule. |
| Escalated | An overdue task reached its configured escalation point or a manager escalated it. | Record Reply, Verify, resolve with valid exception, cancel, or reschedule. |
| Manager Completed | Manager performed the work directly; no WhatsApp dispatch or department score impact. | View audit history. |
| Valid Exception | A manager accepted a documented operational exception; no automatic penalty. | View audit history or reschedule. |
| Cancelled / Rescheduled | Terminal original record retained for audit. | View audit history; a reschedule creates a linked successor assignment. |

## Time and automatic processing

The hospital operating timezone is **Asia/Kathmandu (UTC+5:45)**. All persistent timestamps remain UTC and all due-date construction, daily scope, weekly/monthly occurrence selection, message rendering, grace-period checks, and dashboard labels will use one timezone-aware conversion utility.

The existing protected operational cycle will remain the only background mechanism. It will run idempotently at a five-minute cadence after deployment, generate one assignment per schedule occurrence, calculate `Late`, `Overdue`, and `Escalated` from task-specific timing, and avoid duplicate lifecycle events and duplicate notifications. No in-process timers are introduced.

| Timing field | Stored on schedule | Default | Meaning |
|---|---|---:|---|
| Due time | Yes | Existing schedule value | Hospital-local time at which the task is due. |
| Grace period | Yes | 30 minutes | Interval after due time before `Overdue`. |
| Escalation delay | Yes | 60 minutes after due time | Interval after due time before automatic escalation. |
| Verification required | Yes | Existing approval flag | Whether a reply must be accepted before completion. |
| Evidence required | Yes | Existing evidence flag | Whether supporting evidence metadata is required for a response. |

The existing imported schedule values remain unchanged until an authorized manager edits them. The design exposes task-specific configuration rather than assuming all tasks occur at 17:00.

## Structured response and evidence model

Each manager-recorded department reply will capture response status, findings, action taken, responsible staff, completion time, non-completion reason, notes, and optional task-specific fields. A response may be revised through a new immutable response version after clarification or rework; prior content remains in history.

Evidence is optional by default and required only where a task schedule requires it. Evidence metadata stores the storage key, accessible URL, file type, original name, and uploader. Files are stored outside the database using the existing secure storage service.

## Fair accountability scoring

Scoring is evaluated after a manager decision, not merely after a coarse end-of-day label. Each score decision records its accountable party, outcome, rule, resulting point delta, and reason. A department is not penalized when the manager did not distribute the task, a valid exception is accepted, a task is cancelled or rescheduled, a manager completes it directly, or a department reports an operational problem that the manager accepts as an exception. Penalties apply only to configured department-accountability outcomes such as verified late completion, unexcused non-completion, or failure after escalation.

## Permissions and auditability

All state changes remain server-authorized. Manager roles can distribute, record external WhatsApp responses, review, verify, request rework, cancel, reschedule, and escalate. Administrators control schedules and scoring rules. Department score changes remain manager-governed. Every transition records actor, actor role, previous state, next state, timestamp, relevant structured fields, and any resulting score decision. Historical events remain append-only.

## Manager experience

The rebuilt page begins with clickable lifecycle metrics, followed by a priority-sorted **Manager Action Required** queue. The default list focuses on action-required work and provides department, priority, cadence, status, date, assignment, overdue, and escalation filters, text search, sorting, and pagination. Desktop uses a dense table; mobile uses tap-friendly task cards. Empty states explain that work is resolved rather than displaying unexplained zeros.

Department scorecards will display score, assigned, completed, late, overdue, escalated, valid exceptions, compliance, trend, and meeting status. Monthly score history and a department selector remain available for meeting review.
