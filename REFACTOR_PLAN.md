# Rencana Refactor Aplikasi Seminar - 3 Portal

## Overview
Memisahkan aplikasi menjadi 3 portal terpisah dengan middleware untuk role-based access control, tanpa mengubah fitur yang sudah berjalan.

---

## Struktur Portal Baru

```
/admin          → Admin Dashboard (pusat manajemen)
/register       → Portal Peserta (registrasi, status, QR Code)
/attendance     → Portal Petugas Presensi (3 metode presensi)
```

---

## Phase 1: Persiapan & Database (Tidak mengubah struktur existing)

### 1.1 Tambah Role di Tabel Users
- [ ] Tambah enum role: `admin`, `attendance_officer`, `participant`
- [ ] Default tetap `admin` untuk backward compatibility

### 1.2 Middleware Auth & Role Check
- [ ] Buat `middleware.ts` di root
- [ ] Proteksi route berdasarkan role:
  - `/admin/*` → hanya role `admin`
  - `/attendance/*` → hanya role `attendance_officer` atau `admin`
  - `/register/*` → hanya role `participant` (atau public untuk registrasi)

---

## Phase 2: Portal Admin (Existing - Minimal Changes)

### 2.1 Update Menu Sidebar (admin/layout.tsx)
- [ ] Ubah "Presensi QR" → "Presensi" 
- [ ] Link ke `/admin/attendance` (halaman monitoring baru)
- [ ] Hapus link ke `/presensi` (QR scan dipindah ke attendance)

### 2.2 Buat Halaman Baru di Admin
- [ ] `/admin/attendance` - Monitoring & Riwayat Presensi
- [ ] `/admin/attendance/settings` - Pengaturan Presensi (QR, Face, Kode)

### 2.3 Fitur yang Tetap Ada (Jangan Dihapus)
- Dashboard, Seminar, Peserta, Sertifikat, Materi
- Penanda Tangan, Nomor Surat, Management User

---

## Phase 3: Portal Register (/register)

### 3.1 Layout Baru: `src/app/register/layout.tsx`
- [ ] Public layout (tanpa sidebar admin)
- [ ] Header sederhana dengan logo + nav minimal

### 3.2 Halaman:
- [ ] `/register` - Daftar seminar aktif (public)
- [ ] `/register/[seminarId]` - Form registrasi peserta
- [ ] `/register/status` - Cek status registrasi (butuh login/email)
- [ ] `/register/qr/[registrationId]` - Tampilkan QR Code peserta

### 3.3 API yang Digunakan (Existing)
- `GET /api/seminars?active=true` - Daftar seminar
- `POST /api/registrations` - Registrasi baru
- `GET /api/registrations?email=xxx` - Cek status
- `GET /api/registrations/[id]` - Detail + QR Code

---

## Phase 4: Portal Attendance (/attendance)

### 4.1 Layout Baru: `src/app/attendance/layout.tsx`
- [ ] Layout petugas presensi
- [ ] Sidebar/nav untuk 3 metode presensi

### 4.2 Halaman Utama: `/attendance`
- [ ] Dashboard pilih seminar aktif
- [ ] 3 Tab/Metode Presensi:
  1. **Face Recognition** - Kamera + face detection
  2. **Scan QR Code** - Kamera scan QR (dipindah dari /presensi)
  3. **Input Kode Presensi** - Manual input kode

### 4.3 Halaman Detail:
- [ ] `/attendance/[seminarId]` - Presensi untuk seminar tertentu
- [ ] `/attendance/[seminarId]/face` - Face recognition
- [ ] `/attendance/[seminarId]/qr` - QR Scanner
- [ ] `/attendance/[seminarId]/code` - Input kode manual
- [ ] `/attendance/history` - Riwayat presensi petugas

### 4.4 API yang Digunakan (Existing + Baru)
- `GET /api/seminars?active=true` - Pilih seminar
- `GET /api/registrations?seminarId=xxx` - Daftar peserta
- `PATCH /api/registrations?id=xxx` - Update presensi (isPresent, presentMethod)
- `POST /api/attendance/face` - Verify face (baru)
- `POST /api/attendance/qr` - Verify QR (baru, wrapper existing)
- `POST /api/attendance/code` - Verify kode manual (baru)

---

## Phase 5: API Updates

### 5.1 API Baru di `/api/attendance/`
- [ ] `face/route.ts` - Face recognition verification
- [ ] `qr/route.ts` - QR code verification
- [ ] `code/route.ts` - Kode presensi manual verification
- [ ] `history/route.ts` - Riwayat presensi

