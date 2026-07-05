/**
 * FaceDetectionService
 *
 * Uses MediaPipe Face Landmarker for face detection, landmark estimation,
 * and face bounding box extraction.
 *
 * This service is ONLY for detection - NOT for recognition.
 * Recognition is handled by FaceRecognitionService using cropped face images.
 *
 * Features:
 * - Singleton model loading (shared loadingPromise prevents duplicate loads)
 * - GPU→CPU fallback automatically
 * - Video readiness validation before detection
 * - try/catch around detectForVideo() with real error logging
 * - Reusable canvas instances for performance
 * - Debug logging (removed in production)
 */
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

let faceLandmarker: FaceLandmarker | null = null;
let modelsLoaded = false;
let modelLoadPromise: Promise<void> | null = null;

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export interface FaceDetectionResult {
  detected: boolean;
  faceCount: number;
  landmarks?: Float32Array[];
  faceRect?: { x: number; y: number; width: number; height: number };
  faceScore?: number;
  landmarksRaw?: FaceLandmarkerResult;
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
 * Load MediaPipe Face Landmarker model.
 * Uses singleton pattern - only loads once even if called multiple times concurrently.
 * Automatically falls back from GPU to CPU if GPU is unavailable.
 */
export async function loadFaceLandmarkerModel(): Promise<void> {
  if (modelsLoaded && faceLandmarker) return;
  if (modelLoadPromise) return modelLoadPromise;

  modelLoadPromise = (async () => {
    try {
      debugLog("loading MediaPipe model...");

      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      // Try GPU first, fall back to CPU
      try {
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 5,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        debugLog("MediaPipe loaded (GPU)");
      } catch (gpuError) {
        debugLog("GPU delegate failed, falling back to CPU:", gpuError);
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 5,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        debugLog("MediaPipe loaded (CPU fallback)");
      }

      modelsLoaded = true;
      debugLog("MediaPipe model loaded successfully");
    } catch (error) {
      modelsLoaded = false;
      faceLandmarker = null;
      modelLoadPromise = null; // Allow retry on next call
      console.error("[FaceDetection] Failed to load MediaPipe Face Landmarker:", error);
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
 * Detect faces in a video frame using MediaPipe.
 * Returns face landmarks, bounding box, and raw result.
 *
 * Safe to call even if video is not ready - returns { detected: false } gracefully.
 */
export async function detectFaces(
  video: HTMLVideoElement,
  timestamp: number
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

  if (!faceLandmarker) {
    debugLog("detection skipped - model not loaded");
    return { detected: false, faceCount: 0 };
  }

  try {
    const result = faceLandmarker.detectForVideo(video, timestamp);

    if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
      return { detected: false, faceCount: 0 };
    }

    const faceCount = result.faceLandmarks.length;
    const landmarks = result.faceLandmarks.map((lm) => {
      const arr = new Float32Array(lm.length * 3);
      for (let i = 0; i < lm.length; i++) {
        arr[i * 3] = lm[i].x;
        arr[i * 3 + 1] = lm[i].y;
        arr[i * 3 + 2] = lm[i].z;
      }
      return arr;
    });

    // Get face bounding box from first face
    const firstFace = result.faceLandmarks[0];
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (let i = 0; i < firstFace.length; i++) {
      const p = firstFace[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const faceRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    debugLog("face detected", { faceCount, faceRect });

    return {
      detected: true,
      faceCount,
      landmarks,
      faceRect,
      faceScore: 0.9,
      landmarksRaw: result,
    };
  } catch (error) {
    // Log the real error and return safe default - never crash the attendance process
    console.error("[FaceDetection] detectForVideo() error:", error);
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
  return modelsLoaded && faceLandmarker !== null;
}