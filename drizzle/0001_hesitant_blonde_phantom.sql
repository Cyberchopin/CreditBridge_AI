CREATE TABLE `agentcore_runs` (
	`run_id` text PRIMARY KEY NOT NULL,
	`cache_key` text NOT NULL,
	`case_id` text NOT NULL,
	`source_hash` text NOT NULL,
	`execution_mode` text NOT NULL,
	`runtime_name` text NOT NULL,
	`region` text NOT NULL,
	`trace_id` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`response_hash` text,
	`invoked_at` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agentcore_runs_cache_key_idx` ON `agentcore_runs` (`cache_key`);--> statement-breakpoint
CREATE INDEX `agentcore_runs_invoked_at_idx` ON `agentcore_runs` (`invoked_at`);--> statement-breakpoint
CREATE INDEX `agentcore_runs_expires_at_idx` ON `agentcore_runs` (`expires_at`);