-- Migration: Add gen_random_uuid() default to id column
-- The id column is varchar but needs a default for DEFAULT keyword in INSERTs
ALTER TABLE "certificate_number_settings" 
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
