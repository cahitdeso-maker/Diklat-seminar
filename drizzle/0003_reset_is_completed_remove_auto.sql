-- ====================================
-- Migration 0003: Reset is_completed dan hapus auto-complete logic
-- ====================================
-- Sebelum migration 0002, kolom is_completed tidak ada di database,
-- jadi fungsi auto-complete (updateCompletedStatus) di API gagal diam-diam.
-- Setelah kolom ditambahkan, fungsi tersebut langsung menandai SEMUA
-- seminar yang sudah lewat sebagai selesai, sehingga hilang dari tampilan.
-- Migration ini mengembalikan status dan menghapus kode auto-complete.

-- Reset semua is_completed ke false agar tidak ada yang hilang
UPDATE `seminars` SET `is_completed` = false WHERE `is_completed` = true;