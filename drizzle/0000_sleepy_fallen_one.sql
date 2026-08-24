CREATE TABLE `audit_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`control` text NOT NULL,
	`chain_hash` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `transfer_cases`(`case_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_events_case_id_idx` ON `audit_events` (`case_id`);--> statement-breakpoint
CREATE TABLE `transfer_cases` (
	`case_id` text PRIMARY KEY NOT NULL,
	`source_course` text NOT NULL,
	`target_course` text NOT NULL,
	`confidence` integer NOT NULL,
	`recommendation` text NOT NULL,
	`status` text NOT NULL,
	`exception` text,
	`document_hash` text NOT NULL,
	`advisor_note` text,
	`receipt_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transfer_cases_status_idx` ON `transfer_cases` (`status`);--> statement-breakpoint
CREATE INDEX `transfer_cases_updated_at_idx` ON `transfer_cases` (`updated_at`);