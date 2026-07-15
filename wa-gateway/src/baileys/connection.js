/**
 * Baileys WhatsApp Connection Manager
 * 
 * Mengelola koneksi WebSocket ke WhatsApp Web:
 * - Auto-reconnect saat disconnect (kecuali loggedOut)
 * - QR code generation untuk pairing pertama
 * - Session persistence via multi-file auth state
 */

const {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  Browsers,
} = require("@whiskeysockets/baileys");
const path = require("path");
const fs = require("fs");
const pino = require("pino");

const AUTH_DIR = path.join(__dirname, "..", "..", "auth_info_baileys");
const LOG_DIR = path.join(__dirname, "..", "..", "logs");

// Buat direktori logs jika belum ada (sebelum logger dibuat)
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logger untuk Baileys (file)
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: "pino/file",
    options: { destination: path.join(LOG_DIR, "baileys.log") },
  },
});

// Logger untuk console (stdout)
const consoleLogger = pino({
  level: process.env.LOG_LEVEL || "info",
});

let sock = null;
let currentQr = null;
let connectionStatus = "disconnected"; // disconnected | connecting | connected | qr_required | logged_out

// Callback untuk memberi tahu QR code baru
let onQrCallback = null;

// Event listeners
let eventListeners = {
  onConnected: [],
  onDisconnected: [],
  onQr: [],
};

/**
 * Mendapatkan status koneksi saat ini
 */
function getStatus() {
  return {
    status: connectionStatus,
    hasQr: currentQr !== null,
    connected: connectionStatus === "connected",
  };
}

/**
 * Mendapatkan QR code terbaru (base64)
 */
function getQr() {
  return currentQr;
}

/**
 * Register callback untuk QR code
 */
function onQr(callback) {
  onQrCallback = callback;
}

/**
 * Register event listener
 */
function on(event, callback) {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
  }
}

/**
 * Emit event ke semua listener
 */
function emit(event, ...args) {
  if (eventListeners[event]) {
    for (const cb of eventListeners[event]) {
      try {
        cb(...args);
      } catch (err) {
        consoleLogger.error(`Error in ${event} listener:`, err);
      }
    }
  }
}

/**
 * Inisialisasi koneksi WhatsApp
 */
