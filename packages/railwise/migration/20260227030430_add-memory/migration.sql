CREATE TABLE `memory` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`session_id` text,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`source` text,
	`confidence` real DEFAULT 1 NOT NULL,
	`access_count` integer DEFAULT 0 NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	`time_accessed` integer,
	`time_expired` integer,
	CONSTRAINT `fk_memory_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_memory_session_id_session_id_fk` FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX `memory_project_idx` ON `memory` (`project_id`);--> statement-breakpoint
CREATE INDEX `memory_category_idx` ON `memory` (`category`);--> statement-breakpoint
CREATE INDEX `memory_confidence_idx` ON `memory` (`confidence`);