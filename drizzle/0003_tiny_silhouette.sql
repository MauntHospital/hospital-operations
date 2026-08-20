CREATE TABLE `staffCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`mustChangePassword` boolean NOT NULL DEFAULT true,
	`passwordChangedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `staffCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `staffCredentials_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `staffCredentials_username_unique` UNIQUE(`username`)
);
