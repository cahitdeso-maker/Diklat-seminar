-- Add letter_type, unit_code, classification columns to certificate_number_settings
ALTER TABLE "certificate_number_settings" 
  ADD COLUMN "letter_type" varchar(20) NOT NULL DEFAULT 'KET',
  ADD COLUMN "unit_code" varchar(50) NOT NULL DEFAULT 'IV.6.AU',
  ADD COLUMN "classification" varchar(10) NOT NULL DEFAULT 'A';

-- Migrate existing data: split institution_code into components
-- institution_code format example: "KET/IV.6.AU/A"
-- We split by '/' and populate the new fields
UPDATE "certificate_number_settings"
SET 
  "letter_type" = COALESCE(SPLIT_PART("institution_code", '/', 1), 'KET'),
  "unit_code" = CASE 
    WHEN LENGTH("institution_code") - LENGTH(REPLACE("institution_code", '/', '')) >= 2 
    THEN SPLIT_PART("institution_code", '/', 2)
    ELSE 'IV.6.AU'
  END,
  "classification" = CASE 
    WHEN LENGTH("institution_code") - LENGTH(REPLACE("institution_code", '/', '')) >= 2 
    THEN SPLIT_PART("institution_code", '/', 3)
    ELSE 'A'
  END;