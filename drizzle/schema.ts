import {
  boolean,
  date,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const userRoles = [
  "super_admin",
  "hospital_admin",
  "department_head",
  "supervisor",
  "staff",
  "viewer",
] as const;
export const taskFrequencies = [
  "one_time",
  "daily",
  "every_shift",
  "weekly",
  "monthly",
  "quarterly",
  "yearly",
  "custom",
] as const;
export const taskPriorities = ["critical", "high", "medium", "low"] as const;
export const taskStatuses = [
  "not_started",
  "in_progress",
  "completed",
  "failed",
  "skipped",
  "overdue",
  "pending_approval",
  "reopened",
] as const;
export const whatsappDispatchStatuses = [
  "prepared",
  "copied",
  "sent",
  "awaiting_reply",
  "acknowledged",
  "replied",
  "under_review",
  "rework_required",
  "replied_again",
  "verified",
  "completed",
  "pending",
  "no_reply",
  "excused",
  "valid_exception",
  "overdue",
  "escalated",
  "cancelled",
  "rescheduled",
  "manager_completed",
  "reviewed",
  "closed",
] as const;
export const whatsappResponseStatuses = [
  "completed",
  "partially_completed",
  "not_completed",
  "unable_to_complete",
  "valid_exception",
] as const;
export const taskAccountabilityParties = [
  "manager",
  "department",
  "shared",
  "none",
] as const;
export const findingStatuses = [
  "available",
  "not_available",
  "damaged",
  "expired",
  "low_stock",
  "under_maintenance",
  "missing",
  "wrong_location",
] as const;
export const issuePriorities = ["critical", "high", "medium", "low"] as const;
export const issueStatuses = [
  "open",
  "assigned",
  "in_progress",
  "escalated",
  "resolved",
  "closed",
] as const;
export const equipmentStatuses = [
  "working",
  "damaged",
  "under_maintenance",
  "out_of_service",
  "retired",
] as const;
export const attendanceStatuses = [
  "present",
  "absent",
  "late",
  "leave",
  "replacement",
] as const;
export const notificationHandlingStatuses = [
  "open",
  "acknowledged",
  "resolved",
] as const;
export const riskStatuses = [
  "open",
  "mitigating",
  "accepted",
  "resolved",
  "closed",
] as const;
export const managementActionStatuses = [
  "open",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("staff").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  description: text("description"),
  headUserId: int("headUserId"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  building: varchar("building", { length: 120 }),
  floor: varchar("floor", { length: 40 }),
  departmentId: int("departmentId"),
  active: boolean("active").default(true).notNull(),
});

export const staffProfiles = mysqlTable("staffProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  departmentId: int("departmentId"),
  employeeCode: varchar("employeeCode", { length: 32 }),
  title: varchar("title", { length: 120 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const staffCredentials = mysqlTable("staffCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  passwordChangedAt: timestamp("passwordChangedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tasks = mysqlTable(
  "tasks",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 220 }).notNull(),
    description: text("description"),
    departmentId: int("departmentId").notNull(),
    assignedUserId: int("assignedUserId"),
    backupUserId: int("backupUserId"),
    frequency: mysqlEnum("frequency", taskFrequencies).notNull(),
    recurrenceRule: varchar("recurrenceRule", { length: 180 }),
    startDate: date("startDate"),
    endDate: date("endDate"),
    dueTime: varchar("dueTime", { length: 10 }).notNull(),
    priority: mysqlEnum("priority", taskPriorities).default("medium").notNull(),
    pointWeightTenths: int("pointWeightTenths").default(10).notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    instructions: text("instructions"),
    managerNotes: text("managerNotes"),
    expectedCompletionMinutes: int("expectedCompletionMinutes"),
    gracePeriodMinutes: int("gracePeriodMinutes").default(30).notNull(),
    escalationDelayMinutes: int("escalationDelayMinutes").default(60).notNull(),
    timezone: varchar("timezone", { length: 64 })
      .default("Asia/Kathmandu")
      .notNull(),
    responseSchema: json("responseSchema"),
    responsibleRole: varchar("responsibleRole", { length: 120 }),
    escalationRuleId: int("escalationRuleId"),
    operatingDays: json("operatingDays"),
    holidayPolicy: varchar("holidayPolicy", { length: 40 })
      .default("run")
      .notNull(),
    dependencyTaskIds: json("dependencyTaskIds"),
    evidenceRequired: boolean("evidenceRequired").default(false).notNull(),
    photoRequired: boolean("photoRequired").default(false).notNull(),
    approvalRequired: boolean("approvalRequired").default(false).notNull(),
    verificationRequired: boolean("verificationRequired")
      .default(false)
      .notNull(),
    active: boolean("active").default(true).notNull(),
    createdBy: int("createdBy").notNull(),
    lastModifiedBy: int("lastModifiedBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("task_department_idx").on(table.departmentId),
    activeIdx: index("task_active_idx").on(table.active),
  })
);

export const taskChecklists = mysqlTable("taskChecklists", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  label: varchar("label", { length: 300 }).notNull(),
  instructions: text("instructions"),
  required: boolean("required").default(true).notNull(),
  position: int("position").default(0).notNull(),
  expectedLocation: varchar("expectedLocation", { length: 180 }),
  active: boolean("active").default(true).notNull(),
});

export const recurringTasks = mysqlTable(
  "recurringTasks",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull().unique(),
    nextRunAt: timestamp("nextRunAt").notNull(),
    lastGeneratedFor: varchar("lastGeneratedFor", { length: 20 }),
    scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
    active: boolean("active").default(true).notNull(),
  },
  table => ({
    jobIdx: index("recurring_job_idx").on(table.scheduleCronTaskUid),
  })
);

