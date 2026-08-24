import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  acknowledgeWhatsAppTask,
  cancelWhatsAppTask,
  assignIssue,
  completeTask,
  completeTaskDirectlyByManager,
  completeVerifiedWhatsAppTask,
  createDutyRoster,
  createEquipmentMaintenance,
  createExpiryItem,
  createHandover,
  createInventoryItem,
  createIssue,
  createManagementAction,
  createOperationalFollowUpTask,
  createRisk,
  createTask,
  dispatchWhatsAppTask,
  decideWhatsAppTaskReview,
  getCalendar,
  getDashboard,
  getDepartmentTaskSchedules,
  getIssueHistory,
  getManagementActions,
  getMyDay,
  getOperationalAlerts,
  getOperationsModules,
  getReports,
  getRiskRegister,
  getSettings,
  getTaskDetail,
  getWhatsAppTaskHistory,
  resolveExpiryItem,
  getTaskScoringRules,
  getWhatsAppTaskRegister,
  importDutyRosters,
  listIssues,
  manageDepartment,
  prepareWhatsAppTask,
  recordWhatsAppTaskOpened,
  recordWhatsAppTaskCopied,
  recordWhatsAppTaskOutcome,
  recordWhatsAppTaskResponse,
  resolveIssue,
  reviewWhatsAppTask,
  rescheduleWhatsAppTask,
  saveChecklistResult,
  setDepartmentActive,
  updateDepartment,
  updateDutyAttendance,
  updateEscalationRule,
  updateManagementAction,
  updateNotificationRule,
  updateOperationalAlert,
  updateRisk,
  updateTaskScoringRule,
  updateTaskScheduleConfiguration,
  uploadWhatsAppTaskEvidence,
  submitWhatsAppTaskForReview,
  escalateWhatsAppTask,
} from "../operationsData";

const priority = z.enum(["critical", "high", "medium", "low"]);
const frequency = z.enum([
  "one_time",
  "daily",
  "every_shift",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
]);
const finding = z.enum([
  "available",
  "not_available",
  "damaged",
  "expired",
  "low_stock",
  "under_maintenance",
  "missing",
  "wrong_location",
]);

