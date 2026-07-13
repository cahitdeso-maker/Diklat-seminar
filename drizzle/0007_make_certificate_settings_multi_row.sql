-- Migration: Convert certificate_number_settings to multi-row table
-- Each row now represents either a config row (is_config = true) or a certificate number log (is_config = false)

-- Add new columns for multi-row certificate log support
ALTER TABLE "certificate_number_settings" 
  ADD COLUMN "certificate_number" integer,
  ADD COLUMN "certificate_code" varchar(255),
  ADD COLUMN "registration_id" text,
  ADD COLUMN "seminar_id" text,
  ADD COLUMN "month_roman" varchar(10),
  ADD COLUMN "is_config" boolean NOT NULL DEFAULT false;

-- Mark existing rows as config rows
UPDATE "certificate_number_settings" SET "is_config" = true;

-- Remove unused columns
ALTER TABLE "certificate_number_settings" 
  DROP COLUMN "current_number",
  DROP COLUMN "last_certificate_number";

-- Make next_certificate_number nullable (only used in config rows)
ALTER TABLE "certificate_number_settings" 
  ALTER COLUMN "next_certificate_number" DROP NOT NULL,
  ALTER COLUMN "next_certificate_number" DROP DEFAULT;

-- Backfill existing certificate numbers from registrations into the log
INSERT INTO "certificate_number_settings" (
  "id",
  "certificate_number",
  "certificate_code",
  "registration_id",
  "seminar_id",
  "month_roman",
  "is_config",
  "letter_prefix",
  "institution_code",
  "letter_type",
  "unit_code",
  "classification",
  "year",
  "format",
  "participant_name",
  "reset_option",
  "is_deleted",
  "created_at",
  "updated_at"
)
SELECT 
  gen_random_uuid(),
  r."certificate_number",
  r."certificate_code",
  r."id",
  r."seminar_id",
  UPPER(TO_CHAR(CURRENT_DATE, 'RM')),
  false,
  cns."letter_prefix",
  cns."institution_code",
  cns."letter_type",
  cns."unit_code",
  cns."classification",
  cns."year",
  cns."format",
  r."full_name",
  cns."reset_option",
  false,
  COALESCE(r."certificate_generated_at", NOW()),
  NOW()
FROM "registrations" r
CROSS JOIN "certificate_number_settings" cns
WHERE r."certificate_number" IS NOT NULL
  AND r."is_deleted" = false
  AND cns."is_config" = true
  AND cns."is_deleted" = false
  AND NOT EXISTS (
    SELECT 1 FROM "certificate_number_settings" existing
    WHERE existing."registration_id" = r."id"
      AND existing."is_config" = false
  );