export const taskAssignments = mysqlTable(
  "taskAssignments",
  {
    id: int("id").autoincrement().primaryKey(),
    taskId: int("taskId").notNull(),
    departmentId: int("departmentId").notNull(),
    assignedUserId: int("assignedUserId"),
    dueAt: timestamp("dueAt").notNull(),
    status: mysqlEnum("status", taskStatuses).default("not_started").notNull(),
    completedAt: timestamp("completedAt"),
    approvedAt: timestamp("approvedAt"),
    approvedBy: int("approvedBy"),
    reopenedAt: timestamp("reopenedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    assigneeIdx: index("assignment_assignee_idx").on(table.assignedUserId),
    dueIdx: index("assignment_due_idx").on(table.dueAt),
    taskIdx: index("assignment_task_idx").on(table.taskId),
    taskDueUnique: uniqueIndex("assignment_task_due_unique").on(
      table.taskId,
      table.dueAt
    ),
  })
);

export const whatsappTaskDispatches = mysqlTable(
  "whatsappTaskDispatches",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull().unique(),
    taskId: int("taskId").notNull(),
    departmentId: int("departmentId").notNull(),
    sentByUserId: int("sentByUserId").notNull(),
    channel: varchar("channel", { length: 32 }).default("whatsapp").notNull(),
    messageText: text("messageText").notNull(),
    status: mysqlEnum("status", whatsappDispatchStatuses)
      .default("sent")
      .notNull(),
    preparedAt: timestamp("preparedAt"),
    copiedAt: timestamp("copiedAt"),
    sentAt: timestamp("sentAt"),
    openedAt: timestamp("openedAt"),
    acknowledgedAt: timestamp("acknowledgedAt"),
    respondedAt: timestamp("respondedAt"),
    reviewedAt: timestamp("reviewedAt"),
    verifiedAt: timestamp("verifiedAt"),
    escalatedAt: timestamp("escalatedAt"),
    cancelledAt: timestamp("cancelledAt"),
    rescheduledAt: timestamp("rescheduledAt"),
    closedAt: timestamp("closedAt"),
    excusedReason: varchar("excusedReason", { length: 120 }),
    responseNote: text("responseNote"),
    currentResponseId: int("currentResponseId"),
    statusChangedAt: timestamp("statusChangedAt").defaultNow().notNull(),
    penaltyApplied: boolean("penaltyApplied").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("whatsapp_dispatch_department_idx").on(
      table.departmentId
    ),
    statusIdx: index("whatsapp_dispatch_status_idx").on(table.status),
  })
);

