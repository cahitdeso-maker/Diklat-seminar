/**
 * Send Message Route
 * 
 * POST /send-message
 * Body: { number: "628xxx", message: "Teks pesan" }
 * 
 * Mengirim pesan WhatsApp melalui antrian internal dengan delay antar pesan.
 */

const express = require("express");
const router = express.Router();
const connection = require("../baileys/connection");
const { enqueue } = require("../queue/dispatcher");

/**
 * Validasi format nomor telepon (E.164)
 * - Hanya angka
 * - Diawali 62 (kode Indonesia)
 * - Panjang antara 11-15 digit
 */
function validatePhoneNumber(number) {
  if (!number || typeof number !== "string") {
    return { valid: false, error: "Nomor telepon harus diisi" };
  }

  // Hapus karakter non-digit
  const cleaned = number.replace(/\D/g, "");

  if (cleaned.length < 10 || cleaned.length > 15) {
    return { valid: false, error: `Format nomor tidak valid (panjang: ${cleaned.length}, harus 10-15 digit)` };
  }

  if (!cleaned.startsWith("62")) {
    return { valid: false, error: "Nomor harus diawali kode negara 62 (contoh: 628123456789)" };
  }

  return { valid: true, number: cleaned };
}

router.post("/", async (req, res) => {
  try {
    const { number, message } = req.body;

    // Validasi input
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Pesan tidak boleh kosong",
      });
    }

    // Validasi nomor
    const validation = validatePhoneNumber(number);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const validNumber = validation.number;

    // Cek status koneksi
    const status = connection.getStatus();
    if (status.status !== "connected") {
      return res.status(503).json({
        success: false,
        message: `WhatsApp tidak terhubung (status: ${status.status})`,
        status: status.status,
      });
    }

    console.log(`📝 Antrian pesan ke ${validNumber}: "${message.substring(0, 50)}..."`);

    // Masukkan ke antrian internal (delay 1.5-3 detik)
    const result = await enqueue(
      () => connection.sendMessage(validNumber, message.trim()),
      `WA ke ${validNumber}`
    );

    if (result.success) {
      return res.json({
        success: true,
        message: "Pesan berhasil dikirim",
        messageId: result.messageId || null,
      });
    } else {
      return res.status(502).json({
        success: false,
        message: result.message || "Gagal mengirim pesan",
      });
    }
  } catch (error) {
    console.error("Send message route error:", error);
    return res.status(500).json({
      success: false,
      message: `Internal error: ${error.message}`,
    });
  }
});

module.exports = router;
