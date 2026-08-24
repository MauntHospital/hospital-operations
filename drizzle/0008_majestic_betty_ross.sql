CREATE TABLE `departmentMonthlyScoreSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`monthKey` varchar(7) NOT NULL,
	`scoreTenths` int NOT NULL,
	`assignedCount` int NOT NULL DEFAULT 0,
	`completedCount` int NOT NULL DEFAULT 0,
	`lateCount` int NOT NULL DEFAULT 0,
	`overdueCount` int NOT NULL DEFAULT 0,
	`escalatedCount` int NOT NULL DEFAULT 0,
	`validExceptionCount` int NOT NULL DEFAULT 0,
	`compliancePercent` int NOT NULL DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `departmentMonthlyScoreSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `department_month_score_unique` UNIQUE(`departmentId`,`monthKey`)
);
--> statement-breakpoint
CREATE TABLE `taskAccountabilityDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`dispatchId` int,
	`departmentId` int NOT NULL,
	`accountableParty` enum('manager','department','shared','none') NOT NULL,
	`outcome` varchar(80) NOT NULL,
	`pointDeltaTenths` int NOT NULL DEFAULT 0,
	`reason` text NOT NULL,
	`decidedByUserId` int NOT NULL,
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskAccountabilityDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappTaskEscalations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispatchId` int,
	`assignmentId` int NOT NULL,
	`escalatedByUserId` int,
	`escalationLevel` varchar(80) NOT NULL,
	`reason` text NOT NULL,
	`escalatedTo` varchar(220),
	`resolution` text,
	`resolvedByUserId` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappTaskEscalations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappTaskEvidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispatchId` int NOT NULL,
	`responseId` int,
	`storageKey` varchar(600) NOT NULL,
	`url` varchar(1024) NOT NULL,
	`fileName` varchar(300) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`uploadedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappTaskEvidence_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappTaskReschedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`originalAssignmentId` int NOT NULL,
	`successorAssignmentId` int,
	`previousDueAt` timestamp NOT NULL,
	`rescheduledDueAt` timestamp NOT NULL,
	`reason` text NOT NULL,
	`rescheduledByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsappTaskReschedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsappTaskResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dispatchId` int NOT NULL,
	`assignmentId` int NOT NULL,
	`responseStatus` enum('completed','partially_completed','not_completed','unable_to_complete','valid_exception') NOT NULL,
	`findings` text,
	`actionTaken` text,
	`responsibleStaff` varchar(220),
	`completedAt` timestamp,
	`nonCompletionReason` varchar(160),
	`additionalNotes` text,
	`structuredFields` json,
	`version` int NOT NULL DEFAULT 1,
	`isCurrent` boolean NOT NULL DEFAULT true,
	`submittedByUserId` int NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`reviewDecision` varchar(40),
	`reviewNote` text,
	CONSTRAINT `whatsappTaskResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` MODIFY COLUMN `status` enum('prepared','copied','sent','awaiting_reply','acknowledged','replied','under_review','rework_required','replied_again','verified','completed','pending','no_reply','excused','valid_exception','overdue','escalated','cancelled','rescheduled','manager_completed','reviewed','closed') NOT NULL DEFAULT 'sent';--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` MODIFY COLUMN `sentAt` timestamp;--> statement-breakpoint
ALTER TABLE `taskLifecycleEvents` ADD `previousStatus` varchar(80);--> statement-breakpoint
ALTER TABLE `taskLifecycleEvents` ADD `newStatus` varchar(80);--> statement-breakpoint
ALTER TABLE `taskLifecycleEvents` ADD `actorRole` varchar(40);--> statement-breakpoint
ALTER TABLE `taskScoringRules` ADD `lateWeightTenths` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `taskScoringRules` ADD `escalatedWeightTenths` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `gracePeriodMinutes` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `escalationDelayMinutes` int DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `timezone` varchar(64) DEFAULT 'Asia/Kathmandu' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `responseSchema` json;--> statement-breakpoint
ALTER TABLE `tasks` ADD `responsibleRole` varchar(120);--> statement-breakpoint
ALTER TABLE `tasks` ADD `verificationRequired` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `openedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `verifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `escalatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `rescheduledAt` timestamp;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `currentResponseId` int;--> statement-breakpoint
ALTER TABLE `whatsappTaskDispatches` ADD `statusChangedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
CREATE INDEX `task_accountability_assignment_idx` ON `taskAccountabilityDecisions` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `task_accountability_dispatch_idx` ON `taskAccountabilityDecisions` (`dispatchId`);--> statement-breakpoint
CREATE INDEX `task_accountability_department_idx` ON `taskAccountabilityDecisions` (`departmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_escalation_assignment_idx` ON `whatsappTaskEscalations` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_escalation_dispatch_idx` ON `whatsappTaskEscalations` (`dispatchId`);--> statement-breakpoint
CREATE INDEX `whatsapp_evidence_dispatch_idx` ON `whatsappTaskEvidence` (`dispatchId`);--> statement-breakpoint
CREATE INDEX `whatsapp_evidence_response_idx` ON `whatsappTaskEvidence` (`responseId`);--> statement-breakpoint
CREATE INDEX `whatsapp_reschedule_original_idx` ON `whatsappTaskReschedules` (`originalAssignmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_reschedule_successor_idx` ON `whatsappTaskReschedules` (`successorAssignmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_response_dispatch_idx` ON `whatsappTaskResponses` (`dispatchId`);--> statement-breakpoint
CREATE INDEX `whatsapp_response_assignment_idx` ON `whatsappTaskResponses` (`assignmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_response_current_idx` ON `whatsappTaskResponses` (`dispatchId`,`isCurrent`);