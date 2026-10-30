CREATE TABLE `studio_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`lead_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`role` text DEFAULT 'gallery' NOT NULL,
	`alt` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_assets_object_key_unique` ON `studio_assets` (`object_key`);--> statement-breakpoint
CREATE INDEX `assets_lead` ON `studio_assets` (`lead_id`);--> statement-breakpoint
CREATE TABLE `studio_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_records` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_kind` ON `studio_records` (`kind`);