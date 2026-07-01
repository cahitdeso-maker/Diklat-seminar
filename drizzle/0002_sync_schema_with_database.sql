-- ====================================
-- Migration 0002: Menambahkan kolom is_completed ke tabel seminars
-- ====================================
-- Penyebab: Kolom is_completed ada di schema.ts (`src/lib/schema.ts` baris 43)
-- tapi belum pernah ditambahkan ke database.
-- Error: ER_BAD_FIELD_ERROR: Unknown column 'is_completed' in 'field list'

ALTER TABLE `seminars` ADD COLUMN `is_completed` boolean NOT NULL DEFAULT false AFTER `is_active`;

-- ====================================
-- Konversi semua kolom is_deleted dari tinyint ke boolean
-- ====================================
ALTER TABLE `attendances` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `certificate_templates` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `certificates` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `registrations` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `schedules` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `seminars` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `settings` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `speakers` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `units` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;
ALTER TABLE `users` MODIFY COLUMN `is_deleted` boolean NOT NULL DEFAULT false;

-- ====================================
-- Konversi kolom boolean lain agar konsisten dengan schema.ts
-- ====================================
ALTER TABLE `seminars` MODIFY COLUMN `use_qr` boolean NOT NULL DEFAULT true;
ALTER TABLE `seminars` MODIFY COLUMN `use_face` boolean NOT NULL DEFAULT true;
ALTER TABLE `seminars` MODIFY COLUMN `is_active` boolean NOT NULL DEFAULT true;
ALTER TABLE `registrations` MODIFY COLUMN `is_present` boolean NOT NULL DEFAULT false;
ALTER TABLE `registrations` MODIFY COLUMN `certificate_sent` boolean NOT NULL DEFAULT false;
ALTER TABLE `users` MODIFY COLUMN `is_active` boolean NOT NULL DEFAULT true;