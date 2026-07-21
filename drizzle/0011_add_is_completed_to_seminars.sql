-- Menambahkan kolom is_completed ke tabel seminars
-- Nilai 1 = Selesai (completed), 0 = Aktif (active)
ALTER TABLE "seminars" ADD COLUMN "is_completed" boolean NOT NULL DEFAULT false;
