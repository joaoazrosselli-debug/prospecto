CREATE TABLE `studio_code_drafts` (
	`lead_id` text PRIMARY KEY NOT NULL,
	`files` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `studio_page_versions` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`lead_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`files` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `studio_page_versions_id_unique` ON `studio_page_versions` (`id`);--> statement-breakpoint
CREATE INDEX `page_versions_lead_seq` ON `studio_page_versions` (`lead_id`,`seq`);