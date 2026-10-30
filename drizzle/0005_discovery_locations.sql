CREATE TABLE `studio_discovery_locations` (
	`query` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `discovery_locations_expiry` ON `studio_discovery_locations` (`expires_at`);