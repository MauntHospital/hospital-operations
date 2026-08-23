# Production-Readiness Drill: Step-by-Step Guide

Use this one-time, controlled drill before the first live operating day. The purpose is to prove that a manager can move a real operational task through the application, the manual WhatsApp hand-off, the end-of-day outcome, and the related management views without relying on a developer or database edit.

> **Safety boundary:** Use a harmless, non-clinical task. Do not use patient information, emergency clinical instructions, or a task whose failure could affect patient safety. For the WhatsApp step, use a designated test group or clearly label the message as a drill if sending it to a live department group.

## Before beginning

| Item                     | What to confirm                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Person running the drill | You are signed in with a manager role: super administrator, hospital administrator, department head, or supervisor.                               |
| Test department          | Choose one department with an active manager and an agreed WhatsApp group.                                                                        |
| Test task                | Select a low-risk task that is due today and eligible for WhatsApp distribution. Do not choose a task that was already sent or is already closed. |
| Response contact         | Tell the department manager exactly how and when to acknowledge and reply to the test message.                                                    |
| Time window              | Allow enough time to record acknowledgement and an end-of-day result on the same day.                                                             |

## Part A — Confirm the starting state

1. Open **Control Tower** from the left navigation. Note the current overall status and the number of overdue tasks. Do not attempt to close unrelated work during the drill.

2. Open **WhatsApp tasks**. Check the Daily, Weekly, Monthly, and Emergency cards. Select one current-day, non-clinical task for the chosen department.

3. Open the task’s details. Confirm the department, task title, due date, priority, and cadence are correct. If any of these are wrong, stop the drill and correct the schedule or task configuration first; do not send an incorrect instruction merely to finish the test.

4. Confirm that the task has not previously entered the WhatsApp lifecycle. A task already marked as sent, acknowledged, reviewed, closed, or directly completed is not a valid drill candidate.

5. Record the task title, department, and the current status in a simple drill note. This becomes your comparison point after each action.

## Part B — Prepare and manually send the WhatsApp message

1. In the selected task, choose the action to **prepare** the WhatsApp message. Review the generated message carefully before copying it.

2. Verify that the message contains the correct department, task instruction, deadline, and response request. If the content is unclear, cancel the drill, update the task instruction, and prepare it again.

3. Choose **copy message**. This only copies the message; it does not send anything automatically.

4. Open the agreed WhatsApp test group or department group outside the application. Paste the message and add a short label such as: “Production-readiness drill — please acknowledge and reply COMPLETED by [time].”

5. Send the message manually in WhatsApp. Return to the system and use the send-confirmation action only after the message is actually sent.

6. Check that the task status in the WhatsApp register now shows the appropriate sent state. Refresh the page once if needed. The task should no longer appear as merely available for distribution.

## Part C — Record acknowledgement and the end-of-day result

1. Ask the designated department contact to reply with a clear acknowledgement, such as “Acknowledged.” When that response is received, open the same task in **WhatsApp tasks** and record the acknowledgement.

2. Confirm that the lifecycle now reflects acknowledgement. This confirms that the register distinguishes acknowledgement from completion.

3. Ask the contact to perform or simulate the harmless test task and reply with the agreed end-of-day result. For a normal drill, use **completed**.

4. In the task’s outcome controls, record **completed** and save the result. Do not choose “excused” unless there is a real reason to test the exception process. If you do test “excused,” record the reason and verify that it does not cause an unintended department deduction.

5. Confirm that the task leaves the active unresolved queue and shows a completed outcome. The precise lifecycle may include review and closure controls; complete those only when the result is confirmed.

## Part D — Verify the connected management views

1. Return to **Control Tower**. Verify that the selected task no longer appears as an unresolved task or an incorrect overdue item. Other unrelated overdue tasks may remain; do not treat this as a drill failure.

2. Open **Reports**. Confirm that the selected department’s execution or WhatsApp compliance figures reflect the recorded drill outcome. If the report uses a period filter, select the current period.

3. Open the department scorecard or scoring view. Confirm that a completed outcome did not apply a no-reply or pending deduction.

4. Return to the task’s WhatsApp register entry. Confirm the visible history shows the key progression: prepared, copied, sent, acknowledged, and completed, with the manager actions attached to the appropriate points.

5. Use **Search** to find the task by title or department. Confirm the result points to the same final task state rather than a duplicate assignment.

## Part E — Test one roster update

1. Open **Roster** and choose a low-risk future or current shift for the drill department. Create a single shift or make one legitimate non-clinical update.

2. Enter the department, staff member, date, start time, end time, duty, and any appropriate attendance status. Ensure that the start time is earlier than the end time.

3. Save the shift. Confirm the roster displays the new or updated shift with the expected availability/hand-over indicators.

4. If testing CSV import instead, download the current template, add exactly one valid test row, import it, and verify the row-level validation result. Do not import uncertain or duplicate data.

## Part F — Test alert accountability

1. Open **Alerts**. Select a real low-risk alert that needs a manager response, or use an approved non-critical operational item. Do not create a false clinical alert.

2. Assign an owner, add a short handling note, and record acknowledgement. Confirm the owner and status are visible in the alert detail and list.

3. If it is operationally appropriate to resolve the alert, record the resolution and note. Otherwise, leave it acknowledged and assigned; do not close a real unresolved issue just to finish the drill.

4. Check the alert’s audit history to confirm that ownership, acknowledgement, and any resolution are traceable.

## Part G — Close the drill and decide readiness

Use the following decision table with the operations manager and department representative.

| Checkpoint              | Pass condition                                                                      | If it fails                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Task distribution       | Correct message was prepared, copied, manually sent, and confirmed in the register. | Stop live launch for that department; correct the task or group process and repeat Part B.           |
| Lifecycle recording     | Acknowledgement and completed outcome were recorded against the same task.          | Check the manager permissions and selected task state; correct before relying on score reporting.    |
| Cross-module visibility | Control Tower, reports, scorecard, and search show a consistent final state.        | Record the mismatch, keep manual oversight, and correct the configuration or workflow before launch. |
| Roster                  | A valid shift or valid single-row import is visible and usable.                     | Review the required fields and resolve data-quality errors before loading the full roster.           |
| Alerts                  | An owner and acknowledgement are visible with audit history.                        | Define alert ownership rules and repeat the alert test.                                              |

If every applicable checkpoint passes, record the date, department, task title, managers present, and any improvements identified. Then start the first live day using the daily WhatsApp routine. If a checkpoint fails, do not treat the drill as passed; document the exact screen and outcome, correct the cause, and repeat only the failed part.

## Important operating boundaries

The system supports manager-led accountability but does not automatically transmit messages to WhatsApp. The calendar is a planning view and does not edit task, risk, action, or roster records directly. The system has CSV roster import with a template but no record-export feature. These are normal product boundaries, not drill failures.
