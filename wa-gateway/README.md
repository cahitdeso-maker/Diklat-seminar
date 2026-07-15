# WA Gateway - WhatsApp Gateway untuk Presensi Medis Pintar

Service Node.js yang menggunakan **@whiskeysockets/baileys** untuk mengirim pesan WhatsApp.

## 📋 Persyaratan

- Node.js 18+
- npm

## 🚀 Instalasi & Setup

```bash
# 1. Masuk ke direktori wa-gateway
cd wa-gateway

# 2. Install dependencies
npm install

# 3. Konfigurasi environment
cp .env.example .env
# Edit .env: isi API_KEY dengan string acak yang kuat

# 4. Jalankan service
npm start
```

## 📱 Pairing WhatsApp (Pertama Kali)

Saat pertama kali dijalankan, Anda perlu menghubungkan WhatsApp:

1. Jalankan service: `npm start`
2. Buka browser ke: `http://192.168.12.72:3000/qr`
3. Buka WhatsApp di HP > Settings > Linked Devices > Link a Device
4. Scan QR code yang tampil
5. Setelah terhubung, status akan berubah menjadi "connected"

> Session akan tersimpan di folder `auth_info_baileys/`. 
> Selama folder ini tidak dihapus, Anda tidak perlu scan ulang.

## 🔧 Penggunaan PM2 (Production)

```bash
# Install PM2 secara global
npm install -g pm2

# Jalankan dengan PM2
npm run pm2

# Agar auto-start saat server reboot
pm2 save
pm2 startup

# Melihat log
npm run pm2:logs
```

## 📡 API Endpoints

### Healthcheck (tanpa API key)
```
GET /health
```
Response:
```json
{
  "success": true,
  "message": "WA Gateway is running",
  "uptime": 123.45
}
```

### Status Koneksi
```
GET /status
Header: X-API-KEY: your-api-key
```
Response:
```json
{
  "success": true,
  "data": {
    "wa": {
      "status": "connected",
      "connected": true,
      "hasQr": false,
      "user": {
        "id": "628xxx@s.whatsapp.net",
        "name": "RSUD PKU",
        "number": "628xxx"
      }
    },
    "queue": { "pending": 0, "inProgress": 0 }
  }
}
```

### Kirim Pesan
```
POST /send-message
Header: X-API-KEY: your-api-key
Body: {
  "number": "6281234567890",
  "message": "Halo, ini pesan dari sistem!"
}
```
Response:
```json
{
  "success": true,
  "message": "Pesan berhasil dikirim",
  "messageId": "BAE5..."
}
```

### QR Code
```
GET /qr
Header: X-API-KEY: your-api-key
```
Response:
```json
{
  "success": true,
  "data": {
    "qr": "data:image/png;base64,...",
    "qrString": "...",
    "status": "qr_required"
  }
}
```

### QR Code sebagai Gambar
```
GET /qr/image
Header: X-API-KEY: your-api-key
```
Langsung mengembalikan gambar PNG.

### Logout
```
POST /logout
Header: X-API-KEY: your-api-key
```
Menghapus session dan membutuhkan scan QR ulang.

## 🐳 Docker

```bash
# Build image
docker build -t wa-gateway .

# Jalankan container
docker run -d \
  --name wa-gateway \
  --restart always \
  -p 3000:3000 \
  -v wa-auth:/app/auth_info_baileys \
  -e API_KEY=your-api-key \
  wa-gateway
```

## 📁 Struktur Folder

```
wa-gateway/
├── src/
│   ├── index.js              # Entry point Express server
│   ├── baileys/
│   │   └── connection.js     # Koneksi WhatsApp + auto-reconnect
│   ├── routes/
│   │   ├── send.js           # POST /send-message
│   │   ├── status.js         # GET /status
│   │   ├── qr.js             # GET /qr
│   │   └── logout.js         # POST /logout
│   ├── middleware/
│   │   └── apiKeyAuth.js     # Validasi API key
│   └── queue/
│       └── dispatcher.js     # Antrian dengan delay antar pesan
├── auth_info_baileys/        # Session WhatsApp (JANGAN di-commit!)
├── logs/                     # File log
├── package.json
├── ecosystem.config.js       # PM2 configuration
├── Dockerfile
└── .env
```

## ⚡ Integrasi dengan Next.js

Dari Next.js, panggil endpoint ini:

```javascript
const res = await fetch("http://192.168.12.72:3000/send-message", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": "wa-gateway-key-2024-presensi-medis",
  },
  body: JSON.stringify({
    number: "6281234567890",
    message: "Halo, ini notifikasi dari sistem!",
  }),
});
```

> File `src/lib/whatsapp.ts` di project Next.js sudah dikonfigurasi untuk ini.

## 🔒 Keamanan

- Semua endpoint (kecuali `/health`) dilindungi API key
- Hanya berjalan di internal network (`0.0.0.0:3000`)
- Jangan expose port 3000 ke internet publik
- Folder `auth_info_baileys/` tidak pernah di-commit ke git/docker

## ⚙️ Konfigurasi Environment

| Variabel | Default | Deskripsi |
|---|---|---|
| `PORT` | 3000 | Port HTTP server |
| `API_KEY` | (wajib diisi) | API key untuk autentikasi |
| `SEND_DELAY_MIN` | 1500 | Delay minimal antar pesan (ms) |
| `SEND_DELAY_MAX` | 3000 | Delay maksimal antar pesan (ms) |
| `LOG_LEVEL` | info | Level logging (trace/debug/info/warn/error/fatal) |
| `NEXTJS_WEBHOOK_URL` | - | URL webhook callback ke Next.js |
| `NEXTJS_WEBHOOK_SECRET` | - | Secret untuk webhook |

## 🛠️ Troubleshooting

**QR Code tidak muncul:**
- Pastikan belum ada session sebelumnya: `rm -rf auth_info_baileys/*`
- Restart service

**Pesan gagal dikirim:**
- Cek status: `curl http://localhost:3000/status -H "X-API-KEY: your-key"`
- Pastikan nomor dalam format internasional (628xx)
- Pastikan WhatsApp masih terhubung

**Auto-reconnect tidak bekerja:**
- Jika `loggedOut`, session sudah tidak valid. Hapus `auth_info_baileys/` dan pairing ulang.