export const operationsRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => getDashboard(ctx.user)),
  whatsappTaskRegister: protectedProcedure
    .input(z.object({ scope: z.enum(["today", "overdue"]).optional() }))
    .query(({ ctx, input }) =>
      getWhatsAppTaskRegister(ctx.user, input.scope ?? "today")
    ),
  departmentSchedules: protectedProcedure.query(({ ctx }) =>
    getDepartmentTaskSchedules(ctx.user)
  ),
  departmentScheduleUpdate: protectedProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        gracePeriodMinutes: z.number().int().min(0).max(24 * 60),
        escalationDelayMinutes: z.number().int().min(0).max(7 * 24 * 60),
        evidenceRequired: z.boolean(),
        verificationRequired: z.boolean(),
        responsibleRole: z.string().max(120).optional(),
        responseFields: z.array(z.string().min(1).max(120)).max(12).optional(),
      })
    )
    .mutation(({ ctx, input }) => updateTaskScheduleConfiguration(ctx.user, input)),
  myDay: protectedProcedure.query(({ ctx }) => getMyDay(ctx.user)),
  modules: protectedProcedure.query(({ ctx }) =>
    getOperationsModules(ctx.user)
  ),
  reports: protectedProcedure.query(({ ctx }) => getReports(ctx.user)),
  taskDetail: protectedProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .query(({ ctx, input }) => getTaskDetail(ctx.user, input.assignmentId)),
  taskCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(3).max(220),
        description: z.string().max(3000).optional(),
        departmentId: z.number().int().positive(),
        assignedUserId: z.number().int().positive().optional(),
        frequency,
        dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        weeklyDay: z.enum(["saturday", "sunday"]).optional(),
        priority,
        category: z.string().min(2).max(120),
        instructions: z.string().max(5000).optional(),
        approvalRequired: z.boolean().optional(),
        checklist: z.array(z.string().max(300)).max(24),
      })
    )
    .mutation(({ ctx, input }) => createTask(ctx.user, input)),
  checklistSave: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        checklistId: z.number().int().positive(),
        status: finding,
        note: z.string().max(2000).optional(),
      })
    )
    .mutation(({ ctx, input }) => saveChecklistResult(ctx.user, input)),
  taskComplete: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        notes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => completeTask(ctx.user, input)),
  taskManagerDirectComplete: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        notes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      completeTaskDirectlyByManager(ctx.user, input)
    ),
  whatsappTaskPrepare: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        messageText: z.string().min(1).max(5000).optional(),
      })
    )
    .mutation(({ ctx, input }) => prepareWhatsAppTask(ctx.user, input)),
  whatsappTaskCopied: protectedProcedure
    .input(z.object({ dispatchId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => recordWhatsAppTaskCopied(ctx.user, input)),
  whatsappTaskOpened: protectedProcedure
    .input(z.object({ dispatchId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => recordWhatsAppTaskOpened(ctx.user, input)),
  whatsappTaskDispatch: protectedProcedure
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        messageText: z.string().min(1).max(5000).optional(),
      })
    )
    .mutation(({ ctx, input }) => dispatchWhatsAppTask(ctx.user, input)),
  whatsappTaskAcknowledge: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        note: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => acknowledgeWhatsAppTask(ctx.user, input)),
  whatsappTaskOutcome: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        outcome: z.enum(["completed", "pending", "no_reply", "excused"]),
        note: z.string().max(3000).optional(),
        excusedReason: z.string().max(120).optional(),
      })
    )
    .mutation(({ ctx, input }) => recordWhatsAppTaskOutcome(ctx.user, input)),
  whatsappTaskReview: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        close: z.boolean().optional(),
        note: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => reviewWhatsAppTask(ctx.user, input)),
  whatsappTaskResponse: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        responseStatus: z.enum([
          "completed",
          "partially_completed",
          "not_completed",
          "unable_to_complete",
          "valid_exception",
        ]),
        findings: z.string().max(5000).optional(),
        actionTaken: z.string().max(5000).optional(),
        responsibleStaff: z.string().max(220).optional(),
        completedAt: z.date().optional(),
        nonCompletionReason: z.string().max(160).optional(),
        additionalNotes: z.string().max(5000).optional(),
        structuredFields: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
          .optional(),
      })
    )
    .mutation(({ ctx, input }) => recordWhatsAppTaskResponse(ctx.user, input)),
  whatsappTaskSubmitReview: protectedProcedure
    .input(z.object({ dispatchId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => submitWhatsAppTaskForReview(ctx.user, input)),
  whatsappTaskDecision: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        decision: z.enum([
          "verify",
          "rework",
          "valid_exception",
          "department_failure",
        ]),
        note: z.string().min(2).max(5000),
      })
    )
    .mutation(({ ctx, input }) => decideWhatsAppTaskReview(ctx.user, input)),
  whatsappTaskVerifiedComplete: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        note: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => completeVerifiedWhatsAppTask(ctx.user, input)),
  whatsappTaskEscalate: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        reason: z.string().min(2).max(5000),
        escalationLevel: z.string().max(80).optional(),
        escalatedTo: z.string().max(220).optional(),
      })
    )
    .mutation(({ ctx, input }) => escalateWhatsAppTask(ctx.user, input)),
  whatsappTaskCancel: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        reason: z.string().min(2).max(5000),
      })
    )
    .mutation(({ ctx, input }) => cancelWhatsAppTask(ctx.user, input)),
  whatsappTaskReschedule: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        rescheduledDueAt: z.date(),
        reason: z.string().min(2).max(5000),
      })
    )
    .mutation(({ ctx, input }) => rescheduleWhatsAppTask(ctx.user, input)),
  whatsappTaskEvidence: protectedProcedure
    .input(
      z.object({
        dispatchId: z.number().int().positive(),
        fileName: z.string().min(1).max(300),
        mimeType: z.string().min(3).max(160),
        base64Data: z.string().min(1).max(12_000_000),
      })
    )
    .mutation(({ ctx, input }) => uploadWhatsAppTaskEvidence(ctx.user, input)),
  whatsappTaskHistory: protectedProcedure
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .query(({ ctx, input }) => getWhatsAppTaskHistory(ctx.user, input.assignmentId)),
  issues: protectedProcedure.query(({ ctx }) => listIssues(ctx.user)),
  issueCreate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(240),
        description: z.string().max(3000).optional(),
        departmentId: z.number().int().positive(),
        category: z.string().min(2).max(120),
        priority,
        dueAt: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) => createIssue(ctx.user, input)),
  issueAssign: protectedProcedure
    .input(
      z.object({
        issueId: z.number().int().positive(),
        assignedTo: z.number().int().positive(),
        dueAt: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) => assignIssue(ctx.user, input)),
  issueResolve: protectedProcedure
    .input(
      z.object({
        issueId: z.number().int().positive(),
        resolution: z.string().min(3).max(3000),
      })
    )
    .mutation(({ ctx, input }) => resolveIssue(ctx.user, input)),
  issueHistory: protectedProcedure
    .input(z.object({ issueId: z.number().int().positive() }))
    .query(({ ctx, input }) => getIssueHistory(ctx.user, input.issueId)),
  risks: protectedProcedure.query(({ ctx }) => getRiskRegister(ctx.user)),
  riskCreate: protectedProcedure
    .input(
      z.object({
        description: z.string().min(3).max(5000),
        category: z.string().min(2).max(120),
        departmentId: z.number().int().positive(),
        likelihood: z.number().int().min(1).max(5),
        impact: z.number().int().min(1).max(5),
        ownerUserId: z.number().int().positive().optional(),
        mitigationPlan: z.string().max(5000).optional(),
        reviewDate: z.date().optional(),
        relatedIssueId: z.number().int().positive().optional(),
        relatedTaskId: z.number().int().positive().optional(),
      })
    )
    .mutation(({ ctx, input }) => createRisk(ctx.user, input)),
  riskUpdate: protectedProcedure
    .input(
      z.object({
        riskId: z.number().int().positive(),
        status: z.enum([
          "open",
          "mitigating",
          "accepted",
          "resolved",
          "closed",
        ]),
        mitigationPlan: z.string().max(5000).optional(),
        residualRisk: z.number().int().min(0).max(25).optional(),
        reviewDate: z.date().optional(),
      })
    )
    .mutation(({ ctx, input }) => updateRisk(ctx.user, input)),
  managementActions: protectedProcedure.query(({ ctx }) =>
    getManagementActions(ctx.user)
  ),
  managementActionCreate: protectedProcedure
    .input(
      z.object({
        title: z.string().min(3).max(240),
        reason: z.string().max(5000).optional(),
        departmentId: z.number().int().positive(),
        ownerUserId: z.number().int().positive().optional(),
        priority,
        dueAt: z.date().optional(),
        relatedIssueId: z.number().int().positive().optional(),
        relatedRiskId: z.number().int().positive().optional(),
        relatedTaskId: z.number().int().positive().optional(),
        meetingReference: z.string().max(180).optional(),
      })
    )
    .mutation(({ ctx, input }) => createManagementAction(ctx.user, input)),
  managementActionUpdate: protectedProcedure
    .input(
      z.object({
        actionId: z.number().int().positive(),
        status: z.enum([
          "open",
          "in_progress",
          "completed",
          "overdue",
          "cancelled",
        ]),
        completionNotes: z.string().max(5000).optional(),
        verification: z.string().max(5000).optional(),
      })
    )
    .mutation(({ ctx, input }) => updateManagementAction(ctx.user, input)),
  scoringRules: protectedProcedure.query(({ ctx }) =>
    getTaskScoringRules(ctx.user)
  ),
  scoringRuleUpdate: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        weightTenths: z.number().int().min(0).max(1000),
      })
    )
    .mutation(({ ctx, input }) => updateTaskScoringRule(ctx.user, input)),
  handoverCreate: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        shift: z.string().min(2).max(80),
        pendingTasks: z.string().max(3000).optional(),
        equipmentProblems: z.string().max(3000).optional(),
        stockShortages: z.string().max(3000).optional(),
        incidents: z.string().max(3000).optional(),
        operationalNotes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => createHandover(ctx.user, input)),
  departmentCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(160),
        code: z.string().min(2).max(24),
        description: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => manageDepartment(ctx.user, input)),
  departmentSetActive: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => setDepartmentActive(ctx.user, input)),
  departmentUpdate: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        name: z.string().min(2).max(160),
        code: z.string().min(2).max(24),
        description: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => updateDepartment(ctx.user, input)),
  inventoryCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(220),
        category: z.string().min(2).max(120),
        departmentId: z.number().int().positive(),
        quantity: z.number().int().min(0),
        reorderLevel: z.number().int().min(0),
        unit: z.string().min(1).max(32),
      })
    )
    .mutation(({ ctx, input }) => createInventoryItem(ctx.user, input)),
  expiryCreate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(220),
        category: z.string().min(2).max(120),
        departmentId: z.number().int().positive(),
        batchNumber: z.string().max(100).optional(),
        quantity: z.number().int().positive(),
        expiryDate: z.date(),
        storageLocation: z.string().max(180).optional(),
      })
    )
    .mutation(({ ctx, input }) => createExpiryItem(ctx.user, input)),
  expiryResolve: protectedProcedure
    .input(z.object({ expiryItemId: z.number().int().positive() }))
    .mutation(({ ctx, input }) => resolveExpiryItem(ctx.user, input)),
  maintenanceCreate: protectedProcedure
    .input(
      z.object({
        equipmentId: z.number().int().positive(),
        maintenanceType: z.string().min(2).max(120),
        scheduledAt: z.date(),
        vendor: z.string().max(180).optional(),
        notes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => createEquipmentMaintenance(ctx.user, input)),
  operationalFollowUpCreate: protectedProcedure
    .input(
      z.object({
        sourceType: z.enum(["inventory", "expiry", "equipment"]),
        sourceId: z.number().int().positive(),
      })
    )
    .mutation(({ ctx, input }) =>
      createOperationalFollowUpTask(ctx.user, input)
    ),
  dutyRosterCreate: protectedProcedure
    .input(
      z.object({
        departmentId: z.number().int().positive(),
        userId: z.number().int().positive(),
        dutyDate: z.date(),
        shift: z.string().min(2).max(80),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        assignedDuty: z.string().min(2).max(180),
        attendance: z
          .enum(["present", "absent", "late", "leave", "replacement"])
          .optional(),
        notes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => createDutyRoster(ctx.user, input)),
  dutyRosterImport: protectedProcedure
    .input(
      z.object({
        rows: z
          .array(
            z.object({
              departmentId: z.number().int().positive(),
              userId: z.number().int().positive(),
              dutyDate: z.date(),
              shift: z.string().min(2).max(80),
              startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
              endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
              assignedDuty: z.string().min(2).max(180),
              attendance: z
                .enum(["present", "absent", "late", "leave", "replacement"])
                .optional(),
              notes: z.string().max(3000).optional(),
            })
          )
          .min(1)
          .max(250),
      })
    )
    .mutation(({ ctx, input }) => importDutyRosters(ctx.user, input)),
  dutyAttendanceUpdate: protectedProcedure
    .input(
      z.object({
        rosterId: z.number().int().positive(),
        attendance: z.enum([
          "present",
          "absent",
          "late",
          "leave",
          "replacement",
        ]),
        replacementUserId: z.number().int().positive().optional(),
        notes: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => updateDutyAttendance(ctx.user, input)),
  operationalAlerts: protectedProcedure.query(({ ctx }) =>
    getOperationalAlerts(ctx.user)
  ),
  operationalAlertUpdate: protectedProcedure
    .input(
      z.object({
        notificationId: z.number().int().positive(),
        action: z.enum(["assign", "acknowledge", "resolve", "reopen"]),
        ownerUserId: z.number().int().positive().optional(),
        note: z.string().max(3000).optional(),
      })
    )
    .mutation(({ ctx, input }) => updateOperationalAlert(ctx.user, input)),
  calendar: protectedProcedure.query(({ ctx }) => getCalendar(ctx.user)),
  settings: protectedProcedure.query(({ ctx }) => getSettings(ctx.user)),
  escalationRuleUpdate: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        firstReminderMinutes: z.number().int().min(0).max(10_080),
        departmentHeadMinutes: z.number().int().min(0).max(10_080),
        adminMinutes: z.number().int().min(0).max(10_080),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => updateEscalationRule(ctx.user, input)),
  notificationRuleUpdate: protectedProcedure
    .input(
      z.object({
        ruleId: z.number().int().positive(),
        inAppEnabled: z.boolean(),
        emailEnabled: z.boolean(),
        leadMinutes: z.number().int().min(0).max(525_600),
        active: z.boolean(),
      })
    )
    .mutation(({ ctx, input }) => updateNotificationRule(ctx.user, input)),
});
