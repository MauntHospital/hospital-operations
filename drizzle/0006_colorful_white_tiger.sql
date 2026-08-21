ALTER TABLE `notifications` ADD `handlingStatus` enum('open','acknowledged','resolved') DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE `notifications` ADD `ownerUserId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `acknowledgedByUserId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `acknowledgedAt` timestamp;--> statement-breakpoint
ALTER TABLE `notifications` ADD `resolvedByUserId` int;--> statement-breakpoint
ALTER TABLE `notifications` ADD `resolvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `notifications` ADD `handlingNote` text;--> statement-breakpoint
ALTER TABLE `dutyRosters` ADD CONSTRAINT `roster_slot_unique` UNIQUE(`departmentId`,`userId`,`dutyDate`,`shift`,`startTime`);--> statement-breakpoint
CREATE INDEX `notification_handling_idx` ON `notifications` (`handlingStatus`);--> statement-breakpoint
CREATE INDEX `notification_owner_idx` ON `notifications` (`ownerUserId`);