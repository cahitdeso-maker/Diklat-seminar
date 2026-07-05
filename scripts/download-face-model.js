/**
 * Download MobileFaceNet ONNX model for local hosting.
 *
 * This script downloads the face recognition model and saves it to public/models/.
 * Run: node scripts/download-face-model.js
 *
 * If the remote URL is unavailable, you can also manually place the model file at:
 *   public/models/mobilefacenet.onnx
 *
 * Alternative: Use a smaller model like FaceNet or download from:
 *   https://github.com/opencv/opencv_zoo/tree/master/models/face_recognition
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const MODEL_URL =
  "https://github.com/cahitdeso-maker/face-recognition-models/raw/main/mobilefacenet.onnx";
const MODEL_DIR = path.join(__dirname, "..", "public", "models");
const MODEL_PATH = path.join(MODEL_DIR, "mobilefacenet.onnx");

// Alternative URLs to try in order
const ALTERNATIVE_URLS = [
  // Hugging Face mirror
  "https://huggingface.co/onnx-community/mobilefacenet/resolve/main/mobilefacenet.onnx",
  // ONNX model zoo
  "https://github.com/onnx/models/raw/main/vision/body_analysis/face_recognition/mobilefacenet.onnx",
];

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        // Handle redirects
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          console.log(`Redirecting to: ${response.headers.location}`);
          return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(dest);
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        const totalSize = parseInt(response.headers["content-length"] || "0", 10);
        let downloadedSize = 0;
        let lastLog = 0;

        response.on("data", (chunk) => {
          downloadedSize += chunk.length;
          file.write(chunk);

          // Log progress every 10%
          if (totalSize > 0) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            if (progress - lastLog >= 10) {
              lastLog = progress;
              console.log(`  Downloading... ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)}MB / ${(totalSize / 1024 / 1024).toFixed(1)}MB)`);
            }
          }
        });

        response.on("end", () => {
          file.end();
          console.log(`  Downloaded ${(downloadedSize / 1024 / 1024).toFixed(2)}MB`);
          resolve();
        });
      })
      .on("error", (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
  });
}

async function main() {
  console.log("=== Download MobileFaceNet ONNX Model ===\n");

  // Create models directory
  if (!fs.existsSync(MODEL_DIR)) {
    fs.mkdirSync(MODEL_DIR, { recursive: true });
    console.log(`Created directory: ${MODEL_DIR}`);
  }

  // Check if model already exists
  if (fs.existsSync(MODEL_PATH)) {
    const stats = fs.statSync(MODEL_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Model already exists at: ${MODEL_PATH} (${sizeMB}MB)`);
    console.log("Delete the file to re-download.\n");
    return;
  }

  // Try primary URL
  const urlsToTry = [MODEL_URL, ...ALTERNATIVE_URLS];

  for (const url of urlsToTry) {
    console.log(`Trying: ${url}`);
    try {
      await downloadFile(url, MODEL_PATH);
      const stats = fs.statSync(MODEL_PATH);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`\n✅ Model downloaded successfully! (${sizeMB}MB)`);
      console.log(`   Saved to: ${MODEL_PATH}\n`);
      return;
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}\n`);
    }
  }

  console.error("❌ All download attempts failed.");
  console.log("\nTo manually download the model:");
  console.log("1. Download from: https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition/mobilefacenet.onnx");
  console.log("2. Save to: public/models/mobilefacenet.onnx");
  console.log("3. Or use a smaller model like FaceNet-112x112.onnx\n");
  process.exit(1);
}

main();