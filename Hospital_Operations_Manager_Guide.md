# Hospital Operations Management System

## Manager Operating Guide

### Purpose of the application

This application is a **manager-led hospital operations and accountability workspace**. It is designed for an operating manager, hospital administrator, department head, or supervisor to organise department work, distribute task instructions manually through WhatsApp, record the department’s response at the end of the day, and review accountability in meetings.

Staff members do **not** need to log in or use the application. The manager sends the task message to the appropriate department WhatsApp group, receives the department’s reply there, and records the result in the system.

> The application does **not** connect to WhatsApp, read WhatsApp messages, or send WhatsApp messages automatically. It provides a prepared message that the manager copies and sends manually.

| The system manages | The manager does manually |
|---|---|
| Task schedules, departments, due dates, status registers, scorecards, point history, reports, and audit records | Copying task messages, sending them in WhatsApp, reading the department reply, and recording the outcome |

---

## The normal daily workflow

The application is intended to be used in a short management routine each day. First, the manager reviews the WhatsApp task register and checks which department tasks are due. The manager then prepares the message, sends it manually in the relevant department WhatsApp group, and confirms the send in the register. At the end of the day, the manager records whether the task was completed, remains pending, or received no reply.

| Step | Manager action | Result in the application |
|---|---|---|
| 1. Review due work | Open **WhatsApp tasks** and review today’s distributable tasks | The register lists active tasks due today |
| 2. Prepare message | Select **Prepare message** for a task | A department-specific WhatsApp message is displayed |
| 3. Send manually | Copy the message and send it in the correct department group | WhatsApp communication remains under the manager’s control |
| 4. Confirm distribution | Tick the confirmation stating that the message was sent, then select **Record as sent** | The register shows the task as sent and awaiting a reply |
| 5. Record end-of-day reply | Select **Record EOD reply** and choose the department outcome | The task outcome and scorecard are updated |
| 6. Review performance | Use **Control Tower** and **Reports** before meetings | Managers can review pending work, deductions, scores, and trends |

---

## Daily, weekly, and monthly task schedules

Every operating task belongs to one of three visible task cadences. The **Task cadence at a glance** section of the WhatsApp register displays a separate card for **Daily**, **Weekly**, and **Monthly** work. These cards remain visible even when there is no task due today.

| Cadence | What it means | When it appears in the manual distribution list |
|---|---|---|
| **Daily** | Routine checks that should be performed every operating day | Each day at the configured due time |
| **Weekly** | Department checks scheduled for a selected Saturday or Sunday | Only on the selected weekend day |
| **Monthly** | Periodic management work such as data collection and attendance checking | Only on its scheduled monthly date |

Each cadence card shows the number of active task plans, the number due today, and a preview of configured task names and departments. If a card says that no plan exists, the manager can open **Task schedules** and create a new plan.

### Creating or managing a schedule

The **Task schedules** workspace is used to create and maintain department task plans. A plan includes the department, task name, cadence, due time, priority, category, instructions, and checklist items. Weekly plans also include the selected Saturday or Sunday. Monthly plans are used for recurring management activities such as data collection or attendance review.

Only the designated super administrator can create and manage department schedule plans. Hospital administrators, department heads, and supervisors can use the manager workflow to distribute and record eligible tasks.

---

## WhatsApp task register

The **WhatsApp tasks** page is the main operational workspace. It contains the following sections.

| Section | What it shows | How it is used |
|---|---|---|
| Distribution metrics | Sent tasks, completed replies, pending/no-reply tasks, and tasks still to distribute | Gives an immediate view of today’s workflow |
| Task cadence cards | Daily, Weekly, and Monthly task plans with due-today counts | Clarifies which tasks belong to each cadence |
| Department accountability scorecard | Current-month department scores and point losses | Supports performance review meetings |
| Today’s manual WhatsApp distribution | Tasks due today, department, cadence, due time, WhatsApp status, and manager actions | Used to prepare messages and record outcomes |

### Sending a task message

When the manager selects **Prepare message**, the system produces a message containing the department name, task cadence, task name, due time, and an end-of-day response instruction. The manager copies the message, sends it manually to the department WhatsApp group, confirms that the message was sent, and records it in the application.

The task remains in **Awaiting department reply** status until its end-of-day outcome is recorded.

---

## End-of-day outcomes and department points

The manager records one of three outcomes for each sent WhatsApp task.

| Outcome | Meaning | Department score effect |
|---|---|---|
| **Completed** | The department confirmed that the work was completed | No deduction |
| **Pending** | The work is incomplete and the department supplied a reason or expected completion time | One point is deducted once |
| **No reply** | The department did not provide an end-of-day response | One point is deducted once |

Each department starts the current month at **100 points**. A pending or no-reply task creates a single one-point deduction. Recording the same unresolved task again does not apply an additional deduction. This prevents accidental double penalties.

The scorecard is a management indicator rather than an automatic punishment system. Managers should use it with the department’s explanation, workload, emergency conditions, and operational context during review meetings.

---

## Control Tower dashboard

