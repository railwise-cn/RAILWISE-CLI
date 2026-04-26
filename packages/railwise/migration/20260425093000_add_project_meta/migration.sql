CREATE TABLE `project_meta` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`type` text DEFAULT 'excavation' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`progress` real DEFAULT 0 NOT NULL,
	`last_activity` integer NOT NULL,
	`active_task_count` integer DEFAULT 0 NOT NULL,
	`description` text,
	`point_count` integer DEFAULT 0 NOT NULL,
	`alert_count` integer DEFAULT 0 NOT NULL,
	`bbox_json` text,
	`time_created` integer NOT NULL,
	`owner` text
);
