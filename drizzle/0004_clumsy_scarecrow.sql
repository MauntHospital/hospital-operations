CREATE TABLE `departmentPointEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`departmentId` int NOT NULL,
	`dispatchId` int NOT NULL,
	`pointDelta` int NOT NULL,
	`reason` varchar(240) NOT NULL,
	`recordedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departmentPointEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `departmentPointEvents_dispatchId_unique` UNIQUE(`dispatchId`)
);
--> statement-breakpoint
CREATE TABLE `whatsappTaskDispatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`taskId` int NOT NULL,
	`departmentId` int NOT NULL,
	`sentByUserId` int NOT NULL,
	`channel` varchar(32) NOT NULL DEFAULT 'whatsapp',
	`messageText` text NOT NULL,
	`status` enum('sent','completed','pending','no_reply') NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`respondedAt` timestamp,
	`responseNote` text,
	`penaltyApplied` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsappTaskDispatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsappTaskDispatches_assignmentId_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE INDEX `department_point_event_department_idx` ON `departmentPointEvents` (`departmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_dispatch_department_idx` ON `whatsappTaskDispatches` (`departmentId`);--> statement-breakpoint
CREATE INDEX `whatsapp_dispatch_status_idx` ON `whatsappTaskDispatches` (`status`);