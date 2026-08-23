# Hospital Operations: Pre-Launch Checklist

This checklist should be completed by the operations manager or super administrator **before the system becomes the working source of truth**. It is designed for the current manager-led model: managers administer tasks and record department WhatsApp responses; staff do not sign in to the application.

## 1. Confirm ownership and access

| Check                | Required action                                                                                                                           | Ready when                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Manager roles        | Confirm that every active user has the correct manager role: super administrator, hospital administrator, department head, or supervisor. | Users can access only the departments and management functions they are responsible for.            |
| Super administrator  | Identify one accountable super administrator and one named backup.                                                                        | The designated people can maintain departments, schedules, scoring rules, and manager access.       |
| Department ownership | Confirm each department has a current operational owner.                                                                                  | No department is left without a manager who can review tasks, alerts, risks, and WhatsApp outcomes. |
| Access verification  | Sign in using each manager role that will be used in production.                                                                          | Role-appropriate navigation and data are visible; non-manager access is not relied upon.            |

> Do not share one manager account among multiple people. Named access keeps task, alert, risk, and action history attributable.

## 2. Establish the operating baseline

| Check                  | Required action                                                                  | Ready when                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Departments            | Review department names, active status, and manager ownership.                   | The active department list matches the hospital’s operating structure.                               |
| Task schedules         | Review Daily, Weekly, Monthly, and Emergency task plans by department.           | Every recurring task has a clear owner, priority, checklist, cadence, and intended due day.          |
| Scoring rules          | Confirm priority weights and point deductions with hospital leadership.          | Managers understand how completed, pending, no-reply, and excused outcomes affect department scores. |
| Excused outcomes       | Agree who can approve an excused task and what constitutes an acceptable reason. | Excused outcomes are used only with a recorded reason and do not generate an unintended deduction.   |
| Operational thresholds | Review the Control Tower status thresholds and attention signals.                | Leadership agrees on what the system should treat as normal, attention-needed, or critical.          |

## 3. Set up the daily WhatsApp accountability routine

The system deliberately **does not send WhatsApp messages automatically**. A manager must prepare the task, copy the approved message, send it to the correct department group, then record the lifecycle in the register.

| Step                 | Manager action                                                                                                                                                                         | Minimum control                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Morning distribution | Review the current-day Daily, Weekly, Monthly, and Emergency cards; prepare eligible tasks; copy the message; send it manually to the department group; then record send confirmation. | Send only once per assignment and use the correct department group.                                                   |
| Acknowledgement      | Record whether the department acknowledged the task.                                                                                                                                   | Do not represent acknowledgement as completion.                                                                       |
| End-of-day review    | Record **completed**, **pending**, **no reply**, or **excused** from the department’s reply.                                                                                           | Add the excused reason where applicable; do not infer a completed outcome without a response or manager confirmation. |
| Manager-owned work   | Complete a department-related task directly only when it is the operations manager’s work and has not entered the WhatsApp workflow.                                                   | Never bypass an existing WhatsApp lifecycle through direct completion.                                                |
| Closure              | Review and close the completed lifecycle when the operational outcome is confirmed.                                                                                                    | Ensure no pending or no-reply item is silently left open.                                                             |

## 4. Load and verify roster information

| Check             | Required action                                                                        | Ready when                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Initial roster    | Create shifts manually or use the roster CSV import template.                          | Each row has a valid department, staff member, date, start time, end time, and duty details. |
| Import review     | Resolve every import error before treating the upload as final.                        | No duplicate or invalid rows remain; start time is earlier than end time.                    |
| Coverage review   | Check current coverage, availability indicators, attendance exceptions, and handovers. | Managers can identify uncovered shifts and unresolved handover items.                        |
| Ongoing ownership | Name the person responsible for updating schedule changes and attendance exceptions.   | Roster data stays current instead of becoming a historical snapshot.                         |

## 5. Start with a clean operational queue

| Area                             | Required pre-launch review                                                                                 | Ready when                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Control Tower                    | Review priority, overdue, and attention queues.                                                            | Every item has an accountable manager or a documented reason for monitoring.          |
| Overdue work                     | Review the ten currently valid overdue tasks one by one through the manager-review controls.               | Each is completed, appropriately dispositioned, or actively owned with a next action. |
| Alerts                           | Assign an owner for each open alert, then acknowledge or resolve it with handling notes.                   | No open alert has an unknown owner.                                                   |
| Risks and management actions     | Review open risks and actions, due dates, owners, and current status.                                      | High-priority items have a named owner and a credible next step.                      |
| Issues, equipment, and inventory | Confirm active issues, maintenance items, stock/expiry findings, and follow-ups are correctly represented. | Operations leaders agree the queue reflects current conditions.                       |

## 6. Conduct a short production readiness drill

Before the first live operating day, run one controlled department-level scenario. Create or select a non-clinical task, prepare and manually send the WhatsApp message, record acknowledgement and end-of-day outcome, then verify the result in the WhatsApp register, Control Tower, reports, and department scorecard. Also test one roster update and one alert ownership/acknowledgement action.

The drill is successful when the expected owner, status, audit history, and dashboard result are all visible without manual database changes.

## 7. Agree on the first-week governance cadence

| Cadence | Recommended manager activity                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------- |
| Daily   | Send and record task outcomes; review the Control Tower; assign and acknowledge alerts; inspect overdue work.        |
| Weekly  | Review department scorecards, unresolved handovers, open issues, risks, and actions with department heads.           |
| Monthly | Review task schedules and weights, roster quality, recurring trends, repeat problems, and threshold appropriateness. |

## Known boundaries at launch

The application is ready for manager-led operational use. Its deliberate boundaries should be understood before launch: WhatsApp delivery is manual, the calendar is a read-only planning view rather than an in-place editor, and the application currently has no record-export feature. The CSV function is an **import** workflow and includes a downloadable template.

For audit evidence and detailed repair history, refer to `Full_System_Audit_Report.md` within the project.