### 5.2 Update API Existing
- [ ] `api/seminars` - Tambah filter untuk attendance officer
- [ ] `api/registrations` - Tambah field `presentMethod` enum: `qr`, `face`, `code`, `manual`

---

## Phase 6: Middleware & Auth

### 6.1 Middleware (`middleware.ts`)
- [ ] Proteksi route berdasarkan cookie session
- [ ] Role: admin, attendance_officer, participant

### 6.2 Login Pages
- [ ] `/admin/login` - Existing (admin)
- [ ] `/attendance/login` - Baru (petugas presensi)
- [ ] `/register/login` - Baru (peserta, optional)

### 6.3 Session Cookie
- [ ] Tambah `role` di session data
- [ ] Validasi role di middleware

---

## Phase 7: Migration Steps (Bertahap)

### Step 1: Setup Middleware & Role System
- [ ] Tambah role di users table (migration)
- [ ] Buat middleware.ts
- [ ] Update login API return role
- [ ] Test akses /admin

### Step 2: Buat Portal Register
- [ ] Buat layout /register
- [ ] Buat halaman daftar seminar
- [ ] Buat halaman registrasi
- [ ] Buat halaman status & QR Code
- [ ] Test registrasi end-to-end

### Step 3: Buat Portal Attendance
- [ ] Buat layout /attendance
- [ ] Buat dashboard pilih seminar
- [ ] Pindahkan QR scanner dari /presensi ke /attendance/qr
- [ ] Buat Face Recognition page
- [ ] Buat Input Kode Manual page
- [ ] Buat API attendance (face, qr, code)
- [ ] Test 3 metode presensi

### Step 4: Update Admin
- [ ] Ubah menu "Presensi QR" → "Presensi"
- [ ] Buat halaman monitoring presensi (/admin/attendance)
- [ ] Buat halaman pengaturan presensi
- [ ] Hapus link /presensi dari sidebar

### Step 5: Cleanup & Testing
- [ ] Test semua portal
- [ ] Test middleware role protection
- [ ] Verifikasi fitur existing masih berjalan
- [ ] Update dokumentasi

---

## Database Changes (Minimal)

### Migration: Add role to users
```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'admin';
-- Values: 'admin', 'attendance_officer', 'participant'
```

### Optional: Add attendance_officers table (jika perlu terpisah)
```sql
CREATE TABLE attendance_officers (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) REFERENCES users(id),
  seminar_id VARCHAR(36) REFERENCES seminars(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## File Structure Baru

```
src/app/
├── admin/                    # Existing - minimal changes
│   ├── attendance/           # NEW: Monitoring & settings
│   │   ├── page.tsx          # Monitoring presensi
│   │   └── settings/page.tsx # Pengaturan presensi
│   └── layout.tsx            # Update menu
├── register/                 # NEW: Portal Peserta
│   ├── layout.tsx
│   ├── page.tsx              # Daftar seminar
│   ├── [seminarId]/page.tsx  # Form registrasi
│   ├── status/page.tsx       # Cek status
│   └── qr/[id]/page.tsx      # QR Code peserta
├── attendance/               # NEW: Portal Petugas
│   ├── layout.tsx
│   ├── page.tsx              # Dashboard pilih seminar
│   ├── [seminarId]/
│   │   ├── page.tsx          # Overview
│   │   ├── face/page.tsx     # Face recognition
│   │   ├── qr/page.tsx       # QR Scanner (dari /presensi)
│   │   └── code/page.tsx     # Input kode manual
│   ├── history/page.tsx      # Riwayat
│   └── login/page.tsx        # Login petugas
├── presensi/                 # DEPRECATED - redirect ke /attendance
├── api/
│   ├── attendance/           # NEW APIs
│   │   ├── face/route.ts
│   │   ├── qr/route.ts
│   │   ├── code/route.ts
│   │   └── history/route.ts
│   └── auth/
│       ├── attendance-login/route.ts
│       └── register-login/route.ts
└── middleware.ts             # NEW: Role-based protection
```

---

## Catatan Penting

1. **JANGAN HAPUS** fitur existing di /admin
2. **JANGAN UBAH** struktur database kecuali tambah kolom `role`
3. **GUNAKAN** API existing sebanyak mungkin
4. **TEST** setiap phase sebelum lanjut ke phase berikutnya
5. **BACKUP** kode sebelum mulai refactor besar