async function connect() {
  try {
    // Pastikan direktori auth ada
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    connectionStatus = "connecting";
    emit("statusChange", connectionStatus);
    consoleLogger.info("🔄 Menghubungkan ke WhatsApp...");

    // Dapatkan versi Baileys terbaru
    const { version, isLatest } = await fetchLatestBaileysVersion();
    consoleLogger.info(`📱 Baileys version: ${version.join(".")}, isLatest: ${isLatest}`);

    // Load auth state dari session yang tersimpan
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    // Cek apakah sudah pernah login (ada credentials tersimpan)
    const hasExistingSession = fs.existsSync(path.join(AUTH_DIR, "creds.json"));
    if (hasExistingSession) {
      consoleLogger.info("📁 Session tersimpan ditemukan, mencoba koneksi...");
    }

    // Buat koneksi socket
    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false, // Kita handle QR sendiri
      browser: Browsers.windows("Chrome"), // User agent
      auth: state,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
    });

    // Simpan credentials saat berubah (session persistence)
    sock.ev.on("creds.update", saveCreds);

    // Handle update koneksi
    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      // QR code untuk pairing
      if (qr) {
        currentQr = qr;
        connectionStatus = "qr_required";
        consoleLogger.info("📱 QR Code baru tersedia! Scan dengan WhatsApp Anda.");
        emit("statusChange", connectionStatus);
        emit("qr", qr);
        if (onQrCallback) onQrCallback(qr);
      }

      // Status koneksi berubah
      if (connection) {
        consoleLogger.info(`📡 Connection status: ${connection}`);

        if (connection === "open") {
          currentQr = null;
          connectionStatus = "connected";
          emit("statusChange", connectionStatus);
          emit("connected");
          const userNumber = sock?.user?.id?.split(":")[0] || "Tidak diketahui";
          const userName = sock?.user?.name || sock?.user?.pushName || "Tidak diketahui";
          consoleLogger.info(`✅ WhatsApp terhubung!`);
          consoleLogger.info(`   Nomor: ${userNumber}`);
          consoleLogger.info(`   Nama:  ${userName}`);
        }

        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode || 500;
          const shouldReconnect =
            statusCode !== DisconnectReason.loggedOut;

          consoleLogger.info(
            `❌ Koneksi tertutup (kode: ${statusCode})` +
              (shouldReconnect ? " -> akan reconnect..." : " -> logout permanen")
          );

          if (statusCode === DisconnectReason.loggedOut) {
            connectionStatus = "logged_out";
            emit("statusChange", connectionStatus);
            emit("disconnected", "logged_out");
            consoleLogger.warn(
              "⚠️ Session WhatsApp telah logout. Hapus folder auth_info_baileys untuk pairing ulang."
            );
          } else {
            connectionStatus = "disconnected";
            emit("statusChange", connectionStatus);
            emit("disconnected", "reconnecting");

            if (shouldReconnect) {
              consoleLogger.info("⏳ Reconnect dalam 3 detik...");
              setTimeout(() => {
                connect().catch((err) => {
                  consoleLogger.error("Gagal reconnect:", err);
                });
              }, 3000);
            }
          }
        }
      }
    });

    // Handle pesan masuk (berguna nanti untuk auto-reply)
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      // Untuk fase ini kita hanya log, tidak perlu auto-reply
      if (type === "notify") {
        for (const msg of messages) {
          if (msg.key?.remoteJid && !msg.key.fromMe) {
            const preview = msg.message?.conversation?.substring(0, 50) || "(non-teks)";
            consoleLogger.debug(`📨 Pesan masuk dari ${msg.key.remoteJid}: ${preview}`);
          }
        }
      }
    });

    return sock;
  } catch (error) {
    connectionStatus = "disconnected";
    consoleLogger.error("❌ Gagal membuat koneksi WhatsApp:", error);
    emit("statusChange", connectionStatus);

    // Auto-reconnect untuk error non-fatal
    consoleLogger.info("⏳ Reconnect dalam 5 detik...");
    setTimeout(() => {
      connect().catch((err) => {
        consoleLogger.error("Gagal reconnect:", err);
      });
    }, 5000);

    throw error;
  }
}

/**
 * Mengirim pesan WhatsApp
 * @param {string} jid - Nomor tujuan (format: 628xxx atau 628xxx@s.whatsapp.net)
 * @param {string} text - Teks pesan
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function sendMessage(jid, text) {
  if (!sock) {
    return { success: false, message: "Koneksi WhatsApp belum tersedia" };
  }

  if (connectionStatus !== "connected") {
    return {
      success: false,
      message: `WhatsApp tidak terhubung (status: ${connectionStatus})`,
    };
  }

  try {
    // Format JID jika belum ada @s.whatsapp.net
    const fullJid = jid.includes("@s.whatsapp.net") ? jid : `${jid}@s.whatsapp.net`;

    const result = await sock.sendMessage(fullJid, {
      text: text,
    });

    consoleLogger.info(`✅ Pesan terkirim ke ${jid}`);
    return {
      success: true,
      message: "Pesan berhasil dikirim",
      messageId: result?.key?.id || null,
    };
  } catch (error) {
    consoleLogger.error(`❌ Gagal mengirim pesan ke ${jid}:`, error.message);
    return {
      success: false,
      message: `Gagal mengirim pesan: ${error.message}`,
    };
  }
}

/**
 * Logout dan hapus session
 */
async function logout() {
  if (sock) {
    try {
      await sock.logout();
    } catch (err) {
      consoleLogger.error("Error saat logout:", err);
    }
    sock = null;
  }
  connectionStatus = "logged_out";

  // Hapus folder auth
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    consoleLogger.info("🗑️ Auth folder dibersihkan");
  } catch (err) {
    consoleLogger.error("Gagal membersihkan auth folder:", err);
  }

  return { success: true };
}

/**
 * Mendapatkan informasi user WhatsApp
 */
function getUserInfo() {
  if (!sock || !sock.user) return null;
  return {
    id: sock.user.id,
    name: sock.user.name || sock.user.pushName,
    number: sock.user.id?.split(":")[0],
  };
}

module.exports = {
  connect,
  sendMessage,
  logout,
  getStatus,
  getQr,
  onQr,
  on,
  getUserInfo,
};
