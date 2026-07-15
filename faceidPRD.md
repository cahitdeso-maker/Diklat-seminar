# PRD: Migrasi Fitur Presensi Face ID ke face-api.js

## 1. Latar Belakang

Aplikasi presensi saat ini memiliki dua metode: **QR Code** (sudah stabil, dipertahankan) dan **Face ID** (bermasalah). Implementasi Face ID lama menggunakan **MediaPipe Tasks Vision** (`FilesetResolver.forVisionTasks`) untuk proses *matching/verifikasi* wajah. Ini adalah kesalahan arsitektur: MediaPipe Tasks Vision hanya menyediakan **deteksi wajah dan landmark** (koordinat titik wajah), **bukan face embedding/descriptor** yang valid untuk perbandingan identitas. Akibatnya proses matching gagal/tidak akurat.

## 2. Tujuan

- Mengganti seluruh mekanisme *face matching/verification* dengan **face-api.js**, yang menyediakan face descriptor 128-dimensi (FaceNet-based) untuk perbandingan identitas yang valid.
- Menghapus total implementasi Face ID lama berbasis MediaPipe agar tidak ada kode/dependensi yang saling konflik.
- Mempertahankan metode presensi QR Code tanpa perubahan.

## 3. Scope

### In Scope
- Implementasi ulang modul Face ID: enrollment (pendaftaran wajah) dan verifikasi (presensi) menggunakan face-api.js.
- Penghapusan seluruh kode, dependency, model, dan tabel/kolom terkait implementasi Face ID lama (MediaPipe-based matching).
- Penyesuaian skema database untuk menyimpan face descriptor baru.

### Out of Scope
- Perubahan pada metode presensi QR Code.
- Sistem anti-spoofing tingkat lanjut (liveness detection kompleks) — dibahas terpisah jika diperlukan pada iterasi berikutnya.

## 4. Instruksi Penghapusan Metode Face ID Lama (WAJIB dilakukan sebelum implementasi baru)

AI Agent **harus melakukan langkah-langkah berikut sebelum menulis kode baru**:

1. **Cari dan hapus seluruh referensi MediaPipe Tasks Vision** yang digunakan untuk proses matching/verifikasi wajah:
   - Hapus import `FilesetResolver`, `FaceLandmarker`, atau modul MediaPipe lain yang dipakai khusus untuk face matching.
   - Jika MediaPipe masih dipakai untuk fitur lain di luar face matching (misal deteksi umum), **jangan dihapus** — hanya hapus bagian yang terkait proses verifikasi identitas wajah.
2. **Hapus fungsi/komponen lama**: enrollment wajah lama, fungsi matching lama, endpoint API lama yang menangani verifikasi Face ID versi MediaPipe.
3. **Hapus dependency lama** dari `package.json` jika MediaPipe/CDN tersebut hanya dipakai untuk Face ID (cek dulu apakah dipakai di tempat lain sebelum uninstall).
4. **Hapus/migrasikan data lama**: jika ada kolom/tabel database yang menyimpan data landmark MediaPipe (bukan descriptor), buat migration untuk menghapus kolom tersebut dan menggantinya dengan kolom baru sesuai skema di bagian 6.
5. **Hapus state/logic UI lama** di komponen React yang memanggil proses matching MediaPimg lama (capture, verify handler, dsb).
6. Pastikan tidak ada kode mati (*dead code*) atau import yang tidak terpakai tersisa setelah penghapusan.

> **Catatan untuk AI Agent:** Jangan menimpa (overwrite) langsung tanpa konfirmasi jika ditemukan bagian kode yang ambigu antara "MediaPipe untuk deteksi" vs "MediaPipe untuk matching". Tandai dan tanyakan ke user jika ragu.

## 5. Functional Requirements

| ID | Requirement |
|---|---|
| FR-1 | Sistem dapat mendaftarkan (*enroll*) wajah user baru dan menyimpan face descriptor ke database. |
| FR-2 | Sistem dapat memverifikasi wajah user saat presensi dengan membandingkan descriptor real-time terhadap descriptor tersimpan. |
| FR-3 | Sistem menolak presensi jika tidak ada wajah terdeteksi atau similarity di bawah threshold. |
| FR-4 | Sistem mencatat presensi dengan metode `face_id` beserta skor similarity/distance. |
| FR-5 | User dapat melakukan re-enrollment jika wajah gagal dikenali berulang kali (opsional, dengan approval admin). |

## 6. Technical Requirements

### 6.1 Library
- **face-api.js** (`npm install face-api.js`), gunakan model:
  - `tinyFaceDetector` — deteksi wajah (ringan, real-time)
  - `faceLandmark68Net` — landmark wajah
  - `faceRecognitionNet` — face descriptor (128-d)
- Model file disimpan lokal di `public/models` (bukan via CDN eksternal) agar konsisten dan tidak bergantung koneksi pihak ketiga.

### 6.2 Alur Enrollment
1. User membuka kamera → face-api.js mendeteksi wajah.
2. Ambil `descriptor` (Float32Array 128-d).
3. Kirim descriptor ke backend (Laravel API) → simpan sebagai JSON di tabel `face_embeddings`.

### 6.3 Alur Verifikasi (Presensi)
1. Capture frame wajah user via kamera.
2. face-api.js hasilkan descriptor real-time.
3. Bandingkan dengan descriptor tersimpan menggunakan **Euclidean Distance**.
4. Jika `distance < threshold (default 0.5)` → match, simpan presensi.
5. Jika tidak match → tampilkan pesan gagal, user dapat retry.

### 6.4 Skema Database (baru)

```sql
CREATE TABLE face_embeddings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    descriptor JSON NOT NULL, -- array 128 float
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

> Hapus tabel/kolom lama yang menyimpan landmark MediaPipe (jika ada), sesuai instruksi di bagian 4.

### 6.5 API Endpoint (Laravel)

| Method | Endpoint | Deskripsi |
|---|---|---|
| POST | `/api/face/enroll` | Simpan descriptor wajah baru user |
| POST | `/api/presensi/face-verify` | Verifikasi wajah untuk presensi |

## 7. Non-Functional Requirements

- Proses deteksi & matching di client harus berjalan real-time (< 1 detik per frame) pada perangkat rata-rata.
- Tidak menambah dependency server tambahan (face-api.js berjalan full client-side).
- Kompatibel dengan browser modern (Chrome, Edge, Firefox versi terbaru).

## 8. Acceptance Criteria

- [ ] Semua kode/dependency Face ID lama (MediaPipe-based matching) sudah terhapus bersih, tidak ada dead code.
- [ ] User dapat melakukan enrollment wajah dan tersimpan sebagai descriptor 128-d di database.
- [ ] User dapat presensi via Face ID dengan tingkat keberhasilan matching konsisten (distance < 0.5) untuk wajah yang sama.
- [ ] Presensi via QR Code tetap berfungsi normal tanpa regresi.
- [ ] Tidak ada error console/log terkait modul MediaPipe lama.

## 9. Rollout Plan

1. Hapus implementasi lama (lihat bagian 4).
2. Implementasi enrollment & verifikasi baru dengan face-api.js.
3. Migration database (drop kolom lama, tambah tabel `face_embeddings`).
4. Testing internal (minimal 10 user, kondisi pencahayaan berbeda).
5. Deploy ke staging → UAT → production.
