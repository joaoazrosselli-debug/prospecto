CREATE TABLE `studio_delivery_reviews` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`lead_id` text NOT NULL,
	`scope` text NOT NULL,
	`fingerprint` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_delivery_reviews_id_unique` ON `studio_delivery_reviews` (`id`);--> statement-breakpoint
CREATE INDEX `delivery_reviews_lead_scope_seq` ON `studio_delivery_reviews` (`lead_id`,`scope`,`seq`);