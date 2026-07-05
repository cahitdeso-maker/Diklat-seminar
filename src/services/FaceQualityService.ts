/**
 * FaceQualityService
 *
 * Validates face quality for registration/attendance.
 * Checks: face position, distance, centering, single face, blur, brightness.
 *
 * This service is independent of the recognition model.
 */
import type { FaceDetectionResult } from "./FaceDetectionService";

export interface FaceQuality {
  score: number; // 0-100
  isBlurry: boolean;
  isTooDark: boolean;
  isTooClose: boolean;
  isTooFar: boolean;
  isCentered: boolean;
  isSingleFace: boolean;
  messages: string[];
}

/**
 * Validate face quality from detection result.
 */
export function validateFaceQuality(
  result: FaceDetectionResult,
  videoWidth: number,
  videoHeight: number
): FaceQuality {
  const messages: string[] = [];
  let score = 100;

  // Check if face detected
  if (!result.detected) {
    return {
      score: 0,
      isBlurry: false,
      isTooDark: false,
      isTooClose: false,
      isTooFar: false,
      isCentered: false,
      isSingleFace: false,
      messages: ["Wajah tidak terdeteksi"],
    };
  }

  // Check single face
  const isSingleFace = result.faceCount === 1;
  if (!isSingleFace) {
    messages.push(
      result.faceCount > 1
        ? "Terlalu banyak wajah"
        : "Wajah tidak terdeteksi"
    );
    score -= 30;
  }

  // Check face position (centered)
  const isCentered = (() => {
    if (!result.faceRect) return false;
    const cx = result.faceRect.x + result.faceRect.width / 2;
    const cy = result.faceRect.y + result.faceRect.height / 2;
    return cx >= 0.3 && cx <= 0.7 && cy >= 0.3 && cy <= 0.7;
  })();
  if (!isCentered) {
    messages.push("Posisikan wajah di tengah frame");
    score -= 15;
  }

  // Check face distance (too close / too far)
  const isTooClose = (() => {
    if (!result.faceRect) return false;
    return result.faceRect.width > 0.6 || result.faceRect.height > 0.7;
  })();
  const isTooFar = (() => {
    if (!result.faceRect) return false;
    return result.faceRect.width < 0.1 || result.faceRect.height < 0.1;
  })();

  if (isTooClose) {
    messages.push("Wajah terlalu dekat");
    score -= 15;
  }
  if (isTooFar) {
    messages.push("Wajah terlalu jauh");
    score -= 15;
  }

  return {
    score: Math.max(0, score),
    isBlurry: false,
    isTooDark: false,
    isTooClose,
    isTooFar,
    isCentered,
    isSingleFace,
    messages,
  };
}

/**
 * Analyze image quality (blur and brightness) using canvas pixel analysis.
 */
export async function analyzeImageQuality(
  dataUrl: string
): Promise<{
  isBlurry: boolean;
  isTooDark: boolean;
  brightness: number;
  sharpness: number;
}> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 100, 100);
      const data = ctx.getImageData(0, 0, 100, 100).data;

      // Calculate brightness
      let totalBrightness = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray =
          data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        totalBrightness += gray;
      }
      const avgBrightness = totalBrightness / (100 * 100);
      const isTooDark = avgBrightness < 40;

      // Calculate sharpness using Laplacian-like variance
      let sumSq = 0;
      let count = 0;
      for (let y = 1; y < 99; y++) {
        for (let x = 1; x < 99; x++) {
          const idx = (y * 100 + x) * 4;
          const center =
            data[idx] * 0.299 +
            data[idx + 1] * 0.587 +
            data[idx + 2] * 0.114;
          const top =
            data[((y - 1) * 100 + x) * 4] * 0.299 +
            data[((y - 1) * 100 + x) * 4 + 1] * 0.587 +
            data[((y - 1) * 100 + x) * 4 + 2] * 0.114;
          const diff = center - top;
          sumSq += diff * diff;
          count++;
        }
      }
      const variance = sumSq / count;
      const isBlurry = variance < 15;

      resolve({
        isBlurry,
        isTooDark,
        brightness: Math.round(avgBrightness),
        sharpness: Math.round(variance),
      });
    };
    img.onerror = () =>
      resolve({
        isBlurry: true,
        isTooDark: true,
        brightness: 0,
        sharpness: 0,
      });
    img.src = dataUrl;
  });
}