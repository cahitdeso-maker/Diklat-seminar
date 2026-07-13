-- Migration: Add last_certificate_number column
ALTER TABLE "certificate_number_settings" 
ADD COLUMN "last_certificate_number" integer NOT NULL DEFAULT 0;

-- Backfill: Set last_certificate_number ke MAX certificate_number dari registrations
UPDATE "certificate_number_settings" cns
SET "last_certificate_number" = COALESCE(
  (SELECT MAX(r."certificate_number") 
   FROM "registrations" r 
   WHERE r."certificate_number" IS NOT NULL 
     AND r."is_deleted" = false),
  0
);