export const taskLifecycleEvents = mysqlTable(
  "taskLifecycleEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull(),
    dispatchId: int("dispatchId"),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    previousStatus: varchar("previousStatus", { length: 80 }),
    newStatus: varchar("newStatus", { length: 80 }),
    actorRole: varchar("actorRole", { length: 40 }),
    note: text("note"),
    metadata: json("metadata"),
    recordedByUserId: int("recordedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    assignmentIdx: index("task_lifecycle_assignment_idx").on(
      table.assignmentId
    ),
    dispatchIdx: index("task_lifecycle_dispatch_idx").on(table.dispatchId),
  })
);

export const taskScoringRules = mysqlTable("taskScoringRules", {
  id: int("id").autoincrement().primaryKey(),
  priority: mysqlEnum("priority", taskPriorities).notNull().unique(),
  weightTenths: int("weightTenths").notNull(),
  lateWeightTenths: int("lateWeightTenths").default(0).notNull(),
  escalatedWeightTenths: int("escalatedWeightTenths").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
  updatedByUserId: int("updatedByUserId"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const whatsappMessageTemplates = mysqlTable(
  "whatsappMessageTemplates",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    templateType: varchar("templateType", { length: 40 })
      .default("task")
      .notNull(),
    departmentId: int("departmentId"),
    category: varchar("category", { length: 120 }),
    priority: mysqlEnum("priority", taskPriorities),
    body: text("body").notNull(),
    active: boolean("active").default(true).notNull(),
    createdByUserId: int("createdByUserId").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("whatsapp_template_department_idx").on(
      table.departmentId
    ),
  })
);

export const whatsappTaskResponses = mysqlTable(
  "whatsappTaskResponses",
  {
    id: int("id").autoincrement().primaryKey(),
    dispatchId: int("dispatchId").notNull(),
    assignmentId: int("assignmentId").notNull(),
    responseStatus: mysqlEnum("responseStatus", whatsappResponseStatuses)
      .notNull(),
    findings: text("findings"),
    actionTaken: text("actionTaken"),
    responsibleStaff: varchar("responsibleStaff", { length: 220 }),
    completedAt: timestamp("completedAt"),
    nonCompletionReason: varchar("nonCompletionReason", { length: 160 }),
    additionalNotes: text("additionalNotes"),
    structuredFields: json("structuredFields"),
    version: int("version").default(1).notNull(),
    isCurrent: boolean("isCurrent").default(true).notNull(),
    submittedByUserId: int("submittedByUserId").notNull(),
    submittedAt: timestamp("submittedAt").defaultNow().notNull(),
    reviewedByUserId: int("reviewedByUserId"),
    reviewedAt: timestamp("reviewedAt"),
    reviewDecision: varchar("reviewDecision", { length: 40 }),
    reviewNote: text("reviewNote"),
  },
  table => ({
    dispatchIdx: index("whatsapp_response_dispatch_idx").on(table.dispatchId),
    assignmentIdx: index("whatsapp_response_assignment_idx").on(
      table.assignmentId
    ),
    currentIdx: index("whatsapp_response_current_idx").on(
      table.dispatchId,
      table.isCurrent
    ),
  })
);

export const whatsappTaskEvidence = mysqlTable(
  "whatsappTaskEvidence",
  {
    id: int("id").autoincrement().primaryKey(),
    dispatchId: int("dispatchId").notNull(),
    responseId: int("responseId"),
    storageKey: varchar("storageKey", { length: 600 }).notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    fileName: varchar("fileName", { length: 300 }).notNull(),
    mimeType: varchar("mimeType", { length: 160 }).notNull(),
    uploadedByUserId: int("uploadedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    dispatchIdx: index("whatsapp_evidence_dispatch_idx").on(table.dispatchId),
    responseIdx: index("whatsapp_evidence_response_idx").on(table.responseId),
  })
);

export const whatsappTaskEscalations = mysqlTable(
  "whatsappTaskEscalations",
  {
    id: int("id").autoincrement().primaryKey(),
    dispatchId: int("dispatchId"),
    assignmentId: int("assignmentId").notNull(),
    escalatedByUserId: int("escalatedByUserId"),
    escalationLevel: varchar("escalationLevel", { length: 80 }).notNull(),
    reason: text("reason").notNull(),
    escalatedTo: varchar("escalatedTo", { length: 220 }),
    resolution: text("resolution"),
    resolvedByUserId: int("resolvedByUserId"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    assignmentIdx: index("whatsapp_escalation_assignment_idx").on(
      table.assignmentId
    ),
    dispatchIdx: index("whatsapp_escalation_dispatch_idx").on(table.dispatchId),
  })
);

export const whatsappTaskReschedules = mysqlTable(
  "whatsappTaskReschedules",
  {
    id: int("id").autoincrement().primaryKey(),
    originalAssignmentId: int("originalAssignmentId").notNull(),
    successorAssignmentId: int("successorAssignmentId"),
    previousDueAt: timestamp("previousDueAt").notNull(),
    rescheduledDueAt: timestamp("rescheduledDueAt").notNull(),
    reason: text("reason").notNull(),
    rescheduledByUserId: int("rescheduledByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    originalIdx: index("whatsapp_reschedule_original_idx").on(
      table.originalAssignmentId
    ),
    successorIdx: index("whatsapp_reschedule_successor_idx").on(
      table.successorAssignmentId
    ),
  })
);

