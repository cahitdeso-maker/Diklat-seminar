/**
 * FaceDetectionService
 *
 * Uses face-api.js (tinyFaceDetector + faceLandmark68Net) for face detection
 * and landmark estimation.
 *
 * Features:
 * - Singleton model loading (shared loadingPromise prevents duplicate loads)
 * - Models loaded from local /models/ directory (no CDN dependency)
 * - Video readiness validation before detection
 * - try/catch around detection with safe error handling
 * - Reusable canvas instances for performance
 *
 * face-api.js tinyFaceDetector is lightweight, real-time, and runs fully client-side.
 */

let modelsLoaded = false;
let modelLoadPromise: Promise<void> | null = null;
let loadAttempted = false;

const MODEL_URL = "/models";

export interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  landmarks?: Float32Array[];
  faceRect?: { x: number; y: number; width: number; height: number };
  faceScore?: number;
}

// Reusable canvas for cropping (avoids allocation per frame)
let cropCanvas: HTMLCanvasElement | null = null;
let cropCtx: CanvasRenderingContext2D | null = null;

function getCropCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!cropCanvas) {
    cropCanvas = document.createElement("canvas");
    cropCtx = cropCanvas.getContext("2d");
  }
  return { canvas: cropCanvas, ctx: cropCtx! };
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[FaceDetection]", ...args);
  }
}

/**
 * Load face-api.js models (tinyFaceDetector + faceLandmark68Net) from local /models/ directory.
 * Uses singleton pattern - only loads once even if called multiple times concurrently.
 */
export async function loadFaceLandmarkerModel(): Promise<void> {
  if (modelsLoaded) return;
  if (loadAttempted && modelLoadPromise) return modelLoadPromise;
  if (loadAttempted && !modelLoadPromise) {
    throw new Error("Model face detection gagal dimuat sebelumnya. Refresh halaman untuk mencoba lagi.");
  }

  loadAttempted = true;

  modelLoadPromise = (async () => {
    try {
      debugLog("loading face-api.js models from local /models/...");

      // Dynamically import face-api.js
      const faceapi = await import("@vladmandic/face-api");

      // Load models in parallel
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      debugLog("face-api.js models loaded successfully");
    } catch (error) {
      modelsLoaded = false;
      modelLoadPromise = null;
      loadAttempted = false; // Allow retry on next call
      console.error("[FaceDetection] Failed to load face-api.js models:", error);
      throw new Error("Gagal memuat model face detection");
    }
  })();

  return modelLoadPromise;
}

/**
 * Validate that a video element is ready for detection.
 */
function isVideoReady(video: HTMLVideoElement): boolean {
  return (
    video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

/**
 * Detect faces in a video frame using face-api.js tinyFaceDetector.
 * Returns face landmarks (68-point), bounding box, and face count.
 *
 * Safe to call even if video is not ready - returns { detected: false } gracefully.
 */
export async function detectFaces(
  video: HTMLVideoElement,
  _timestamp: number
): Promise<FaceDetectionResult> {
  // Validate video readiness
  if (!isVideoReady(video)) {
    debugLog("detection skipped - video not ready", {
      readyState: video.readyState,
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
    });
    return { detected: false, faceCount: 0 };
  }

  await loadFaceLandmarkerModel();

  if (!modelsLoaded) {
    debugLog("detection skipped - model not loaded");
    return { detected: false, faceCount: 0 };
  }

  try {
    const faceapi = await import("@vladmandic/face-api");

    // Use tinyFaceDetector for fast, lightweight detection
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5,
    });

    const result = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks();

    if (!result) {
      return { detected: false, faceCount: 0 };
    }

    const faceCount = 1;
    const box = result.detection.box;
    const landmarks = result.landmarks;

    // Convert landmarks to Float32Array (compatible with existing code)
    const positions = landmarks.positions;
    const landmarkArray = new Float32Array(positions.length * 3);
    for (let i = 0; i < positions.length; i++) {
      landmarkArray[i * 3] = positions[i].x;
      landmarkArray[i * 3 + 1] = positions[i].y;
      landmarkArray[i * 3 + 2] = 0;
    }

    // Normalize face rect to 0-1 range
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const faceRect = {
      x: box.x / vw,
      y: box.y / vh,
      width: box.width / vw,
      height: box.height / vh,
    };

    debugLog("face detected", { faceCount, faceRect });

    return {
      detected: true,
      faceCount,
      landmarks: [landmarkArray],
      faceRect,
      faceScore: result.detection.score,
    };
  } catch (error) {
    // Log the real error and return safe default - never crash the attendance process
    console.error("[FaceDetection] detection error:", error);
    debugLog("detection error - skipping frame");
    return { detected: false, faceCount: 0 };
  }
}

/**
 * Crop face region from a video frame using bounding box.
 * Returns a canvas with the cropped face.
 *
 * Uses a reusable canvas to avoid memory allocation per frame.
 * Clamps coordinates to prevent negative width/height and canvas errors.
 */
export function cropFace(
  video: HTMLVideoElement,
  faceRect: { x: number; y: number; width: number; height: number },
  padding: number = 0.3
): HTMLCanvasElement {
  const vw = video.videoWidth;
  const vh = video.videoHeight;

  if (vw <= 0 || vh <= 0) {
    debugLog("cropFace skipped - invalid video dimensions");
    const { canvas } = getCropCanvas();
    canvas.width = 0;
    canvas.height = 0;
    return canvas;
  }

  // Convert normalized coordinates to pixels
  let cx = faceRect.x * vw + (faceRect.width * vw) / 2;
  let cy = faceRect.y * vh + (faceRect.height * vh) / 2;
  let size = Math.max(faceRect.width * vw, faceRect.height * vh) * (1 + padding);

  // Clamp to video bounds
  const halfSize = size / 2;
  cx = Math.max(halfSize, Math.min(vw - halfSize, cx));
  cy = Math.max(halfSize, Math.min(vh - halfSize, cy));

  const x = Math.max(0, Math.round(cx - halfSize));
  const y = Math.max(0, Math.round(cy - halfSize));
  const w = Math.min(vw - x, Math.round(size));
  const h = Math.min(vh - y, Math.round(size));

  // Prevent negative or zero dimensions
  const finalW = Math.max(1, w);
  const finalH = Math.max(1, h);

  const { canvas, ctx } = getCropCanvas();
  canvas.width = finalW;
  canvas.height = finalH;
  ctx.drawImage(video, x, y, finalW, finalH, 0, 0, finalW, finalH);

  debugLog("face cropped", { x, y, w: finalW, h: finalH });

  return canvas;
}

/**
 * Check if the model is loaded.
 */
export function isModelLoaded(): boolean {
  return modelsLoaded;
}