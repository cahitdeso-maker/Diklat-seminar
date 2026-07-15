-- Migration: Add face_embeddings table and remove old face columns
--
-- Notes:
-- - Database uses varchar(36) for IDs (not uuid type), so registration_id must be varchar(36)
-- - face_embedding and face_quality may already be dropped (from partial migration)
-- - face_data may still exist

-- Step 1: Create face_embeddings table (IF NOT EXISTS for idempotency)
CREATE TABLE IF NOT EXISTS "face_embeddings" (
  "id" varchar(36) PRIMARY KEY,
  "registration_id" varchar(36) NOT NULL REFERENCES "registrations"("id"),
  "descriptor" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 2: Drop old columns from registrations
ALTER TABLE "registrations" DROP COLUMN IF EXISTS "face_data";
ALTER TABLE "registrations" DROP COLUMN IF EXISTS "face_embedding";
ALTER TABLE "registrations" DROP COLUMN IF EXISTS "face_quality";

-- Step 3: Drop old columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "face_data";
ALTER TABLE "users" DROP COLUMN IF EXISTS "face_embedding";
ALTER TABLE "users" DROP COLUMN IF EXISTS "face_quality";
