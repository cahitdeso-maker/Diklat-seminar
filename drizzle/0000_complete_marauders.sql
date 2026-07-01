CREATE TABLE `certificates` (
	`id` varchar(36) NOT NULL,
	`registration_id` varchar(36) NOT NULL,
	`seminar_id` varchar(36) NOT NULL,
	`file_url` varchar(500),
	`sent_via` varchar(20),
	`sent_at` timestamp,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registrations` (
	`id` varchar(36) NOT NULL,
	`seminar_id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`phone_number` varchar(30),
	`institution` varchar(255),
	`profession` varchar(100),
	`face_data` text,
	`qr_code` varchar(255),
	`is_present` boolean NOT NULL DEFAULT false,
	`present_time` datetime,
	`present_method` varchar(20),
	`certificate_sent` boolean NOT NULL DEFAULT false,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `seminars` (
	`id` varchar(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`date` date NOT NULL,
	`start_time` varchar(10),
	`end_time` varchar(10),
	`location` varchar(255),
	`max_participants` int DEFAULT 0,
	`use_qr` boolean NOT NULL DEFAULT true,
	`use_face` boolean NOT NULL DEFAULT true,
	`is_active` boolean NOT NULL DEFAULT true,
	`is_completed` boolean NOT NULL DEFAULT false,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `seminars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` varchar(36) NOT NULL,
	`setting_key` varchar(100) NOT NULL,
	`setting_value` text NOT NULL,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `settings_setting_key_unique` UNIQUE(`setting_key`)
);
--> statement-breakpoint
CREATE TABLE `speakers` (
	`id` varchar(36) NOT NULL,
	`seminar_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`topic` text,
	`display_order` int NOT NULL DEFAULT 1,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `speakers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`role` varchar(20) NOT NULL DEFAULT 'admin',
	`full_name` varchar(255) NOT NULL,
	`email` varchar(255),
	`password` varchar(255),
	`phone_number` varchar(30),
	`is_active` boolean NOT NULL DEFAULT true,
	`is_deleted` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_registration_id_registrations_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `certificates` ADD CONSTRAINT `certificates_seminar_id_seminars_id_fk` FOREIGN KEY (`seminar_id`) REFERENCES `seminars`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registrations` ADD CONSTRAINT `registrations_seminar_id_seminars_id_fk` FOREIGN KEY (`seminar_id`) REFERENCES `seminars`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `speakers` ADD CONSTRAINT `speakers_seminar_id_seminars_id_fk` FOREIGN KEY (`seminar_id`) REFERENCES `seminars`(`id`) ON DELETE no action ON UPDATE no action;