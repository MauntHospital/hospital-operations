import { describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const state = vi.hoisted(() => ({ db: null as any }));

vi.mock("./db", () => ({
  getDb: async () => state.db,
}));

import {
  acknowledgeWhatsAppTask,
  completeTask,
  completeTaskDirectlyByManager,
  createDutyRoster,
  createManagementAction,
  createOperationalFollowUpTask,
  createRisk,
  createTask,
  dispatchWhatsAppTask,
  getCalendar,
  getDashboard,
  getManagementActions,
  getMyDay,
  getOperationalAlerts,
  getOperationsModules,
  getReports,
  getRiskRegister,
  getTaskDetail,
  getTaskScoringRules,
  getWhatsAppTaskRegister,
  importDutyRosters,
  isAdmin,
  isManager,
  listIssues,
  prepareWhatsAppTask,
  recordWhatsAppTaskOutcome,
  reviewWhatsAppTask,
  runOperationalCycle,
  saveChecklistResult,
  updateManagementAction,
  updateOperationalAlert,
  updateRisk,
  updateTaskScoringRule,
} from "./operationsData";

function query(rows: any[]) {
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => rows,
    then: (
      resolve: (value: any[]) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(rows).then(resolve, reject),
  };
  return chain;
}

function makeDb(selectResults: any[][]) {
  const writes: any[] = [];
  let cursor = 0;
  const db: any = {
    select: () => query(selectResults[cursor++] ?? []),
    insert: (table: unknown) => ({
      values: (payload: unknown) => {
        writes.push({ table, payload });
        return {
          $returningId: async () => [{ id: 501 }],
          onDuplicateKeyUpdate: async () => ({}),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (payload: unknown) => ({
        where: async () => {
          writes.push({ table, payload, kind: "update" });
          return {};
        },
      }),
    }),
    delete: () => ({ where: async () => ({}) }),
  };
  return { db, writes };
}

const actor: User = {
  id: 7,
  openId: "test-user",
  name: "Test User",
  email: "test@hospital.example",
  loginMethod: "test",
  role: "staff",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

const admin: User = {
  ...actor,
  id: 1,
  openId: "admin-user",
  role: "hospital_admin",
};
const superAdmin: User = {
  ...actor,
  id: 2,
  openId: "super-admin-user",
  role: "super_admin",
};
const supervisor: User = {
  ...actor,
  id: 3,
  openId: "supervisor-user",
  role: "supervisor",
};
const viewer: User = { ...actor, id: 4, openId: "viewer-user", role: "viewer" };
const departmentHead: User = {
  ...actor,
  id: 5,
  openId: "department-head-user",
  role: "department_head",
};

const detail = {
  assignment: {
    id: 77,
    taskId: 5,
    departmentId: 4,
    assignedUserId: 7,
    dueAt: new Date("2026-08-19T09:00:00.000Z"),
    status: "not_started",
  },
  task: {
    id: 5,
    name: "Lead apron safety check",
    category: "Safety",
    evidenceRequired: false,
    approvalRequired: false,
  },
  department: { id: 4, name: "Radiology" },
};

const requiredChecklist = {
  id: 12,
  taskId: 5,
  label: "Lead apron undamaged",
  required: true,
  active: true,
  position: 0,
};

describe("operational backend mutations", () => {
  it("defines the intended Version 2 manager and administrator role matrix", () => {
    expect(
      [superAdmin, admin, departmentHead, supervisor].every(isManager)
    ).toBe(true);
    expect([actor, viewer].some(isManager)).toBe(false);
    expect([superAdmin, admin].every(isAdmin)).toBe(true);
    expect([departmentHead, supervisor, actor, viewer].some(isAdmin)).toBe(
      false
    );
  });

  it("creates an issue, notification, audit entry, and checklist result for a damaging checklist finding", async () => {
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [requiredChecklist],
      [],
      [],
    ]);
    state.db = fake.db;

    const result = await saveChecklistResult(supervisor, {
      assignmentId: 77,
      checklistId: 12,
      status: "damaged",
      note: "Seam split found during opening check.",
    });

    expect(result).toEqual({ issueId: 501, createdIssue: true });
    expect(
      fake.writes.some(write =>
        (write.payload as any)?.title?.includes("Lead apron undamaged")
      )
    ).toBe(true);
    expect(
      fake.writes.some(write => (write.payload as any)?.type === "issue")
    ).toBe(true);
    expect(
      fake.writes.some(
        write =>
          (write.payload as any)?.checklistId === 12 &&
          (write.payload as any)?.createdIssueId === 501
      )
    ).toBe(true);
  });

  it("rejects completion through completeTask when a required checklist item has not been recorded", async () => {
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [requiredChecklist],
      [],
    ]);
    state.db = fake.db;

    await expect(
      completeTask(supervisor, { assignmentId: 77 })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/required checklist items/i),
    });
  });

  it("changes an overdue assignment to completed after its required checklist is recorded and submitted", async () => {
    const overdueDetail = {
      ...detail,
      assignment: {
        ...detail.assignment,
        status: "overdue",
        dueAt: new Date("2026-08-20T08:00:00.000Z"),
      },
      task: {
        ...detail.task,
        evidenceRequired: false,
        approvalRequired: false,
      },
    };
    const recordedResult = {
      id: 18,
      assignmentId: 77,
      checklistId: 12,
      status: "available",
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [overdueDetail],
      [requiredChecklist],
      [recordedResult],
      [],
    ]);
    state.db = fake.db;

    await expect(
      completeTask(supervisor, {
        assignmentId: 77,
        notes: "All checks completed.",
      })
    ).resolves.toEqual({ status: "completed" });
    expect(
      fake.writes.some(
        write =>
          write.kind === "update" &&
          (write.payload as any)?.status === "completed" &&
          (write.payload as any)?.completedAt instanceof Date
      )
    ).toBe(true);
  });

  it("completes two separate ready assignments in sequence without retaining the first task state", async () => {
    const firstResult = {
      id: 18,
      assignmentId: 77,
      checklistId: 12,
      status: "available",
    };
    const secondDetail = {
      ...detail,
      assignment: { ...detail.assignment, id: 78, taskId: 6 },
      task: { ...detail.task, id: 6, name: "Radiation barrier inspection" },
    };
    const secondChecklist = {
      ...requiredChecklist,
      id: 13,
      taskId: 6,
      label: "Barrier is intact",
    };
    const secondResult = {
      id: 19,
      assignmentId: 78,
      checklistId: 13,
      status: "available",
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [requiredChecklist],
      [firstResult],
      [],
      [{ value: 1 }],
      [{ value: 1 }],
      [secondDetail],
      [secondChecklist],
      [secondResult],
      [],
    ]);
    state.db = fake.db;

    await expect(
      completeTask(supervisor, { assignmentId: 77 })
    ).resolves.toEqual({ status: "completed" });
    await expect(
      completeTask(supervisor, { assignmentId: 78 })
    ).resolves.toEqual({ status: "completed" });

    const completionWrites = fake.writes.filter(
      write =>
        write.kind === "update" &&
        (write.payload as any)?.status === "completed"
    );
    expect(completionWrites).toHaveLength(2);
    expect(
      fake.writes.filter(
        write =>
          (write.payload as any)?.assignmentId === 77 ||
          (write.payload as any)?.assignmentId === 78
      ).length
    ).toBeGreaterThanOrEqual(2);
  });

  it("refreshes My Day between two task completions without requiring evidence for the second task", async () => {
    const dueAt = new Date(Date.now() + 60 * 60_000);
    const firstDetail = {
      ...detail,
      assignment: {
        ...detail.assignment,
        id: 77,
        dueAt,
        status: "in_progress",
      },
      task: {
        ...detail.task,
        evidenceRequired: false,
        photoRequired: false,
        frequency: "daily",
        priority: "high",
      },
    };
    const secondDetail = {
      ...detail,
      assignment: {
        ...detail.assignment,
        id: 78,
        taskId: 6,
        dueAt,
        status: "in_progress",
      },
      task: {
        ...detail.task,
        id: 6,
        name: "Radiation barrier inspection",
        evidenceRequired: true,
        photoRequired: true,
        frequency: "daily",
        priority: "high",
      },
    };
    const firstResult = {
      id: 18,
      assignmentId: 77,
      checklistId: 12,
      status: "available",
    };
    const secondChecklist = {
      ...requiredChecklist,
      id: 13,
      taskId: 6,
      label: "Barrier is intact",
    };
    const secondResult = {
      id: 19,
      assignmentId: 78,
      checklistId: 13,
      status: "available",
    };
    const beforeCompletion = [
      {
        assignment: firstDetail.assignment,
        task: firstDetail.task,
        departmentName: "Radiology",
      },
      {
        assignment: secondDetail.assignment,
        task: secondDetail.task,
        departmentName: "Radiology",
      },
    ];
    const afterFirstCompletion = [
      {
        assignment: {
          ...firstDetail.assignment,
          status: "completed",
          completedAt: new Date(),
        },
        task: firstDetail.task,
        departmentName: "Radiology",
      },
      {
        assignment: secondDetail.assignment,
        task: secondDetail.task,
        departmentName: "Radiology",
      },
    ];
    const afterSecondCompletion = afterFirstCompletion.map(row =>
      row.assignment.id === 78
        ? {
            ...row,
            assignment: {
              ...row.assignment,
              status: "completed",
              completedAt: new Date(),
            },
          }
        : row
    );
    const profile = { userId: supervisor.id, departmentId: 4, active: true };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [profile],
      beforeCompletion,
      [{ value: 1 }],
      [{ value: 1 }],
      [firstDetail],
      [requiredChecklist],
      [firstResult],
      [],
      [{ value: 1 }],
      [{ value: 1 }],
      [profile],
      afterFirstCompletion,
      [{ value: 1 }],
      [{ value: 1 }],
      [secondDetail],
      [secondChecklist],
      [secondResult],
      [],
      [{ value: 1 }],
      [{ value: 1 }],
      [profile],
      afterSecondCompletion,
    ]);
    state.db = fake.db;

    expect((await getMyDay(supervisor)).counts.completed).toBe(0);
    await expect(
      completeTask(supervisor, { assignmentId: 77 })
    ).resolves.toEqual({ status: "completed" });
    const afterFirstRefresh = await getMyDay(supervisor);
    expect(afterFirstRefresh.counts.completed).toBe(1);
    expect(
      afterFirstRefresh.tasks.find(row => row.assignment.id === 78)
        ?.effectiveStatus
    ).toBe("in_progress");

    await expect(
      completeTask(supervisor, { assignmentId: 78 })
    ).resolves.toEqual({ status: "completed" });
    const afterSecondRefresh = await getMyDay(supervisor);
    expect(afterSecondRefresh.counts.completed).toBe(2);
    expect(afterSecondRefresh.counts.pending).toBe(0);
    expect(
      fake.writes.some(
        write =>
          (write.payload as any)?.assignmentId === 78 &&
          (write.payload as any)?.evidenceUrl === null
      )
    ).toBe(true);
  });

  it("shows a completed status in refreshed My Day after submitting an overdue assignment", async () => {
    const overdueDetail = {
      ...detail,
      assignment: {
        ...detail.assignment,
        status: "overdue",
        dueAt: new Date(),
      },
      task: {
        ...detail.task,
        evidenceRequired: false,
        approvalRequired: false,
        frequency: "daily",
        priority: "high",
      },
    };
    const recordedResult = {
      id: 18,
      assignmentId: 77,
      checklistId: 12,
      status: "available",
    };
    const refreshedMyDayRow = {
      assignment: {
        ...overdueDetail.assignment,
        status: "completed",
        completedAt: new Date(),
      },
      task: overdueDetail.task,
      departmentName: "Radiology",
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [overdueDetail],
      [requiredChecklist],
      [recordedResult],
      [],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ userId: supervisor.id, departmentId: 4, active: true }],
      [refreshedMyDayRow],
    ]);
    state.db = fake.db;

    await completeTask(supervisor, { assignmentId: 77 });
    const refreshed = await getMyDay(supervisor);

    expect(refreshed.tasks).toHaveLength(1);
    expect(refreshed.tasks[0]).toMatchObject({
      assignment: { id: 77, status: "completed" },
      effectiveStatus: "completed",
    });
    expect(refreshed.counts.completed).toBe(1);
    expect(refreshed.counts.overdue).toBe(0);
  });

  it("records a manager-sent WhatsApp task with a copy-ready department message", async () => {
    const fake = makeDb([[{ value: 1 }], [{ value: 1 }], [detail], []]);
    state.db = fake.db;

    const result = await dispatchWhatsAppTask(admin, { assignmentId: 77 });

    expect(result).toMatchObject({ dispatchId: 501, alreadyDispatched: false });
    expect(result.messageText).toMatch(/Radiology/);
    expect(result.messageText).toMatch(/Lead apron safety check/);
    expect(
      fake.writes.some(
        write =>
          (write.payload as any)?.assignmentId === 77 &&
          (write.payload as any)?.channel === undefined
      )
    ).toBe(true);
  });

  it("uses the weekly or monthly cadence in the manager's WhatsApp message", async () => {
    const weeklyDetail = {
      ...detail,
      task: { ...detail.task, frequency: "weekly" },
    };
    const fake = makeDb([[{ value: 1 }], [{ value: 1 }], [weeklyDetail], []]);
    state.db = fake.db;

    const result = await dispatchWhatsAppTask(admin, { assignmentId: 77 });

    expect(result.messageText).toMatch(/Weekly task/);
  });

  it("lets an operations manager complete an un-distributed overdue department task directly without creating a WhatsApp dispatch or score event", async () => {
    const directDetail = {
      ...detail,
      assignment: {
        ...detail.assignment,
        status: "overdue",
        dueAt: new Date("2026-08-19T09:00:00.000Z"),
      },
      task: { ...detail.task, approvalRequired: true },
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [directDetail],
      [],
      [],
      [],
    ]);
    state.db = fake.db;

    await expect(
      completeTaskDirectlyByManager(admin, {
        assignmentId: 77,
        notes: "Completed during the morning operations round.",
      })
    ).resolves.toEqual({ status: "completed", alreadyCompleted: false });

    expect(
      fake.writes.some(
        write =>
          write.kind === "update" &&
          (write.payload as any)?.status === "completed" &&
          (write.payload as any)?.completedAt instanceof Date
      )
    ).toBe(true);
    expect(
      fake.writes.some(
        write =>
          (write.payload as any)?.assignmentId === 77 &&
          (write.payload as any)?.approvalStatus === "not_required"
      )
    ).toBe(true);
    expect(
      fake.writes.some(
        write =>
          (write.payload as any)?.departmentId === 4 &&
          (write.payload as any)?.channel !== undefined
      )
    ).toBe(false);
    expect(
      fake.writes.some(
        write => (write.payload as any)?.pointDelta !== undefined
      )
    ).toBe(false);
  });

  it("does not allow staff or already-dispatched work to bypass the WhatsApp accountability lifecycle", async () => {
    const deniedFake = makeDb([]);
    state.db = deniedFake.db;
    await expect(
      completeTaskDirectlyByManager(actor, { assignmentId: 77 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(deniedFake.writes).toEqual([]);

    const dispatchedFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [detail],
      [],
      [],
      [{ id: 501, assignmentId: 77, status: "sent" }],
    ]);
    state.db = dispatchedFake.db;
    await expect(
      completeTaskDirectlyByManager(admin, { assignmentId: 77 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/WhatsApp workflow/i),
    });
  });

  it.skip("records no-reply or pending reports for manager review without applying an automatic deduction", async () => {
    const initialDispatch = {
      id: 501,
      assignmentId: 77,
      taskId: 5,
      departmentId: 4,
      sentByUserId: admin.id,
      status: "sent",
      penaltyApplied: false,
    };
    const scoredTask = { id: 5, priority: "high", pointWeightTenths: 30 };
    const penaltyFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ dispatch: initialDispatch, task: scoredTask }],
      [{ priority: "high", weightTenths: 30 }],
    ]);
    state.db = penaltyFake.db;

    await expect(
      recordWhatsAppTaskOutcome(admin, {
        dispatchId: 501,
        outcome: "no_reply",
        note: "No WhatsApp reply by close of shift.",
      })
    ).resolves.toEqual({
      status: "no_reply",
      penaltyApplied: true,
      penaltyTenths: 30,
    });
    expect(
      penaltyFake.writes.some(
        write =>
          (write.payload as any)?.pointDelta === -30 &&
          (write.payload as any)?.dispatchId === 501
      )
    ).toBe(false);
    expect(
      penaltyFake.writes.some(
        write =>
          (write.payload as any)?.status === "in_progress" &&
          (write.payload as any)?.completedAt === null
      )
    ).toBe(true);

    const penalizedDispatch = {
      ...initialDispatch,
      status: "no_reply",
      penaltyApplied: true,
    };
    const noDuplicateFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ dispatch: penalizedDispatch, task: scoredTask }],
    ]);
    state.db = noDuplicateFake.db;
    await expect(
      recordWhatsAppTaskOutcome(admin, { dispatchId: 501, outcome: "pending" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/already has a recorded outcome/i),
    });
    expect(
      noDuplicateFake.writes.some(
        write => (write.payload as any)?.pointDelta === -30
      )
    ).toBe(false);
  });

  it.skip("marks the underlying assignment complete when a WhatsApp outcome is completed or excused", async () => {
    const completedDispatch = {
      id: 501,
      assignmentId: 77,
      departmentId: 4,
      status: "sent",
      penaltyApplied: false,
    };
    const completedFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          dispatch: completedDispatch,
          task: { id: 5, priority: "high", pointWeightTenths: 10 },
        },
      ],
    ]);
    state.db = completedFake.db;

    await expect(
      recordWhatsAppTaskOutcome(admin, {
        dispatchId: 501,
        outcome: "completed",
      })
    ).resolves.toMatchObject({ status: "completed", penaltyApplied: false });

    expect(
      completedFake.writes.filter(
        write => (write.payload as any)?.status === "completed"
      )
    ).toHaveLength(2);
  });

  it.skip("preserves terminal WhatsApp and direct-completion states instead of reopening them through another lifecycle action", async () => {
    const completedDirect = {
      assignment: { ...detail.assignment, status: "completed" },
      task: detail.task,
      department: detail.department,
    };
    const directFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [completedDirect],
    ]);
    state.db = directFake.db;
    await expect(
      prepareWhatsAppTask(admin, { assignmentId: 77 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/completed directly/i),
    });

    const acknowledgementFake = makeDb([
      [{ id: 501, assignmentId: 77, status: "completed" }],
    ]);
    state.db = acknowledgementFake.db;
    await expect(
      acknowledgeWhatsAppTask(admin, { dispatchId: 501 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/end-of-day outcome/i),
    });

    const terminalOutcomeFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          dispatch: {
            id: 501,
            assignmentId: 77,
            status: "reviewed",
            penaltyApplied: false,
          },
          task: { id: 5, priority: "high" },
        },
      ],
    ]);
    state.db = terminalOutcomeFake.db;
    await expect(
      recordWhatsAppTaskOutcome(admin, {
        dispatchId: 501,
        outcome: "completed",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/already has a recorded outcome/i),
    });

    const closedFake = makeDb([
      [{ id: 501, assignmentId: 77, status: "closed" }],
    ]);
    state.db = closedFake.db;
    await expect(
      reviewWhatsAppTask(admin, { dispatchId: 501 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/already closed/i),
    });
  });

  it("shows manual WhatsApp outcomes, point deductions, and report aggregates for the department scorecard", async () => {
    const now = new Date();
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          id: 77,
          status: "in_progress",
          dueAt: new Date(now.getTime() + 60_000),
          taskName: "Lead apron safety check",
          priority: "high",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
      ],
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [
        { id: 501, assignmentId: 77, departmentId: 4, status: "pending" },
        { id: 502, assignmentId: 78, departmentId: 4, status: "completed" },
      ],
      [
        { id: 801, departmentId: 4, pointDelta: -10, createdAt: now },
        { id: 802, departmentId: 4, pointDelta: -10, createdAt: now },
      ],
    ]);
    state.db = fake.db;

    const dashboard = await getDashboard(admin);

    expect(dashboard.departmentAccountability).toEqual([
      expect.objectContaining({
        departmentId: 4,
        score: 98,
        pointsLost: 2,
        dispatched: 2,
        completed: 1,
        pending: 1,
        awaitingReply: 0,
      }),
    ]);

    const reportFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          id: 77,
          status: "in_progress",
          dueAt: new Date(now.getTime() + 60_000),
          taskName: "Lead apron safety check",
          priority: "high",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
      ],
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [
        { id: 501, assignmentId: 77, departmentId: 4, status: "pending" },
        { id: 502, assignmentId: 78, departmentId: 4, status: "completed" },
      ],
      [
        { id: 801, departmentId: 4, pointDelta: -10, createdAt: now },
        { id: 802, departmentId: 4, pointDelta: -10, createdAt: now },
      ],
      [],
      [],
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [],
      [
        {
          departmentId: 4,
          departmentName: "Radiology",
          pointDelta: -10,
          reason: "No WhatsApp reply",
          createdAt: now,
        },
      ],
    ]);
    state.db = reportFake.db;
    const report = await getReports(admin);
    expect(report.whatsappSummary).toMatchObject({
      dispatched: 2,
      completed: 1,
      pendingOrNoReply: 1,
      pointsLost: 2,
    });
    expect(report.whatsappAccountability).toEqual([
      expect.objectContaining({ departmentName: "Radiology", score: 98 }),
    ]);
    expect(report.departmentPointTrends).toEqual([
      expect.objectContaining({
        departmentName: "Radiology",
        events: [expect.objectContaining({ pointDelta: -10, scoreAfter: 99 })],
      }),
    ]);
    expect(report.complianceSummary).toMatchObject({
      hospitalRate: 50,
      dispatched: 2,
      completed: 1,
    });
    expect(report.responseTimeAnalytics).toMatchObject({
      acknowledgedCount: 0,
      respondedCount: 0,
      averageAcknowledgementMinutes: null,
      averageResponseMinutes: null,
    });
  });

  it("keeps prior-day completed work out of Control Tower current-task and department-readiness totals while retaining unresolved carry-over", async () => {
    const now = new Date();
    const currentDueAt = new Date(now.getTime() + 60 * 60_000);
    const priorDay = new Date(now.getTime() - 24 * 60 * 60_000);
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          id: 77,
          status: "completed",
          dueAt: currentDueAt,
          taskName: "Current daily safety check",
          priority: "medium",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
        {
          id: 78,
          status: "completed",
          dueAt: priorDay,
          taskName: "Prior-day completed check",
          priority: "medium",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
        {
          id: 79,
          status: "overdue",
          dueAt: priorDay,
          taskName: "Unresolved safety carry-over",
          priority: "high",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
      ],
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);
    state.db = fake.db;

    const dashboard = await getDashboard(admin);

    expect(dashboard.taskCounts).toMatchObject({
      total: 2,
      scheduledToday: 1,
      completed: 1,
      overdue: 1,
    });
    expect(dashboard.departmentHealth).toEqual([
      expect.objectContaining({ id: 4, total: 2, completed: 1, overdue: 1 }),
    ]);
    expect(dashboard.recentAssignments.map(row => row.id)).toEqual([77, 79]);
    expect(dashboard.overdueManagerAssignments).toEqual([
      expect.objectContaining({ id: 79, effectiveStatus: "overdue" }),
    ]);
  });

  it("uses the same current-day daily, weekly, and monthly assignments in Control Tower as the WhatsApp task register", async () => {
    const now = new Date();
    const currentDueAt = new Date(now.getTime() + 60 * 60_000);
    const priorDay = new Date(now.getTime() - 24 * 60 * 60_000);
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          id: 77,
          status: "completed",
          dueAt: currentDueAt,
          taskName: "Daily safety check",
          priority: "medium",
          frequency: "daily",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
          whatsappStatus: "closed",
        },
        {
          id: 78,
          status: "not_started",
          dueAt: currentDueAt,
          taskName: "Weekly stock count",
          priority: "high",
          frequency: "weekly",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
          whatsappStatus: "sent",
        },
        {
          id: 79,
          status: "not_started",
          dueAt: currentDueAt,
          taskName: "Shift equipment check",
          priority: "high",
          frequency: "every_shift",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
          whatsappStatus: null,
        },
        {
          id: 80,
          status: "overdue",
          dueAt: priorDay,
          taskName: "Prior daily carry-over",
          priority: "high",
          frequency: "daily",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
          whatsappStatus: "pending",
        },
      ],
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);
    state.db = fake.db;

    const dashboard = await getDashboard(admin);

    expect(dashboard.whatsappTodayAssignments).toEqual([
      expect.objectContaining({
        id: 77,
        frequency: "daily",
        workflowStatus: "closed",
        effectiveStatus: "closed",
      }),
      expect.objectContaining({
        id: 78,
        frequency: "weekly",
        workflowStatus: "sent",
        effectiveStatus: "sent",
      }),
    ]);
  });

  it("keeps Control Tower task totals and lifecycle labels in parity with the WhatsApp register for the same current-day work", async () => {
    const now = new Date();
    const currentDueAt = new Date(now.getTime() + 60 * 60_000);
    const dashboardAssignments = [
      {
        id: 77,
        status: "completed",
        dueAt: currentDueAt,
        taskName: "Daily safety check",
        priority: "medium",
        frequency: "daily",
        departmentId: 4,
        departmentName: "Radiology",
        assignedUserId: actor.id,
        whatsappStatus: "closed",
      },
      {
        id: 78,
        status: "in_progress",
        dueAt: currentDueAt,
        taskName: "Weekly stock count",
        priority: "high",
        frequency: "weekly",
        departmentId: 4,
        departmentName: "Radiology",
        assignedUserId: actor.id,
        whatsappStatus: "pending",
      },
    ];
    const registerRows = dashboardAssignments.map(row => ({
      assignment: { id: row.id, status: row.status, dueAt: row.dueAt },
      task: {
        id: row.id,
        name: row.taskName,
        priority: row.priority,
        frequency: row.frequency,
      },
      department: { id: row.departmentId, name: row.departmentName },
      dispatch: {
        id: row.id + 500,
        assignmentId: row.id,
        status: row.whatsappStatus,
      },
    }));

    const dashboardFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      dashboardAssignments,
      [],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      registerRows.map(row => ({
        id: row.dispatch.id,
        assignmentId: row.assignment.id,
        departmentId: 4,
        status: row.dispatch.status,
      })),
      [],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    ]);
    state.db = dashboardFake.db;
    const dashboard = await getDashboard(admin);

    const registerFake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      registerRows,
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
    ]);
    state.db = registerFake.db;
    const register = await getWhatsAppTaskRegister(admin);

    expect(dashboard.whatsappTodayAssignments).toHaveLength(
      register.tasks.length
    );
    expect(
      dashboard.whatsappTodayAssignments.map(row => [
        row.id,
        row.workflowStatus,
      ])
    ).toEqual(
      register.tasks.map(row => [row.assignment.id, row.dispatch?.status])
    );
  });

  it("reports the complete Version 2 accountability workflow with response times, risks, overdue actions, and repeated-problem trends", async () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          id: 77,
          status: "completed",
          dueAt: new Date("2026-08-22T09:00:00.000Z"),
          taskName: "Lead apron safety check",
          priority: "high",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
        {
          id: 78,
          status: "in_progress",
          dueAt: new Date("2026-08-22T16:00:00.000Z"),
          taskName: "Mobile X-ray readiness check",
          priority: "medium",
          departmentId: 4,
          departmentName: "Radiology",
          assignedUserId: actor.id,
        },
      ],
      [
        {
          id: 21,
          category: "Equipment",
          priority: "high",
          status: "open",
          departmentId: 4,
          title: "Lead apron damaged",
          dueAt: new Date("2026-08-22T14:00:00.000Z"),
        },
        {
          id: 22,
          category: "Equipment",
          priority: "critical",
          status: "in_progress",
          departmentId: 4,
          title: "X-ray maintenance review",
          dueAt: new Date("2026-08-22T14:00:00.000Z"),
        },
        {
          id: 23,
          category: "Staffing",
          priority: "medium",
          status: "resolved",
          departmentId: 4,
          title: "Coverage restored",
          dueAt: null,
        },
      ],
      [],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
      [],
      [
        { id: 501, departmentId: 4, status: "completed", createdAt: now },
        { id: 502, departmentId: 4, status: "no_reply", createdAt: now },
        { id: 503, departmentId: 4, status: "sent", createdAt: now },
      ],
      [
        {
          id: 801,
          departmentId: 4,
          pointDelta: -30,
          reason: "No WhatsApp reply",
          createdAt: now,
        },
      ],
      [{ id: 91, departmentId: 4, severity: "high", status: "open" }],
      [
        {
          id: 61,
          departmentId: 4,
          priority: "high",
          status: "open",
          dueAt: new Date(Date.now() - 60 * 60_000),
          ownerUserId: null,
        },
      ],
      [],
      [],
      [{ id: 71, departmentId: 4, shift: "Day", attendance: "present" }],
      [
        {
          id: 1,
          code: "overdue_actions",
          warningThreshold: 1,
          criticalThreshold: 2,
          active: true,
        },
      ],
      [{ id: 4, name: "Radiology", active: true }],
      [{ id: 71, attendance: "late" }],
      [
        { id: 21, category: "Equipment", priority: "high", status: "open" },
        {
          id: 22,
          category: "Equipment",
          priority: "critical",
          status: "in_progress",
        },
        {
          id: 23,
          category: "Staffing",
          priority: "medium",
          status: "resolved",
        },
      ],
      [
        {
          departmentId: 4,
          departmentName: "Radiology",
          pointDelta: -30,
          reason: "No WhatsApp reply",
          createdAt: now,
        },
      ],
      [
        {
          sentAt: new Date("2026-08-22T08:00:00.000Z"),
          acknowledgedAt: new Date("2026-08-22T08:10:00.000Z"),
          respondedAt: new Date("2026-08-22T09:00:00.000Z"),
        },
        {
          sentAt: new Date("2026-08-22T08:00:00.000Z"),
          acknowledgedAt: new Date("2026-08-22T08:30:00.000Z"),
          respondedAt: null,
        },
      ],
    ]);
    state.db = fake.db;

    const report = await getReports(admin);

    expect(report.dashboard).toMatchObject({
      operationalStatus: "attention_required",
      riskCounts: { high: 1, open: 1 },
      managementActionCounts: { overdue: 1, open: 1 },
    });
    expect(report.whatsappSummary).toEqual({
      dispatched: 3,
      completed: 1,
      pendingOrNoReply: 2,
      pointsLost: 3,
    });
    expect(report.complianceSummary).toEqual({
      hospitalRate: 33,
      dispatched: 3,
      completed: 1,
    });
    expect(report.responseTimeAnalytics).toEqual({
      acknowledgedCount: 2,
      respondedCount: 1,
      averageAcknowledgementMinutes: 20,
      averageResponseMinutes: 60,
    });
    expect(report.repeatedProblemTrends).toEqual([
      { category: "Equipment", count: 2 },
      { category: "Staffing", count: 1 },
    ]);
    expect(report.departmentPointTrends).toEqual([
      expect.objectContaining({
        departmentName: "Radiology",
        currentScore: 97,
        events: [expect.objectContaining({ pointDelta: -30, scoreAfter: 97 })],
      }),
    ]);
  });

  it("persists the super-admin-selected Saturday or Sunday weekly schedule into the created task and assignment", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    const base = {
      departmentId: 4,
      frequency: "weekly" as const,
      dueTime: "09:30",
      priority: "medium" as const,
      category: "Safety",
      checklist: [],
    };

    await createTask(superAdmin, {
      ...base,
      name: "Saturday generator check",
      weeklyDay: "saturday",
    });
    await createTask(superAdmin, {
      ...base,
      name: "Sunday attendance review",
      weeklyDay: "sunday",
    });

    const saturdayTask = fake.writes.find(
      write => (write.payload as any)?.name === "Saturday generator check"
    )?.payload as any;
    const sundayTask = fake.writes.find(
      write => (write.payload as any)?.name === "Sunday attendance review"
    )?.payload as any;
    const assignments = fake.writes
      .filter(write => (write.payload as any)?.dueAt instanceof Date)
      .map(write => (write.payload as any).dueAt as Date);
    expect(saturdayTask.recurrenceRule).toBe("weekly:saturday");
    expect(sundayTask.recurrenceRule).toBe("weekly:sunday");
    expect(assignments.some(dueAt => dueAt.getDay() === 6)).toBe(true);
    expect(assignments.some(dueAt => dueAt.getDay() === 0)).toBe(true);
  });

  it("creates roster entries only for active staff in the selected department and rejects duplicate slots", async () => {
    const rosterInput = {
      departmentId: 4,
      userId: 7,
      dutyDate: new Date("2026-08-23T00:00:00.000Z"),
      shift: "Day",
      startTime: "08:00",
      endTime: "16:00",
      assignedDuty: "Imaging coverage",
    };
    const createdFake = makeDb([
      [{ user: actor, profile: { userId: 7, departmentId: 4, active: true } }],
      [],
    ]);
    state.db = createdFake.db;
    await expect(createDutyRoster(supervisor, rosterInput)).resolves.toEqual({
      id: 501,
    });
    expect(
      createdFake.writes.some(
        write => (write.payload as any)?.assignedDuty === "Imaging coverage"
      )
    ).toBe(true);

    const invalidTimeFake = makeDb([]);
    state.db = invalidTimeFake.db;
    await expect(
      createDutyRoster(supervisor, {
        ...rosterInput,
        startTime: "16:00",
        endTime: "08:00",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: expect.stringMatching(/start time/i),
    });
    expect(invalidTimeFake.writes).toEqual([]);

    const duplicateFake = makeDb([
      [{ user: actor, profile: { userId: 7, departmentId: 4, active: true } }],
      [{ id: 88 }],
    ]);
    state.db = duplicateFake.db;
    await expect(
      createDutyRoster(supervisor, rosterInput)
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/matching roster slot/i),
    });

    state.db = makeDb([]).db;
    await expect(createDutyRoster(actor, rosterInput)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("imports valid roster rows while returning row-level feedback for invalid or duplicate entries", async () => {
    const rows = [
      {
        departmentId: 4,
        userId: 7,
        dutyDate: new Date("2026-08-23T00:00:00.000Z"),
        shift: "Day",
        startTime: "08:00",
        endTime: "16:00",
        assignedDuty: "Imaging coverage",
      },
      {
        departmentId: 4,
        userId: 8,
        dutyDate: new Date("2026-08-23T00:00:00.000Z"),
        shift: "Day",
        startTime: "08:00",
        endTime: "16:00",
        assignedDuty: "Radiation safety",
      },
    ];
    const fake = makeDb([
      [{ user: actor, profile: { userId: 7, departmentId: 4, active: true } }],
      [],
      [
        {
          user: { ...actor, id: 8 },
          profile: { userId: 8, departmentId: 5, active: true },
        },
      ],
    ]);
    state.db = fake.db;
    const result = await importDutyRosters(supervisor, { rows });
    expect(result).toEqual({
      createdCount: 1,
      errors: [
        {
          row: 2,
          message:
            "The selected staff member must belong to the selected department.",
        },
      ],
    });
  });

  it("shows alert ownership history and supports accountable acknowledgement and resolution for managers only", async () => {
    const openAlert = {
      id: 44,
      title: "Task overdue",
      body: "Follow up",
      handlingStatus: "open",
      ownerUserId: null,
      createdAt: new Date(),
    };
    const managerRows = [
      { id: 1, name: "Hospital Admin", role: "hospital_admin" },
    ];
    const historyRows = [
      {
        audit: {
          id: 71,
          entityId: 44,
          action: "operational_alert_assign",
          createdAt: new Date(),
        },
        actorName: "Hospital Admin",
      },
    ];
    const listingFake = makeDb([[openAlert], managerRows, historyRows]);
    state.db = listingFake.db;
    const alerts = await getOperationalAlerts(supervisor);
    expect(alerts.alerts[0]).toMatchObject({
      ownerName: null,
      history: [expect.objectContaining({ actorName: "Hospital Admin" })],
    });

    const handlingFake = makeDb([[openAlert], [managerRows[0]]]);
    state.db = handlingFake.db;
    await expect(
      updateOperationalAlert(supervisor, {
        notificationId: 44,
        action: "acknowledge",
        note: "Reviewing duty coverage.",
      })
    ).resolves.toEqual({ success: true });
    expect(
      handlingFake.writes.some(
        write =>
          (write.payload as any)?.handlingStatus === "acknowledged" &&
          (write.payload as any)?.ownerUserId === 3
      )
    ).toBe(true);

    state.db = makeDb([]).db;
    await expect(
      updateOperationalAlert(actor, { notificationId: 44, action: "resolve" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies hospital administrators from creating department task schedules reserved for the super administrator", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(
      createTask(admin, {
        name: "Daily safety check",
        departmentId: 4,
        frequency: "daily",
        dueTime: "08:00",
        priority: "medium",
        category: "Safety",
        checklist: [],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("denies non-administrator managers from changing weighted task deductions", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(
      updateTaskScoringRule(actor, { ruleId: 1, weightTenths: 30 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toEqual([]);
  });

  it("denies staff users from creating Version 2 risks, management actions, and linked follow-up tasks", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(
      createRisk(actor, {
        description: "Unresolved generator alarm",
        category: "Safety",
        departmentId: 4,
        likelihood: 3,
        impact: 4,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createManagementAction(actor, {
        title: "Verify generator alarm",
        departmentId: 4,
        priority: "high",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      createOperationalFollowUpTask(actor, {
        sourceType: "equipment",
        sourceId: 1,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toEqual([]);
  });

  it("prevents a second open follow-up task for the same operational source record", async () => {
    const fake = makeDb([
      [
        {
          id: 11,
          name: "Emergency Defibrillator",
          departmentId: 4,
          criticality: "high",
          status: "under_maintenance",
        },
      ],
      [{ assignmentId: 701 }],
    ]);
    state.db = fake.db;

    await expect(
      createOperationalFollowUpTask(supervisor, {
        sourceType: "equipment",
        sourceId: 11,
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/open follow-up/i),
    });
    expect(fake.writes).toEqual([]);
  });

  it("denies staff users from reading or updating Version 2 management controls", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(getRiskRegister(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getManagementActions(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getTaskScoringRules(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      updateRisk(actor, { riskId: 1, status: "resolved" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      updateManagementAction(actor, { actionId: 1, status: "completed" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("permits manager roles to review the Version 2 risk register", async () => {
    const fake = makeDb([[]]);
    state.db = fake.db;
    await expect(getRiskRegister(supervisor)).resolves.toEqual([]);
  });

  it("permits department heads to read the Version 2 management-action register", async () => {
    const fake = makeDb([[]]);
    state.db = fake.db;
    await expect(getManagementActions(departmentHead)).resolves.toEqual([]);
  });

  it("permits manager roles to update Version 2 risks and management actions", async () => {
    const riskFake = makeDb([
      [{ id: 1, mitigationPlan: null, residualRisk: null, reviewDate: null }],
    ]);
    state.db = riskFake.db;
    await expect(
      updateRisk(supervisor, {
        riskId: 1,
        status: "mitigating",
        mitigationPlan: "Schedule mitigation review",
      })
    ).resolves.toEqual({ success: true });
    expect(riskFake.writes.some(write => write.kind === "update")).toBe(true);

    const actionFake = makeDb([
      [
        {
          id: 2,
          completionNotes: null,
          verification: null,
          verifiedByUserId: null,
          verifiedAt: null,
        },
      ],
    ]);
    state.db = actionFake.db;
    await expect(
      updateManagementAction(departmentHead, {
        actionId: 2,
        status: "completed",
        verification: "Manager verified",
      })
    ).resolves.toEqual({ success: true });
    expect(actionFake.writes.some(write => write.kind === "update")).toBe(true);
  });

  it("denies viewer roles from Version 2 management read paths", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(getRiskRegister(viewer)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getManagementActions(viewer)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getTaskScoringRules(viewer)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("denies staff and viewer roles from manager workspace data contracts even through direct procedure calls", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(getDashboard(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getOperationsModules(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(getCalendar(actor)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(listIssues(viewer)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(fake.writes).toEqual([]);
  });

  it("denies retired staff access to My Day, checklist, and legacy completion procedures", async () => {
    const fake = makeDb([]);
    state.db = fake.db;
    await expect(getMyDay(actor)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getTaskDetail(actor, 77)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      saveChecklistResult(actor, {
        assignmentId: 77,
        checklistId: 12,
        status: "available",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      completeTask(actor, { assignmentId: 77 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fake.writes).toEqual([]);
  });

  it("keeps a pre-Version-2 sent WhatsApp dispatch visible in the manager register", async () => {
    const now = new Date();
    const legacyDispatch = {
      id: 90,
      assignmentId: 77,
      status: "sent",
      sentAt: now,
      penaltyApplied: false,
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [
        {
          assignment: { id: 77, dueAt: now },
          task: {
            id: 5,
            name: "Legacy daily safety check",
            frequency: "daily",
            priority: "medium",
          },
          department: { id: 4, name: "Radiology" },
          dispatch: legacyDispatch,
        },
      ],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
    ]);
    state.db = fake.db;
    const register = await getWhatsAppTaskRegister(admin);
    expect(register.tasks).toEqual([
      expect.objectContaining({
        dispatch: expect.objectContaining({ id: 90, status: "sent" }),
      }),
    ]);
  });

  it.skip("does not count manager-completed assignments as WhatsApp work still awaiting distribution", async () => {
    const now = new Date();
    const directCompletion = {
      assignment: { id: 77, dueAt: now, status: "completed" },
      task: {
        id: 5,
        name: "Manager equipment review",
        frequency: "daily",
        priority: "medium",
      },
      department: { id: 4, name: "Radiology" },
      dispatch: null,
    };
    const scheduledTask = {
      assignment: { id: 78, dueAt: now, status: "not_started" },
      task: {
        id: 6,
        name: "Department safety check",
        frequency: "daily",
        priority: "medium",
      },
      department: { id: 4, name: "Radiology" },
      dispatch: null,
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [{ value: 1 }],
      [directCompletion, scheduledTask],
      [],
      [],
      [{ id: 4, name: "Radiology", active: true }],
    ]);
    state.db = fake.db;

    const register = await getWhatsAppTaskRegister(admin);

    expect(register.summary).toMatchObject({
      notSent: 1,
      sent: 0,
      completed: 0,
    });
  });

  it("keeps a pre-Version-2 task assignment visible in My Day after the command-center upgrade", async () => {
    const dueAt = new Date(Date.now() + 3 * 60 * 60_000);
    const legacyAssignment = {
      assignment: {
        id: 41,
        taskId: 12,
        departmentId: 4,
        assignedUserId: actor.id,
        dueAt,
        status: "in_progress",
      },
      task: {
        id: 12,
        name: "Legacy radiation room readiness check",
        frequency: "daily",
        priority: "high",
      },
      departmentName: "Radiology",
    };
    const fake = makeDb([
      [{ value: 1 }],
      [{ value: 1 }],
      [{ userId: actor.id, departmentId: 4, active: true }],
      [legacyAssignment],
    ]);
    state.db = fake.db;

    const myDay = await getMyDay(supervisor);

    expect(myDay.counts).toEqual({
      total: 1,
      overdue: 0,
      completed: 0,
      pending: 1,
    });
    expect(myDay.tasks).toEqual([
      expect.objectContaining({
        assignment: expect.objectContaining({ id: 41, status: "in_progress" }),
        task: expect.objectContaining({
          name: "Legacy radiation room readiness check",
        }),
        effectiveStatus: "in_progress",
      }),
    ]);
  });

  it.skip("generates the next daily assignment and surfaces it in My Day instead of prior-day completed work", async () => {
    const now = new Date("2026-08-21T08:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const recurringTask = {
        recurring: {
          id: 31,
          taskId: 6,
          lastGeneratedFor: "2026-08-20",
          nextRunAt: new Date("2026-08-21T09:00:00.000Z"),
          active: true,
        },
        task: {
          id: 6,
          departmentId: 4,
          assignedUserId: actor.id,
          dueTime: "09:00",
          frequency: "daily",
          active: true,
        },
      };
      const generatedAssignment = {
        assignment: {
          id: 501,
          taskId: 6,
          departmentId: 4,
          assignedUserId: actor.id,
          dueAt: new Date("2026-08-21T09:00:00.000Z"),
          status: "not_started",
        },
        task: {
          id: 6,
          name: "Portable oxygen check",
          priority: "high",
          frequency: "daily",
        },
        departmentName: "Radiology",
      };
      const priorCompleted = {
        assignment: {
          id: 401,
          taskId: 7,
          departmentId: 4,
          assignedUserId: actor.id,
          dueAt: new Date("2026-08-20T09:00:00.000Z"),
          status: "completed",
        },
        task: {
          id: 7,
          name: "Prior daily stock check",
          priority: "medium",
          frequency: "daily",
        },
        departmentName: "Radiology",
      };
      const criticalCarryOver = {
        assignment: {
          id: 402,
          taskId: 8,
          departmentId: 4,
          assignedUserId: actor.id,
          dueAt: new Date("2026-08-20T08:00:00.000Z"),
          status: "overdue",
        },
        task: {
          id: 8,
          name: "Emergency oxygen escalation",
          priority: "critical",
          frequency: "daily",
        },
        departmentName: "Radiology",
      };
      const fake = makeDb([
        [],
        [recurringTask],
        [],
        [],
        [{ value: 1 }],
        [{ value: 1 }],
        [{ userId: actor.id, departmentId: 4, active: true }],
        [generatedAssignment, priorCompleted, criticalCarryOver],
      ]);
      state.db = fake.db;

      const cycle = await runOperationalCycle();
      const day = await getMyDay(supervisor);

      expect(cycle.generatedAssignments).toBe(1);
      expect(
        fake.writes.some(
          write =>
            (write.payload as any)?.dueAt?.toISOString() ===
            "2026-08-21T09:00:00.000Z"
        )
      ).toBe(true);
      expect(day.tasks).toHaveLength(2);
      expect(day.tasks.map(item => item.task.name)).toEqual(
        expect.arrayContaining([
          "Portable oxygen check",
          "Emergency oxygen escalation",
        ])
      );
      expect(day.tasks.map(item => item.task.name)).not.toContain(
        "Prior daily stock check"
      );
      expect(
        day.tasks
          .find(item => item.task.name === "Portable oxygen check")
          ?.assignment.dueAt.toISOString()
      ).toBe("2026-08-21T09:00:00.000Z");
      expect(
        day.tasks.find(item => item.task.name === "Emergency oxygen escalation")
          ?.effectiveStatus
      ).toBe("overdue");
    } finally {
      vi.useRealTimers();
    }
  });

  it("generates daily, weekly, and monthly WhatsApp task assignments only on each cadence's scheduled date", async () => {
    const now = new Date("2026-08-22T06:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const recurring = [
        {
          recurring: {
            id: 31,
            taskId: 6,
            lastGeneratedFor: "2026-08-21",
            nextRunAt: new Date("2026-08-22T09:00:00.000Z"),
            active: true,
          },
          task: {
            id: 6,
            departmentId: 4,
            assignedUserId: null,
            dueTime: "09:00",
            frequency: "daily",
            active: true,
          },
        },
        {
          recurring: {
            id: 32,
            taskId: 7,
            lastGeneratedFor: "2026-08-15",
            nextRunAt: new Date("2026-08-22T10:00:00.000Z"),
            active: true,
          },
          task: {
            id: 7,
            departmentId: 4,
            assignedUserId: null,
            dueTime: "10:00",
            frequency: "weekly",
            active: true,
          },
        },
        {
          recurring: {
            id: 33,
            taskId: 8,
            lastGeneratedFor: "2026-07-22",
            nextRunAt: new Date("2026-08-22T11:00:00.000Z"),
            active: true,
          },
          task: {
            id: 8,
            departmentId: 4,
            assignedUserId: null,
            dueTime: "11:00",
            frequency: "monthly",
            active: true,
          },
        },
        {
          recurring: {
            id: 34,
            taskId: 9,
            lastGeneratedFor: "2026-08-15",
            nextRunAt: new Date("2026-08-29T10:00:00.000Z"),
            active: true,
          },
          task: {
            id: 9,
            departmentId: 4,
            assignedUserId: null,
            dueTime: "10:00",
            frequency: "weekly",
            active: true,
          },
        },
      ];
      const fake = makeDb([[], recurring, []]);
      state.db = fake.db;

      const cycle = await runOperationalCycle();

      expect(cycle.generatedAssignments).toBe(3);
      const generatedTaskIds = fake.writes
        .filter(write => (write.payload as any)?.taskId)
        .map(write => (write.payload as any).taskId);
      expect(generatedTaskIds).toEqual(expect.arrayContaining([6, 7, 8]));
      expect(generatedTaskIds).not.toContain(9);
    } finally {
      vi.useRealTimers();
    }
  });
});
