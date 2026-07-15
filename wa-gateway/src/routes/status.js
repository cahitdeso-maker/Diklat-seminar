/**
 * Status Route
 * 
 * GET /status - Cek status koneksi WhatsApp
 * GET /health - Healthcheck sederhana (tanpa API key)
 */

const express = require("express");
const router = express.Router();
const connection = require("../baileys/connection");
const { getQueueStatus } = require("../queue/dispatcher");

router.get("/", (req, res) => {
  try {
    const waStatus = connection.getStatus();
    const userInfo = connection.getUserInfo();
    const queueStatus = getQueueStatus();

    return res.json({
      success: true,
      data: {
        wa: {
          status: waStatus.status,
          connected: waStatus.connected,
          hasQr: waStatus.hasQr,
          user: userInfo,
        },
        queue: queueStatus,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Status route error:", error);
    return res.status(500).json({
      success: false,
      message: `Error getting status: ${error.message}`,
    });
  }
});

module.exports = router;
