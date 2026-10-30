CREATE TABLE `studio_discovery_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`query` text NOT NULL,
	`results` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discovery_query_created` ON `studio_discovery_batches` (`query`,`created_at`);--> statement-breakpoint
CREATE INDEX `discovery_expiry` ON `studio_discovery_batches` (`expires_at`);--> statement-breakpoint
CREATE TABLE `studio_discovery_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` text NOT NULL
);
