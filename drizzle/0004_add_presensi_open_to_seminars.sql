-- Add presensiOpen column to seminars table
ALTER TABLE "seminars" ADD COLUMN "presensi_open" boolean NOT NULL DEFAULT false;