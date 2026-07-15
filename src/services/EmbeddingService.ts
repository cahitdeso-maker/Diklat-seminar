/**
 * EmbeddingService
 *
 * Handles embedding normalization, serialization, and deserialization.
 * Embeddings are 128D vectors (FaceNet-based) representing face identity.
 */
export class EmbeddingService {
  /**
   * L2-normalize an embedding vector to unit length.
   * This ensures cosine similarity works correctly.
   */
  static normalize(embedding: number[]): number[] {
    let sumSq = 0;
    for (let i = 0; i < embedding.length; i++) {
      sumSq += embedding[i] * embedding[i];
    }
    const norm = Math.sqrt(sumSq);
    if (norm === 0) return embedding;

    return embedding.map((v) => v / norm);
  }

  /**
   * Serialize embedding to JSON string for database storage.
   */
  static serialize(embedding: number[]): string {
    return JSON.stringify(embedding);
  }

  /**
   * Deserialize embedding from JSON string.
   */
  static deserialize(embeddingStr: string): number[] {
    try {
      const parsed = JSON.parse(embeddingStr);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === "number")) {
        return parsed;
      }
      throw new Error("Invalid embedding format");
    } catch {
      throw new Error("Failed to deserialize embedding");
    }
  }

  /**
   * Validate embedding dimensions.
   * FaceNet (face-api.js) produces 128D embeddings.
   */
  static validate(embedding: number[], expectedDim: number = 128): boolean {
    return (
      Array.isArray(embedding) &&
      embedding.length === expectedDim &&
      embedding.every((v) => typeof v === "number" && !isNaN(v))
    );
  }

  /**
   * Get embedding dimension from model type.
   */
  static getDimension(modelType: "facenet" | "arcface" | "mobilefacenet"): number {
    switch (modelType) {
      case "facenet":
        return 128;
      case "arcface":
        return 512;
      case "mobilefacenet":
        return 128;
      default:
        return 128;
    }
  }
}