/**
 * Queue Dispatcher
 * 
 * Antrian internal untuk mengirim pesan dengan delay 1.5-3 detik
 * agar WhatsApp tidak menganggap kita sebagai spam.
 * 
 * Menggunakan p-queue untuk rate limiting.
 */

const PQueue = require("p-queue").default;

// Konfigurasi delay (dalam milidetik)
const DELAY_MIN = parseInt(process.env.SEND_DELAY_MIN) || 1500;
const DELAY_MAX = parseInt(process.env.SEND_DELAY_MAX) || 3000;

// Buat queue dengan concurrency 1 (sequential)
const queue = new PQueue({
  concurrency: 1,
  intervalCap: 1,
  interval: DELAY_MAX,
});

/**
 * Mendapatkan delay acak antara min dan max
 */
function getRandomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN + 1)) + DELAY_MIN;
}

/**
 * Menambahkan tugas pengiriman pesan ke queue
 * @param {Function} sendFn - Async function yang akan dipanggil
 * @param {string} description - Deskripsi untuk logging
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function enqueue(sendFn, description = "Send message") {
  return queue.add(async () => {
    try {
      // Delay antar pengiriman
      const delay = getRandomDelay();
      console.log(`⏳ [${description}] Menunggu ${delay}ms sebelum kirim...`);
      await new Promise((resolve) => setTimeout(resolve, delay));

      console.log(`📤 [${description}] Mengirim pesan...`);
      const result = await sendFn();
      return result;
    } catch (error) {
      console.error(`❌ [${description}] Error:`, error.message);
      return {
        success: false,
        message: `Queue error: ${error.message}`,
      };
    }
  });
}

/**
 * Mendapatkan status antrian
 */
function getQueueStatus() {
  return {
    pending: queue.size,
    inProgress: queue.pending,
    totalCompleted: 0, // p-queue tidak menyimpan ini, bisa ditambahkan custom
  };
}

/**
 * Membersihkan queue
 */
function clearQueue() {
  queue.clear();
  console.log("🧹 Queue dibersihkan");
}

module.exports = {
  enqueue,
  getQueueStatus,
  clearQueue,
};