The **Control Tower** is the high-level management dashboard. It brings together operational workload, overdue actions, issues, equipment status, and department accountability.

| Dashboard area | Purpose |
|---|---|
| Hospital status | Shows the overall operational condition and key workload figures |
| Today’s tasks | Summarises current task volume and recorded completion |
| Pending review | Highlights work requiring a management decision or follow-up |
| Overdue actions | Identifies overdue operational activity that needs attention |
| Critical issues | Shows urgent operational issues |
| Department accountability | Displays meeting-ready department scores from WhatsApp follow-up |

The dashboard is useful for a morning operational review, a mid-day follow-up, and an end-of-day management meeting.

---

## Reports and meetings

The **Reports** page is designed for formal management review. It contains a current-month WhatsApp accountability report with the following information:

| Report item | Management use |
|---|---|
| WhatsApp reply rate | Shows the proportion of sent tasks that have a completed reply |
| Pending/no-reply count | Identifies department follow-up required |
| Points lost this month | Shows the total unresolved-task deductions |
| Department scorecard | Compares department sent tasks, replies, pending work, deductions, and score |
| Department point trend | Shows the date, department, point change, running score, and recorded reason for each deduction |

The manager can export the scorecard as CSV or use **Print / Save PDF** for a meeting pack. The point-trend table is especially useful when a department asks why its score changed.

---

## Other operational modules

The application also retains supporting hospital operations modules. These are used by managers to maintain operational context around the WhatsApp accountability workflow.

| Module | What it supports |
|---|---|
| **Issues** | Recording, assigning, resolving, and reviewing operational problems |
| **Equipment** | Equipment readiness and maintenance visibility |
| **Inventory & expiry** | Stock levels, expiry monitoring, and operational risk visibility |
| **Roster** | Duty and attendance awareness for management planning |
| **Handover** | Continuity notes for unresolved work, incidents, shortages, and shift transitions |
| **Calendar** | A combined view of scheduled tasks, maintenance, expiry items, and duty coverage |
| **Operations setup** | Department management, escalation rules, and manager notification settings |

These modules do not require staff members to use the application. They provide the manager with the information needed to decide which department tasks to distribute and which operational risks need follow-up.

---

## Access model

The application is now configured as a **manager-only workspace**. Local staff account creation, staff password sign-in, and staff task-submission screens are retired from the active operating model.

| Role | Main responsibility in the application |
|---|---|
| **Super administrator** | Creates and maintains department task schedules; has full system oversight |
| **Hospital administrator** | Runs hospital-wide accountability and operational management |
| **Department head** | Distributes and follows up department WhatsApp tasks within permitted scope |
| **Supervisor** | Records and follows up operational task outcomes within permitted scope |

Department WhatsApp groups remain the communication channel for staff. The web application remains the manager’s register, scorecard, reporting tool, and operational record.

---

## Important operating rules

The following rules keep the workflow consistent and fair.

1. **Only record a task as sent after sending it in WhatsApp.** The confirmation step is intentionally manual.
2. **Record the department’s actual end-of-day response.** Use the note field to preserve an explanation, a delay reason, or an expected completion time.
3. **Use pending and no-reply outcomes carefully.** Each outcome deducts one point once; it should be applied after considering operational circumstances.
4. **Create weekly and monthly plans in Task schedules.** The cadence cards make missing plans visible, but they do not automatically invent a task plan.
5. **Review the scorecard with context.** A score is a follow-up signal. It should support discussion, improvement, and reliable service delivery.
6. **Use reports before management meetings.** Export the scorecard or print the report so the discussion is based on a shared record.

---

## Recommended operating rhythm

| Time | Recommended manager activity |
|---|---|
| Start of day | Review Control Tower and the WhatsApp register; distribute tasks due today |
| During the day | Monitor high-priority issues, equipment, inventory risks, and unanswered task messages |
| End of day | Record completed, pending, or no-reply outcomes; add meaningful notes where needed |
| Weekly review | Review weekly task plans, department score changes, unresolved issues, and handovers |
| Monthly meeting | Review reports, point trends, recurring delays, adherence to schedules, and improvement actions |

---

## What the application does not do

The application intentionally does not automate certain actions. This preserves manager control and avoids treating WhatsApp as a directly connected system.

| Not included | Explanation |
|---|---|
| Automatic WhatsApp sending | Messages are copied and sent manually by the manager |
| Automatic WhatsApp reply reading | The manager records the outcome after reviewing the department group response |
| Staff logins for daily task completion | Staff use their department WhatsApp group instead of the web application |
| Automatic evidence or photo collection | Evidence/photo requirements were removed from the manager-led workflow |
| Automatic score deductions without manager input | The manager chooses and records the end-of-day outcome |

---

## Quick reference

> **Create the plan in Task schedules → see it in Daily, Weekly, or Monthly cards → send it manually through WhatsApp when due → confirm it was sent → record the department’s end-of-day reply → review the scorecard and reports.**

This workflow gives hospital management a single operational record while keeping daily department communication simple and familiar through WhatsApp.
