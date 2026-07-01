-- Migration: Convert all is_deleted columns from tinyint to boolean
-- Also convert existing 0/1 values to false/true (for MySQL BOOLEAN this is the same, 
-- but we ensure consistency)

-- attendances
ALTER TABLE `attendances` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- certificate_templates
ALTER TABLE `certificate_templates` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- certificates
ALTER TABLE `certificates` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- registrations
ALTER TABLE `registrations` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- schedules
ALTER TABLE `schedules` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- seminars
ALTER TABLE `seminars` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- settings
ALTER TABLE `settings` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- speakers
ALTER TABLE `speakers` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- units
ALTER TABLE `units` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- users
ALTER TABLE `users` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;