export const taskAccountabilityDecisions = mysqlTable(
  "taskAccountabilityDecisions",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull(),
    dispatchId: int("dispatchId"),
    departmentId: int("departmentId").notNull(),
    accountableParty: mysqlEnum("accountableParty", taskAccountabilityParties)
      .notNull(),
    outcome: varchar("outcome", { length: 80 }).notNull(),
    pointDeltaTenths: int("pointDeltaTenths").default(0).notNull(),
    reason: text("reason").notNull(),
    decidedByUserId: int("decidedByUserId").notNull(),
    decidedAt: timestamp("decidedAt").defaultNow().notNull(),
  },
  table => ({
    assignmentIdx: index("task_accountability_assignment_idx").on(
      table.assignmentId
    ),
    dispatchIdx: index("task_accountability_dispatch_idx").on(table.dispatchId),
    departmentIdx: index("task_accountability_department_idx").on(
      table.departmentId
    ),
  })
);

export const departmentMonthlyScoreSnapshots = mysqlTable(
  "departmentMonthlyScoreSnapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull(),
    monthKey: varchar("monthKey", { length: 7 }).notNull(),
    scoreTenths: int("scoreTenths").notNull(),
    assignedCount: int("assignedCount").default(0).notNull(),
    completedCount: int("completedCount").default(0).notNull(),
    lateCount: int("lateCount").default(0).notNull(),
    overdueCount: int("overdueCount").default(0).notNull(),
    escalatedCount: int("escalatedCount").default(0).notNull(),
    validExceptionCount: int("validExceptionCount").default(0).notNull(),
    compliancePercent: int("compliancePercent").default(100).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentMonthUnique: uniqueIndex("department_month_score_unique").on(
      table.departmentId,
      table.monthKey
    ),
  })
);

export const departmentPointEvents = mysqlTable(
  "departmentPointEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull(),
    dispatchId: int("dispatchId").notNull().unique(),
    pointDelta: int("pointDelta").notNull(),
    reason: varchar("reason", { length: 240 }).notNull(),
    recordedByUserId: int("recordedByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    departmentIdx: index("department_point_event_department_idx").on(
      table.departmentId
    ),
  })
);

export const taskChecklistResults = mysqlTable(
  "taskChecklistResults",
  {
    id: int("id").autoincrement().primaryKey(),
    assignmentId: int("assignmentId").notNull(),
    checklistId: int("checklistId").notNull(),
    status: mysqlEnum("status", findingStatuses).default("available").notNull(),
    note: text("note"),
    evidenceUrl: varchar("evidenceUrl", { length: 1024 }),
    reportedBy: int("reportedBy").notNull(),
    createdIssueId: int("createdIssueId"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    assignmentChecklistUnique: uniqueIndex("assignment_checklist_unique").on(
      table.assignmentId,
      table.checklistId
    ),
  })
);

