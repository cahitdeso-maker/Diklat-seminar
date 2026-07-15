/**
 * QR Code Route
 * 
 * GET /qr - Mendapatkan QR code dalam format base64
 *           (untuk pairing WhatsApp Web pertama kali)
 * 
 * GET /qr/image - Mendapatkan QR code sebagai gambar PNG
 */

const express = require("express");
const router = express.Router();
const QRCode = require("qrcode");
const connection = require("../baileys/connection");

router.get("/", async (req, res) => {
  try {
    const status = connection.getStatus();

    if (status.status === "connected") {
      return res.json({
        success: true,
        data: {
          qr: null,
          message: "WhatsApp sudah terhubung, tidak perlu scan QR",
          status: status.status,
          user: connection.getUserInfo(),
        },
      });
    }

    const qrString = connection.getQr();

    if (!qrString) {
      return res.json({
        success: false,
        data: {
          qr: null,
          message: "QR Code belum tersedia. Status: " + status.status,
          status: status.status,
        },
      });
    }

    // Generate QR code sebagai base64 data URL
    const qrImage = await QRCode.toDataURL(qrString, {
      width: 400,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return res.json({
      success: true,
      data: {
        qr: qrImage,
        qrString: qrString,
        message: "Scan QR code ini dengan WhatsApp Anda (Settings > Linked Devices)",
        status: status.status,
      },
    });
  } catch (error) {
    console.error("QR route error:", error);
    return res.status(500).json({
      success: false,
      message: `Error generating QR: ${error.message}`,
    });
  }
});

router.get("/image", async (req, res) => {
  try {
    const qrString = connection.getQr();

    if (!qrString) {
      return res.status(404).json({
        success: false,
        message: "QR Code belum tersedia",
      });
    }

    // Generate QR sebagai PNG buffer
    const qrBuffer = await QRCode.toBuffer(qrString, {
      type: "png",
      width: 400,
      margin: 2,
    });

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", qrBuffer.length);
    res.send(qrBuffer);
  } catch (error) {
    console.error("QR image route error:", error);
    return res.status(500).json({
      success: false,
      message: `Error generating QR image: ${error.message}`,
    });
  }
});

module.exports = router;
