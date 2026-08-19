CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`previousValue` json,
	`newValue` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`code` varchar(24) NOT NULL,
	`description` text,
	`headUserId` int,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departments_id` PRIMARY KEY(`id`),
	CONSTRAINT `departments_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `dutyRosters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`userId` int NOT NULL,
	`dutyDate` date NOT NULL,
	`shift` varchar(80) NOT NULL,
	`startTime` varchar(10) NOT NULL,
	`endTime` varchar(10) NOT NULL,
	`assignedDuty` varchar(180) NOT NULL,
	`attendance` enum('present','absent','late','leave','replacement') NOT NULL DEFAULT 'present',
	`replacementUserId` int,
	`notes` text,
	CONSTRAINT `dutyRosters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `equipment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(220) NOT NULL,
	`equipmentCode` varchar(64) NOT NULL,
	`departmentId` int NOT NULL,
	`locationId` int,
	`manufacturer` varchar(160),
	`model` varchar(160),
	`serialNumber` varchar(160),
	`purchaseDate` date,
	`warrantyExpiry` date,
	`lastServiceAt` timestamp,
	`nextServiceAt` timestamp,
	`calibrationAt` timestamp,
	`nextCalibrationAt` timestamp,
	`condition` varchar(120),
	`responsibleUserId` int,
	`maintenanceCompany` varchar(180),
	`documentUrl` varchar(1024),
	`notes` text,
	`status` enum('working','damaged','under_maintenance','out_of_service','retired') NOT NULL DEFAULT 'working',
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `equipment_id` PRIMARY KEY(`id`),
	CONSTRAINT `equipment_equipmentCode_unique` UNIQUE(`equipmentCode`)
);
--> statement-breakpoint
CREATE TABLE `equipmentMaintenance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`equipmentId` int NOT NULL,
	`maintenanceType` varchar(120) NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`completedAt` timestamp,
	`vendor` varchar(180),
	`notes` text,
	`status` enum('scheduled','in_progress','completed','overdue') NOT NULL DEFAULT 'scheduled',
	CONSTRAINT `equipmentMaintenance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `escalationRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`appliesTo` varchar(80) NOT NULL,
	`priority` enum('critical','high','medium','low'),
	`firstReminderMinutes` int NOT NULL DEFAULT 15,
	`departmentHeadMinutes` int NOT NULL DEFAULT 60,
	`adminMinutes` int NOT NULL DEFAULT 180,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `escalationRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expiryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryId` int,
	`name` varchar(220) NOT NULL,
	`category` varchar(120) NOT NULL,
	`departmentId` int NOT NULL,
	`batchNumber` varchar(100),
	`quantity` int NOT NULL DEFAULT 1,
	`expiryDate` date NOT NULL,
	`storageLocation` varchar(180),
	`responsibleUserId` int,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `expiryItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(220) NOT NULL,
	`category` varchar(120) NOT NULL,
	`departmentId` int NOT NULL,
	`locationId` int,
	`quantity` int NOT NULL DEFAULT 0,
	`reorderLevel` int NOT NULL DEFAULT 0,
	`unit` varchar(32) NOT NULL DEFAULT 'units',
	`responsibleUserId` int,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issueComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issueId` int NOT NULL,
	`userId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `issueComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`departmentId` int NOT NULL,
	`category` varchar(120) NOT NULL,
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('open','assigned','in_progress','escalated','resolved','closed') NOT NULL DEFAULT 'open',
	`sourceType` varchar(64),
	`sourceId` int,
	`reportedBy` int NOT NULL,
	`assignedTo` int,
	`dueAt` timestamp,
	`resolution` text,
	`closedBy` int,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `issues_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`building` varchar(120),
	`floor` varchar(40),
	`departmentId` int,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`departmentId` int,
	`type` varchar(80) NOT NULL,
	`title` varchar(220) NOT NULL,
	`body` text NOT NULL,
	`entityType` varchar(64),
	`entityId` int,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurringTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`nextRunAt` timestamp NOT NULL,
	`lastGeneratedFor` varchar(20),
	`schedule_cron_task_uid` varchar(65),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `recurringTasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurringTasks_taskId_unique` UNIQUE(`taskId`)
);
--> statement-breakpoint
CREATE TABLE `shiftHandovers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int,
	`shift` varchar(80) NOT NULL,
	`handoverDate` date NOT NULL,
	`pendingTasks` text,
	`equipmentProblems` text,
	`stockShortages` text,
	`incidents` text,
	`operationalNotes` text,
	`unresolved` boolean NOT NULL DEFAULT true,
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shiftHandovers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `staffProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`departmentId` int,
	`employeeCode` varchar(32),
	`title` varchar(120),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `staffProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `taskAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`departmentId` int NOT NULL,
	`assignedUserId` int,
	`dueAt` timestamp NOT NULL,
	`status` enum('not_started','in_progress','completed','failed','skipped','overdue','pending_approval','reopened') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`approvedAt` timestamp,
	`approvedBy` int,
	`reopenedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskAssignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskChecklistResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`checklistId` int NOT NULL,
	`status` enum('available','not_available','damaged','expired','low_stock','under_maintenance','missing','wrong_location') NOT NULL DEFAULT 'available',
	`note` text,
	`evidenceUrl` varchar(1024),
	`reportedBy` int NOT NULL,
	`createdIssueId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskChecklistResults_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignment_checklist_unique` UNIQUE(`assignmentId`,`checklistId`)
);
--> statement-breakpoint
CREATE TABLE `taskChecklists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`label` varchar(300) NOT NULL,
	`instructions` text,
	`required` boolean NOT NULL DEFAULT true,
	`position` int NOT NULL DEFAULT 0,
	`expectedLocation` varchar(180),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `taskChecklists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskCompletions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`departmentId` int NOT NULL,
	`status` enum('not_started','in_progress','completed','failed','skipped','overdue','pending_approval','reopened') NOT NULL,
	`notes` text,
	`evidenceUrl` varchar(1024),
	`approvalStatus` enum('not_required','pending','approved','rejected') NOT NULL DEFAULT 'not_required',
	`reviewerId` int,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskCompletions_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskCompletions_assignmentId_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(220) NOT NULL,
	`description` text,
	`departmentId` int NOT NULL,
	`assignedUserId` int,
	`backupUserId` int,
	`frequency` enum('one_time','daily','every_shift','weekly','monthly','quarterly','yearly','custom') NOT NULL,
	`recurrenceRule` varchar(180),
	`startDate` date,
	`dueTime` varchar(10) NOT NULL,
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`category` varchar(120) NOT NULL,
	`instructions` text,
	`evidenceRequired` boolean NOT NULL DEFAULT false,
	`photoRequired` boolean NOT NULL DEFAULT false,
	`approvalRequired` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('super_admin','hospital_admin','department_head','supervisor','staff','viewer') NOT NULL DEFAULT 'staff';--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `auditLogs` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `roster_date_idx` ON `dutyRosters` (`dutyDate`);--> statement-breakpoint
CREATE INDEX `equipment_department_idx` ON `equipment` (`departmentId`);--> statement-breakpoint
CREATE INDEX `expiry_date_idx` ON `expiryItems` (`expiryDate`);--> statement-breakpoint
CREATE INDEX `issue_department_idx` ON `issues` (`departmentId`);--> statement-breakpoint
CREATE INDEX `issue_status_idx` ON `issues` (`status`);--> statement-breakpoint
CREATE INDEX `notification_recipient_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `recurring_job_idx` ON `recurringTasks` (`schedule_cron_task_uid`);--> statement-breakpoint
CREATE INDEX `assignment_assignee_idx` ON `taskAssignments` (`assignedUserId`);--> statement-breakpoint
CREATE INDEX `assignment_due_idx` ON `taskAssignments` (`dueAt`);--> statement-breakpoint
CREATE INDEX `assignment_task_idx` ON `taskAssignments` (`taskId`);--> statement-breakpoint
CREATE INDEX `task_department_idx` ON `tasks` (`departmentId`);--> statement-breakpoint
CREATE INDEX `task_active_idx` ON `tasks` (`active`);