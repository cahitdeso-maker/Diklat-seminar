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
import * as ort from "onnxruntime-web";

// ArcFace ONNX model path
const MODEL_URL = "/models/arcface.onnx";

let session: ort.InferenceSession | null = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;
let currentProvider: string = "none";
let onnxAvailable = false;

export interface RecognitionResult {
  success: boolean;
  embedding: number[];
  inferenceTime: number;
  method: "onnx";
}

function debugLog(...args: unknown[]): void {
  if (process.env.NODE_ENV === "development") {
    console.log("[FaceRecognition]", ...args);
  }
}

/**
 * Try to create an ONNX session from a given URL.
 */
async function tryCreateSession(
  modelUrl: string,
  executionProvider: "webgl" | "wasm"
): Promise<ort.InferenceSession | null> {
  try {
    const sess = await ort.InferenceSession.create(modelUrl, {
      executionProviders: [executionProvider],
      graphOptimizationLevel: "all",
    });
    return sess;
  } catch {
    return null;
  }
}

/**
 * Load the ArcFace ONNX model.
 * If the model file is not available, recognition will not be possible.
 * Uses singleton pattern - only loads once.
 */
export async function loadRecognitionModel(): Promise<void> {
  if (session) return;
  if (isLoading && loadPromise) return loadPromise;

  isLoading = true;

  loadPromise = (async () => {
    try {
      let executionProvider: "webgl" | "wasm" = "webgl";
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl");
      if (!gl) {
        executionProvider = "wasm";
      }

      // Try to load ArcFace ONNX model
      session = await tryCreateSession(MODEL_URL, executionProvider);
      if (session) {
        currentProvider = executionProvider;
        onnxAvailable = true;
        debugLog(`ArcFace ONNX model loaded (${executionProvider})`);
        isLoading = false;
        return;
      }

      // Try CPU fallback
      if (executionProvider === "webgl") {
        executionProvider = "wasm";
        session = await tryCreateSession(MODEL_URL, executionProvider);
        if (session) {
          currentProvider = executionProvider;
          onnxAvailable = true;
          debugLog("ArcFace ONNX model loaded (CPU/WASM)");
          isLoading = false;
          return;
        }
      }

      // ONNX model not available
      console.warn(
        "[FaceRecognition] ONNX model not available at", MODEL_URL,
        ". Recognition will not be possible. Download model to public/models/arcface.onnx"
      );
      onnxAvailable = false;
    } catch (error) {
      console.error("[FaceRecognition] Failed to load ONNX model:", error);
      onnxAvailable = false;
    }

    isLoading = false;
  })();

  return loadPromise;
}

/**
 * Generate a face embedding from a cropped face canvas.
 * This is the ONLY way to generate embeddings - landmarks are NOT used for recognition.
 *
 * @param croppedFace - Canvas element containing the cropped face from FaceDetectionService.cropFace()
 * @returns RecognitionResult with embedding and inference time
 */
export async function generateEmbedding(
  croppedFace: HTMLCanvasElement
): Promise<RecognitionResult> {
  await loadRecognitionModel();

  if (!session || !onnxAvailable) {
    throw new Error(
      "Model pengenalan wajah tidak tersedia. " +
      "Silakan hubungi administrator untuk mengunduh model ke /models/arcface.onnx"
    );
  }

  const startTime = performance.now();

  // Preprocess face image
  const inputTensor = preprocessFace(croppedFace);

  // Create ONNX tensor
  const tensor = new ort.Tensor("float32", inputTensor, [1, 3, 112, 112]);

  // Run inference
  const feeds: Record<string, ort.Tensor> = {};
  const inputNames = session.inputNames;
  feeds[inputNames[0]] = tensor;

  const results = await session.run(feeds);

  // Get output embedding
  const outputName = session.outputNames[0];
  const outputTensor = results[outputName];
  const outputData = outputTensor.data as Float32Array;

  // Convert to number array
  const embedding = Array.from(outputData);

  const inferenceTime = Math.round(performance.now() - startTime);

  debugLog("embedding generated", {
    dim: embedding.length,
    inferenceTime: `${inferenceTime}ms`,
  });

  return {
    success: true,
    embedding,
    inferenceTime,
    method: "onnx",
  };
}

/**
 * Preprocess a face image for the recognition model.
 * Steps:
 * 1. Resize to 112x112 (ArcFace input size)
 * 2. Convert to RGB
 * 3. Normalize pixels to [-1, 1]
 * 4. Return as Float32Array in NCHW format
 */
function preprocessFace(
  imageSource: HTMLCanvasElement
): Float32Array {
  const inputSize = 112;

  const canvas = document.createElement("canvas");
  canvas.width = inputSize;
  canvas.height = inputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Gagal menginisialisasi canvas preprocessing");

  ctx.drawImage(imageSource, 0, 0, inputSize, inputSize);

  const imageData = ctx.getImageData(0, 0, inputSize, inputSize);
  const pixels = imageData.data;

  const float32Data = new Float32Array(1 * 3 * inputSize * inputSize);

  for (let y = 0; y < inputSize; y++) {
    for (let x = 0; x < inputSize; x++) {
      const pixelIndex = (y * inputSize + x) * 4;
      const r = pixels[pixelIndex] / 255.0;
      const g = pixels[pixelIndex + 1] / 255.0;
      const b = pixels[pixelIndex + 2] / 255.0;

      const chwIndexR = 0 * inputSize * inputSize + y * inputSize + x;
      const chwIndexG = 1 * inputSize * inputSize + y * inputSize + x;
      const chwIndexB = 2 * inputSize * inputSize + y * inputSize + x;

      float32Data[chwIndexR] = (r - 0.5) / 0.5;
      float32Data[chwIndexG] = (g - 0.5) / 0.5;
      float32Data[chwIndexB] = (b - 0.5) / 0.5;
    }
  }

  return float32Data;
}

/**
 * Generate embedding from a base64 data URL.
 * Requires ONNX model to be available.
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
 * Check if the ONNX recognition model is loaded.
 */
export function isRecognitionModelLoaded(): boolean {
  return session !== null && onnxAvailable;
}

/**
 * Check if ONNX model is available.
 */
export function isOnnxAvailable(): boolean {
  return onnxAvailable;
}

/**
 * Get the current execution provider (webgl, wasm, or none).
 */
export function getExecutionProvider(): string {
  return currentProvider;
}