export const taskCompletions = mysqlTable("taskCompletions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull().unique(),
  taskId: int("taskId").notNull(),
  userId: int("userId").notNull(),
  departmentId: int("departmentId").notNull(),
  status: mysqlEnum("status", taskStatuses).notNull(),
  notes: text("notes"),
  evidenceUrl: varchar("evidenceUrl", { length: 1024 }),
  approvalStatus: mysqlEnum("approvalStatus", [
    "not_required",
    "pending",
    "approved",
    "rejected",
  ])
    .default("not_required")
    .notNull(),
  reviewerId: int("reviewerId"),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
});

export const issues = mysqlTable(
  "issues",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 240 }).notNull(),
    description: text("description"),
    departmentId: int("departmentId").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    priority: mysqlEnum("priority", issuePriorities)
      .default("medium")
      .notNull(),
    status: mysqlEnum("status", issueStatuses).default("open").notNull(),
    sourceType: varchar("sourceType", { length: 64 }),
    sourceId: int("sourceId"),
    reportedBy: int("reportedBy").notNull(),
    assignedTo: int("assignedTo"),
    dueAt: timestamp("dueAt"),
    severity: varchar("severity", { length: 40 }),
    rootCause: text("rootCause"),
    immediateAction: text("immediateAction"),
    correctiveAction: text("correctiveAction"),
    preventiveAction: text("preventiveAction"),
    verification: text("verification"),
    verifiedBy: int("verifiedBy"),
    verifiedAt: timestamp("verifiedAt"),
    resolution: text("resolution"),
    closedBy: int("closedBy"),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("issue_department_idx").on(table.departmentId),
    statusIdx: index("issue_status_idx").on(table.status),
  })
);

export const issueComments = mysqlTable("issueComments", {
  id: int("id").autoincrement().primaryKey(),
  issueId: int("issueId").notNull(),
  userId: int("userId").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const equipment = mysqlTable(
  "equipment",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 220 }).notNull(),
    equipmentCode: varchar("equipmentCode", { length: 64 }).notNull().unique(),
    departmentId: int("departmentId").notNull(),
    locationId: int("locationId"),
    manufacturer: varchar("manufacturer", { length: 160 }),
    model: varchar("model", { length: 160 }),
    category: varchar("category", { length: 120 }),
    criticality: mysqlEnum("criticality", taskPriorities)
      .default("medium")
      .notNull(),
    serialNumber: varchar("serialNumber", { length: 160 }),
    purchaseDate: date("purchaseDate"),
    warrantyExpiry: date("warrantyExpiry"),
    lastServiceAt: timestamp("lastServiceAt"),
    nextServiceAt: timestamp("nextServiceAt"),
    calibrationAt: timestamp("calibrationAt"),
    nextCalibrationAt: timestamp("nextCalibrationAt"),
    condition: varchar("condition", { length: 120 }),
    responsibleUserId: int("responsibleUserId"),
    maintenanceCompany: varchar("maintenanceCompany", { length: 180 }),
    documentUrl: varchar("documentUrl", { length: 1024 }),
    notes: text("notes"),
    status: mysqlEnum("status", equipmentStatuses).default("working").notNull(),
    active: boolean("active").default(true).notNull(),
  },
  table => ({
    departmentIdx: index("equipment_department_idx").on(table.departmentId),
  })
);

export const equipmentMaintenance = mysqlTable("equipmentMaintenance", {
  id: int("id").autoincrement().primaryKey(),
  equipmentId: int("equipmentId").notNull(),
  maintenanceType: varchar("maintenanceType", { length: 120 }).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  completedAt: timestamp("completedAt"),
  vendor: varchar("vendor", { length: 180 }),
  notes: text("notes"),
  status: mysqlEnum("status", [
    "scheduled",
    "in_progress",
    "completed",
    "overdue",
  ])
    .default("scheduled")
    .notNull(),
});

