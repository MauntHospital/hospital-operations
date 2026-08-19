CREATE TABLE `notificationRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventType` varchar(80) NOT NULL,
	`label` varchar(180) NOT NULL,
	`inAppEnabled` boolean NOT NULL DEFAULT true,
	`emailEnabled` boolean NOT NULL DEFAULT false,
	`leadMinutes` int NOT NULL DEFAULT 15,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `notificationRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationRules_eventType_unique` UNIQUE(`eventType`)
);
