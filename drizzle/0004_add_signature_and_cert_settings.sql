-- Migration: Add signature_settings and certificate_number_settings tables

CREATE TABLE IF NOT EXISTS `signature_settings` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `position` varchar(255) NOT NULL,
  `nip` varchar(30),
  `signature_image` varchar(500),
  `is_active` boolean NOT NULL DEFAULT false,
  `is_deleted` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `certificate_number_settings` (
  `id` varchar(36) NOT NULL,
  `letter_prefix` varchar(50) NOT NULL DEFAULT '421.5',
  `institution_code` varchar(100) NOT NULL DEFAULT 'RSUD',
  `current_number` int NOT NULL DEFAULT 1,
  `year` varchar(4) NOT NULL,
  `format` varchar(100) NOT NULL DEFAULT '{prefix}/{nomor}/{kode}/{bulan}/{tahun}',
  `is_deleted` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default certificate number settings
INSERT INTO `certificate_number_settings` (`id`, `year`, `current_number`)
VALUES (UUID(), '2026', 1);