export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 220 }).notNull(),
  genericName: varchar("genericName", { length: 220 }),
  brand: varchar("brand", { length: 220 }),
  category: varchar("category", { length: 120 }).notNull(),
  departmentId: int("departmentId").notNull(),
  locationId: int("locationId"),
  quantity: int("quantity").default(0).notNull(),
  reorderLevel: int("reorderLevel").default(0).notNull(),
  minimumStock: int("minimumStock").default(0).notNull(),
  maximumStock: int("maximumStock"),
  supplier: varchar("supplier", { length: 180 }),
  unitPrice: int("unitPrice"),
  unit: varchar("unit", { length: 32 }).default("units").notNull(),
  responsibleUserId: int("responsibleUserId"),
  active: boolean("active").default(true).notNull(),
});

export const expiryItems = mysqlTable(
  "expiryItems",
  {
    id: int("id").autoincrement().primaryKey(),
    inventoryId: int("inventoryId"),
    name: varchar("name", { length: 220 }).notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    departmentId: int("departmentId").notNull(),
    batchNumber: varchar("batchNumber", { length: 100 }),
    quantity: int("quantity").default(1).notNull(),
    expiryDate: date("expiryDate").notNull(),
    storageLocation: varchar("storageLocation", { length: 180 }),
    responsibleUserId: int("responsibleUserId"),
    active: boolean("active").default(true).notNull(),
  },
  table => ({
    expiryIdx: index("expiry_date_idx").on(table.expiryDate),
  })
);

export const dutyRosters = mysqlTable(
  "dutyRosters",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull(),
    userId: int("userId").notNull(),
    dutyDate: date("dutyDate").notNull(),
    shift: varchar("shift", { length: 80 }).notNull(),
    startTime: varchar("startTime", { length: 10 }).notNull(),
    endTime: varchar("endTime", { length: 10 }).notNull(),
    assignedDuty: varchar("assignedDuty", { length: 180 }).notNull(),
    attendance: mysqlEnum("attendance", attendanceStatuses)
      .default("present")
      .notNull(),
    replacementUserId: int("replacementUserId"),
    notes: text("notes"),
  },
  table => ({
    rosterDateIdx: index("roster_date_idx").on(table.dutyDate),
    rosterSlotUnique: uniqueIndex("roster_slot_unique").on(
      table.departmentId,
      table.userId,
      table.dutyDate,
      table.shift,
      table.startTime
    ),
  })
);

export const departmentStaffingTargets = mysqlTable(
  "departmentStaffingTargets",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull(),
    shift: varchar("shift", { length: 80 }).notNull(),
    requiredStaff: int("requiredStaff").notNull(),
    warningCoveragePercent: int("warningCoveragePercent").default(90).notNull(),
    criticalCoveragePercent: int("criticalCoveragePercent")
      .default(75)
      .notNull(),
    active: boolean("active").default(true).notNull(),
  },
  table => ({
    departmentShiftUnique: uniqueIndex(
      "staffing_target_department_shift_unique"
    ).on(table.departmentId, table.shift),
  })
);

export const shiftHandovers = mysqlTable("shiftHandovers", {
  id: int("id").autoincrement().primaryKey(),
  departmentId: int("departmentId").notNull(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId"),
  shift: varchar("shift", { length: 80 }).notNull(),
  handoverDate: date("handoverDate").notNull(),
  pendingTasks: text("pendingTasks"),
  equipmentProblems: text("equipmentProblems"),
  stockShortages: text("stockShortages"),
  incidents: text("incidents"),
  operationalNotes: text("operationalNotes"),
  unresolved: boolean("unresolved").default(true).notNull(),
  acknowledgedAt: timestamp("acknowledgedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable(
  "notifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId"),
    departmentId: int("departmentId"),
    type: varchar("type", { length: 80 }).notNull(),
    title: varchar("title", { length: 220 }).notNull(),
    body: text("body").notNull(),
    entityType: varchar("entityType", { length: 64 }),
    entityId: int("entityId"),
    handlingStatus: mysqlEnum("handlingStatus", notificationHandlingStatuses)
      .default("open")
      .notNull(),
    ownerUserId: int("ownerUserId"),
    acknowledgedByUserId: int("acknowledgedByUserId"),
    acknowledgedAt: timestamp("acknowledgedAt"),
    resolvedByUserId: int("resolvedByUserId"),
    resolvedAt: timestamp("resolvedAt"),
    handlingNote: text("handlingNote"),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    recipientIdx: index("notification_recipient_idx").on(table.userId),
    handlingIdx: index("notification_handling_idx").on(table.handlingStatus),
    ownerIdx: index("notification_owner_idx").on(table.ownerUserId),
  })
);

