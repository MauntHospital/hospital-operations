CREATE TABLE `departmentStaffingTargets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`shift` varchar(80) NOT NULL,
	`requiredStaff` int NOT NULL,
	`warningCoveragePercent` int NOT NULL DEFAULT 90,
	`criticalCoveragePercent` int NOT NULL DEFAULT 75,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `departmentStaffingTargets_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffing_target_department_shift_unique` UNIQUE(`departmentId`,`shift`)
);
--> statement-breakpoint
CREATE TABLE `managementActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`reason` text,
	`departmentId` int NOT NULL,
	`ownerUserId` int,
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`dueAt` timestamp,
	`status` enum('open','in_progress','completed','overdue','cancelled') NOT NULL DEFAULT 'open',
	`relatedIssueId` int,
	`relatedRiskId` int,
	`relatedTaskId` int,
	`meetingReference` varchar(180),
	`completionNotes` text,
	`verification` text,
	`verifiedByUserId` int,
	`verifiedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managementActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `operationalIndicatorRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(80) NOT NULL,
	`label` varchar(180) NOT NULL,
	`warningThreshold` int NOT NULL,
	`criticalThreshold` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operationalIndicatorRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `operationalIndicatorRules_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `risks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(32) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(120) NOT NULL,
	`departmentId` int NOT NULL,
	`likelihood` int NOT NULL,
	`impact` int NOT NULL,
	`severity` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`ownerUserId` int,
	`mitigationPlan` text,
	`reviewDate` timestamp,
	`residualRisk` int,
	`status` enum('open','mitigating','accepted','resolved','closed') NOT NULL DEFAULT 'open',
	`relatedIssueId` int,
	`relatedTaskId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risks_id` PRIMARY KEY(`id`),
	CONSTRAINT `risks_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `taskLifecycleEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`dispatchId` int,
	`eventType` varchar(80) NOT NULL,
	`note` text,
	`metadata` json,
	`recordedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskLifecycleEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskScoringRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`priority` enum('critical','high','medium','low') NOT NULL,
	`weightTenths` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updatedByUserId` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskScoringRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskScoringRules_priority_unique` UNIQUE(`priority`)
);
--> statement-breakpoint
CREATE TABLE `whatsappMessageTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`templateType` varchar(40) NOT NULL DEFAULT 'task',
	`departmentId` int,
	`category` varchar(120),
	`priority` enum('critical','high','medium','low'),
	`body` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappMessageTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` MODIFY COLUMN `status` enum('prepared','copied','sent','acknowledged','completed','pending','no_reply','excused','reviewed','closed') NOT NULL DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE `equipment` ADD `category` varchar(120);--> statement-breakpoint
ALTER TABLE `equipment` ADD `criticality` enum('critical','high','medium','low') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory` ADD `genericName` varchar(220);--> statement-breakpoint
ALTER TABLE `inventory` ADD `brand` varchar(220);--> statement-breakpoint
ALTER TABLE `inventory` ADD `minimumStock` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `inventory` ADD `maximumStock` int;--> statement-breakpoint
ALTER TABLE `inventory` ADD `supplier` varchar(180);--> statement-breakpoint
ALTER TABLE `inventory` ADD `unitPrice` int;--> statement-breakpoint
ALTER TABLE `issues` ADD `severity` varchar(40);--> statement-breakpoint
ALTER TABLE `issues` ADD `rootCause` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `immediateAction` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `correctiveAction` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `preventiveAction` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `verification` text;--> statement-breakpoint
ALTER TABLE `issues` ADD `verifiedBy` int;--> statement-breakpoint
ALTER TABLE `issues` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `endDate` date;--> statement-breakpoint
ALTER TABLE `tasks` ADD `pointWeightTenths` int DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `managerNotes` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `expectedCompletionMinutes` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `escalationRuleId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `operatingDays` json;--> statement-breakpoint
ALTER TABLE `tasks` ADD `holidayPolicy` varchar(40) DEFAULT 'run' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `dependencyTaskIds` json;--> statement-breakpoint
ALTER TABLE `tasks` ADD `lastModifiedBy` int;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `preparedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `copiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `acknowledgedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `reviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `closedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `excusedReason` varchar(120);--> statement-breakpoint
CREATE INDEX `management_action_department_idx` ON `managementActions` (`departmentId`);--> statement-breakpoint
CREATE INDEX `management_action_status_idx` ON `managementActions` (`status`);--> statement-breakpoint
CREATE INDEX `management_action_due_idx` ON `managementActions` (`dueAt`);--> statement-breakpoint
CREATE INDEX `risk_department_idx` ON `risks` (`departmentId`);--> statement-breakpoint
CREATE INDEX `risk_status_idx` ON `risks` (`status`);--> statement-breakpoint
CREATE INDEX `task_lifecycle_assignment_idx` ON `taskLifecycleEvents` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `task_lifecycle_dispatch_idx` ON `taskLifecycleEvents` (`dispatchId`);--> statement-breakpoint
CREATE INDEX `whatsapp_template_department_idx` ON `whatsappMessageTemplates` (`departmentId`);