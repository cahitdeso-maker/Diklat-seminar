-- ============================================================
-- MIGRASI DATA SERTIFIKAT YANG SUDAH ADA KE TABEL certificates
-- ============================================================
-- Jalankan query ini di Supabase SQL Editor
-- (https://supabase.com/dashboard/project/bdzqkxscwgdbnneuhjjh/sql/new)
-- ============================================================

-- 1. CEK DULU STRUKTUR KOLOM TABEL certificates
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'certificates' 
ORDER BY ordinal_position;

-- 2. CEK JUMLAH DATA YANG AKAN DIMIGRASI
SELECT COUNT(*) as perlu_dimigrasi
FROM registrations r
WHERE r.certificate_code IS NOT NULL
  AND r.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = r.id
  );

-- 3. JALANKAN MIGRASI (sesuaikan nama kolom jika berbeda dari hasil cek di atas)
--    Jika kolomnya registration_id:
INSERT INTO certificates (id, registration_id, seminar_id, certificate_number, file_url, sent_via, sent_at, is_deleted)
SELECT 
  gen_random_uuid()::text,
  r.id,
  r.seminar_id,
  r.certificate_code,
  NULL,
  CASE WHEN r.certificate_sent = true THEN 'whatsapp' ELSE NULL END,
  CASE WHEN r.certificate_sent = true THEN COALESCE(r.certificate_generated_at, NOW()) ELSE NULL END,
  false
FROM registrations r
WHERE r.certificate_code IS NOT NULL
  AND r.is_deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM certificates c WHERE c.registration_id = r.id
  );

-- 4. VERIFIKASI HASIL
SELECT COUNT(*) as total_setelah_migrasi 
FROM certificates 
WHERE is_deleted = false;
