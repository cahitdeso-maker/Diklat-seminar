/**
 * Logout Route
 * 
 * POST /logout - Logout dari WhatsApp dan hapus session
 */

const express = require("express");
const router = express.Router();
const connection = require("../baileys/connection");

router.post("/", async (req, res) => {
  try {
    console.log("🔒 Logout diminta...");
    await connection.logout();

    return res.json({
      success: true,
      message: "Berhasil logout. Session WhatsApp telah dihapus.",
    });
  } catch (error) {
    console.error("Logout route error:", error);
    return res.status(500).json({
      success: false,
      message: `Error logout: ${error.message}`,
    });
  }
});

module.exports = router;
