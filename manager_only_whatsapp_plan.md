# Manager-Only WhatsApp Operating Model Plan

## Target workflow

The application will be operated only by hospital managers. Staff will receive daily, weekly, and monthly tasks through their departmental WhatsApp groups rather than by signing in to the application. Managers will prepare the task message, send it manually, confirm that it was sent, and record the department’s end-of-day outcome.

| Area                             | Planned change                                                                                                                                                                                     | Result                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Recurring task register          | Include assignment instances due today, including eligible daily, selected-weekend weekly, and monthly data/attendance tasks.                                                                      | One manager workspace for all scheduled WhatsApp tasks.                     |
| WhatsApp distribution            | Keep the visible message preview, manual copy fallback, and explicit send confirmation.                                                                                                            | No automatic WhatsApp integration or accidental “sent” records.             |
| End-of-day accountability        | Record completed, pending, or no-reply outcomes. Apply one point deduction only once to pending/no-reply tasks.                                                                                    | Clear department accountability without requiring staff application access. |
| Department scoring               | Show current-month scores beginning at 100 in the WhatsApp register and Control Tower.                                                                                                             | Meeting-ready view of completion, outstanding tasks, and lost points.       |
| Evidence and photo rules         | Remove evidence/photo flags from task creation, completion validation, task screens, and existing task templates.                                                                                  | Managers record WhatsApp outcomes rather than staff uploading proof.        |
| Staff accounts and local sign-in | Remove staff-account navigation, manager account provisioning/reset interfaces, local staff login routes, and staff-only My Day access. Preserve manager authentication and manager role controls. | The application is no longer distributed to staff.                          |
| Navigation and reports           | Replace staff-centric labels and task-execution routes with manager-focused WhatsApp distribution, outcome recording, scorecard, and reporting views.                                              | A simplified manager dashboard.                                             |
| Data safety                      | Keep historical task, completion, audit, dispatch, and point records. Retire unused staff credentials and staff-only entry points without deleting operational history.                            | Existing accountability history remains available.                          |

## Implementation sequence

1. Audit staff-facing screens, local authentication routes, evidence/photo fields, and recurring task selection rules.
2. Expand the WhatsApp task-register query and display so that due daily, weekly, and monthly assignments appear with their frequency clearly identified.
3. Remove evidence/photo requirements from the schema, manager task form, task-completion validation, and task-detail UI; migrate current task templates safely.
4. Remove staff-account provisioning/reset views, local staff login, and staff-only navigation. Retain manager roles and manager authentication.
5. Refocus the Control Tower and reports around WhatsApp distribution, recorded replies, unresolved work, and department score changes.
6. Add migration checks, manager-only permission tests, recurrence coverage for daily/weekly/monthly dispatches, and responsive UI tests before publishing.

> **Decision checkpoint:** This plan intentionally removes the staff-facing application workflow. Managers will remain able to use the dashboard and manual WhatsApp register, while staff will receive work only through their department WhatsApp groups.