export const operationalIndicatorRules = mysqlTable(
  "operationalIndicatorRules",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 80 }).notNull().unique(),
    label: varchar("label", { length: 180 }).notNull(),
    warningThreshold: int("warningThreshold").notNull(),
    criticalThreshold: int("criticalThreshold").notNull(),
    active: boolean("active").default(true).notNull(),
    updatedByUserId: int("updatedByUserId"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  }
);

export const risks = mysqlTable(
  "risks",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 32 }).notNull().unique(),
    description: text("description").notNull(),
    category: varchar("category", { length: 120 }).notNull(),
    departmentId: int("departmentId").notNull(),
    likelihood: int("likelihood").notNull(),
    impact: int("impact").notNull(),
    severity: mysqlEnum("severity", taskPriorities).default("medium").notNull(),
    ownerUserId: int("ownerUserId"),
    mitigationPlan: text("mitigationPlan"),
    reviewDate: timestamp("reviewDate"),
    residualRisk: int("residualRisk"),
    status: mysqlEnum("status", riskStatuses).default("open").notNull(),
    relatedIssueId: int("relatedIssueId"),
    relatedTaskId: int("relatedTaskId"),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("risk_department_idx").on(table.departmentId),
    statusIdx: index("risk_status_idx").on(table.status),
  })
);

export const managementActions = mysqlTable(
  "managementActions",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    reason: text("reason"),
    departmentId: int("departmentId").notNull(),
    ownerUserId: int("ownerUserId"),
    priority: mysqlEnum("priority", taskPriorities).default("medium").notNull(),
    dueAt: timestamp("dueAt"),
    status: mysqlEnum("status", managementActionStatuses)
      .default("open")
      .notNull(),
    relatedIssueId: int("relatedIssueId"),
    relatedRiskId: int("relatedRiskId"),
    relatedTaskId: int("relatedTaskId"),
    meetingReference: varchar("meetingReference", { length: 180 }),
    completionNotes: text("completionNotes"),
    verification: text("verification"),
    verifiedByUserId: int("verifiedByUserId"),
    verifiedAt: timestamp("verifiedAt"),
    createdByUserId: int("createdByUserId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    departmentIdx: index("management_action_department_idx").on(
      table.departmentId
    ),
    statusIdx: index("management_action_status_idx").on(table.status),
    dueIdx: index("management_action_due_idx").on(table.dueAt),
  })
);

export const escalationRules = mysqlTable("escalationRules", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  appliesTo: varchar("appliesTo", { length: 80 }).notNull(),
  priority: mysqlEnum("priority", issuePriorities),
  firstReminderMinutes: int("firstReminderMinutes").default(15).notNull(),
  departmentHeadMinutes: int("departmentHeadMinutes").default(60).notNull(),
  adminMinutes: int("adminMinutes").default(180).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const notificationRules = mysqlTable("notificationRules", {
  id: int("id").autoincrement().primaryKey(),
  eventType: varchar("eventType", { length: 80 }).notNull().unique(),
  label: varchar("label", { length: 180 }).notNull(),
  inAppEnabled: boolean("inAppEnabled").default(true).notNull(),
  emailEnabled: boolean("emailEnabled").default(false).notNull(),
  leadMinutes: int("leadMinutes").default(15).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorUserId: int("actorUserId"),
    action: varchar("action", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 80 }).notNull(),
    entityId: int("entityId"),
    previousValue: json("previousValue"),
    newValue: json("newValue"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    entityIdx: index("audit_entity_idx").on(table.entityType, table.entityId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
