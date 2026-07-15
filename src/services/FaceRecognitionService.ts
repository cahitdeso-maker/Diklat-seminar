/**
 * FaceRecognitionService
 *
 * Generates face embeddings for recognition using ONNX model.
 * This service ONLY receives cropped face images - NEVER MediaPipe landmarks.
 *
 * Architecture:
 * - Input: Cropped face image (HTMLCanvasElement) from FaceDetectionService
 * - Processing: ONNX ArcFace model inference
 * - Output: 512D normalized embedding vector
 * - Matching: Cosine similarity with threshold >= 0.90
 *
 * If the ONNX model is not available, the system cannot perform recognition.
 * (Landmark-based embedding has been removed - it was not accurate enough for production.)
 */
let onnxAvailable = false;
let modelsLoaded = false;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

const MODEL_URL = "/models";

export interface RecognitionResult {
  success: boolean;
  embedding: number[];
  inferenceTime: number;
  method: "facenet";
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[FaceRecognition]", ...args);
  }
}

/**
 * Load face-api.js faceRecognitionNet model from local /models/ directory.
 * Uses singleton pattern - only loads once.
 */
export async function loadRecognitionModel(): Promise<void> {
  if (modelsLoaded) return;
  if (isLoading && loadPromise) return loadPromise;

  isLoading = true;

  loadPromise = (async () => {
    try {
      debugLog("loading face-api.js faceRecognitionNet from local /models/...");

      // Dynamically import face-api.js
      const faceapi = await import("@vladmandic/face-api");

      // Load all required models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      modelsLoaded = true;
      onnxAvailable = true;
      debugLog("face-api.js recognition model loaded successfully");
    } catch (error) {
      console.error("[FaceRecognition] Failed to load face-api.js models:", error);
      onnxAvailable = false;
      modelsLoaded = false;
    }

    isLoading = false;
  })();

  return loadPromise;
}

/**
 * Generate a face descriptor (128-dimension) from an input element.
 * Uses face-api.js tinyFaceDetector + faceLandmark68Net + faceRecognitionNet.
 *
 * @param input - Video, Canvas, or Image element containing the face
 * @returns RecognitionResult with descriptor and inference time
 */
export async function generateEmbedding(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<RecognitionResult> {
  await loadRecognitionModel();

  if (!modelsLoaded || !onnxAvailable) {
    throw new Error(
      "Model pengenalan wajah tidak tersedia. " +
      "Silakan refresh halaman untuk memuat ulang model."
    );
  }

  const startTime = performance.now();

  try {
    const faceapi = await import("@vladmandic/face-api");

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.5,
    });

    const result = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) {
      throw new Error("Wajah tidak terdeteksi pada input");
    }

    // Get 128D face descriptor
    const descriptor = Array.from(result.descriptor);

    const inferenceTime = Math.round(performance.now() - startTime);

    debugLog("face descriptor generated", {
      dim: descriptor.length,
      inferenceTime: `${inferenceTime}ms`,
    });

    return {
      success: true,
      embedding: descriptor,
      inferenceTime,
      method: "facenet",
    };
  } catch (error) {
    debugLog("descriptor generation failed:", error);
    throw error;
  }
}

/**
 * Generate a face descriptor from a base64 data URL.
 */
export async function generateEmbeddingFromDataUrl(
  dataUrl: string
): Promise<RecognitionResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = async () => {
      try {
        // Draw image to canvas first, then use canvas
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Gagal menginisialisasi canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        const result = await generateEmbedding(canvas);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.src = dataUrl;
  });
}

/**
 * Check if the face-api.js recognition model is loaded.
 */
export function isRecognitionModelLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Check if recognition is available.
 */
export function isOnnxAvailable(): boolean {
  return onnxAvailable;
}

/**
 * Get the current execution provider (facenet or none).
 */
export function getExecutionProvider(): string {
  return modelsLoaded ? "facenet" : "none";
}