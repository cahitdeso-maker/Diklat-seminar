/**
 * @deprecated Use services from @/services/ instead.
 *
 * This file re-exports from the new modular services for backward compatibility.
 *
 * New architecture (face-api.js):
 * - FaceDetectionService: face-api.js tinyFaceDetector + faceLandmark68Net
 * - FaceQualityService: Face quality validation
 * - FaceRecognitionService: face-api.js faceRecognitionNet (128D FaceNet descriptor)
 * - EmbeddingService: Embedding normalization and serialization
 * - SimilarityService: Euclidean distance comparison (threshold 0.5)
 */

// Re-export from FaceDetectionService
export {
  detectFaces,
  loadFaceLandmarkerModel as loadFaceLandmarker,
  cropFace,
  isModelLoaded,
} from "@/services/FaceDetectionService";

export type { FaceDetectionResult } from "@/services/FaceDetectionService";

// Re-export from FaceQualityService
export {
  validateFaceQuality,
  analyzeImageQuality,
} from "@/services/FaceQualityService";

export type { FaceQuality } from "@/services/FaceQualityService";

// Re-export from FaceRecognitionService
export {
  generateEmbedding,
  generateEmbeddingFromDataUrl,
  loadRecognitionModel,
  isRecognitionModelLoaded,
  getExecutionProvider,
} from "@/services/FaceRecognitionService";

export type { RecognitionResult } from "@/services/FaceRecognitionService";

// Re-export from EmbeddingService
export { EmbeddingService } from "@/services/EmbeddingService";

// Re-export from SimilarityService
export { SimilarityService } from "@/services/SimilarityService";

/**
 * @deprecated Use SimilarityService.cosineSimilarity() instead.
 * Kept for backward compatibility.
 */
export function extractFaceEmbedding(landmarks: Float32Array): number[] {
  console.warn(
    "extractFaceEmbedding() is deprecated. Use FaceRecognitionService.generateEmbedding() instead."
  );
  // Return empty array - the old landmark-based embedding is no longer valid
  return [];
}