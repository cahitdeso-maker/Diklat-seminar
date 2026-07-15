/**
 * WA Gateway - WhatsApp Messaging Gateway
 * 
 * Server Express yang menyediakan REST API untuk mengirim pesan WhatsApp
 * menggunakan library @whiskeysockets/baileys.
 * 
 * Usage:
 *   1. Copy .env.example ke .env dan isi konfigurasi
 *   2. npm install
 *   3. node src/index.js
 *   4. Scan QR code yang muncul di log
 *   5. Kirim pesan via POST /send-message
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const connection = require("./baileys/connection");
const apiKeyAuth = require("./middleware/apiKeyAuth");

// Routes
const statusRoute = require("./routes/status");
const sendRoute = require("./routes/send");
const qrRoute = require("./routes/qr");
const logoutRoute = require("./routes/logout");

const PORT = parseInt(process.env.PORT) || 3000;

const app = express();

// ============================================
// Middleware
// ============================================

app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(apiKeyAuth);

// ============================================
// Routes
// ============================================

// Healthcheck (tanpa API key)
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "WA Gateway is running",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "WA Gateway - Presensi Medis Pintar",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      status: "GET /status",
      qr: "GET /qr",
      qrImage: "GET /qr/image",
      sendMessage: "POST /send-message",
      logout: "POST /logout",
    },
    documentation: "Gunakan header X-API-KEY untuk semua endpoint kecuali /health",
  });
});

// API Routes
app.use("/status", statusRoute);
app.use("/send-message", sendRoute);
app.use("/qr", qrRoute);
app.use("/logout", logoutRoute);

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ============================================
// Start Server
// ============================================

async function start() {
  try {
    // Buat direktori logs jika belum ada
    const logDir = path.join(__dirname, "..", "logs");
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    // Start HTTP server
    app.listen(PORT, "0.0.0.0", () => {
      console.log("=".repeat(60));
      console.log("  🚀 WA GATEWAY - WhatsApp Messaging Gateway");
      console.log("=".repeat(60));
      console.log(`  📡 Server: http://0.0.0.0:${PORT}`);
      console.log(`  📋 Status: http://localhost:${PORT}/status`);
      console.log(`  📤 Send:   POST http://localhost:${PORT}/send-message`);
      console.log(`  📱 QR:     http://localhost:${PORT}/qr`);
      console.log(`  🔒 Logout: POST http://localhost:${PORT}/logout`);
      console.log("=".repeat(60));
      console.log("");
      console.log("  ⏳ Menghubungkan ke WhatsApp...");
      console.log("  📱 Jika pertama kali, scan QR code di http://localhost:${PORT}/qr");
      console.log("");
    });

    // Connect WhatsApp
    await connection.connect();

    // Log saat terhubung
    connection.on("connected", () => {
      const user = connection.getUserInfo();
      console.log("");
      console.log("✅".repeat(30));
      console.log("  ✅ WhatsApp TERHUBUNG!");
      if (user) {
        console.log(`  📱 Nomor: ${user.number}`);
        console.log(`  👤 Nama:  ${user.name}`);
      }
      console.log("✅".repeat(30));
      console.log("");
    });

    // Log saat QR tersedia
    connection.on("qr", (qr) => {
      console.log("");
      console.log("📱".repeat(30));
      console.log("  📱 QR CODE BARU TERSEDIA!");
      console.log("  📱 Buka http://localhost:${PORT}/qr untuk melihat QR code");
      console.log("  📱 Scan dengan WhatsApp > Settings > Linked Devices");
      console.log("📱".repeat(30));
      console.log("");
    });

    // Log saat disconnect
    connection.on("disconnected", (reason) => {
      console.log("");
      console.warn(`  ⚠️ WhatsApp disconnect: ${reason}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Gagal start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Mematikan server...");
  await connection.logout().catch(() => {});
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Mematikan server...");
  await connection.logout().catch(() => {});
  process.exit(0);
});

start();
