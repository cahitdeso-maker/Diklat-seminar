/**
 * SimilarityService
 *
 * Computes similarity between face descriptors using Euclidean distance.
 * Manages similarity threshold configuration.
 *
 * As per PRD:
 * - distance < 0.5 → same person (match)
 * - distance 0.5-0.6 → possible match
 * - distance > 0.6 → different person
 */
export class SimilarityService {
  /** Euclidean distance threshold for face matching */
  private static readonly DEFAULT_EUCLIDEAN_THRESHOLD = 0.5;

  /**
   * Compute cosine similarity between two embedding vectors.
   * Returns value between 0 and 1.
   */
  static cosineSimilarity(embeddingA: number[], embeddingB: number[]): number {
    if (embeddingA.length !== embeddingB.length) {
      throw new Error(
        `Embedding dimensions must match: ${embeddingA.length} vs ${embeddingB.length}`
      );
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embeddingA.length; i++) {
      dotProduct += embeddingA[i] * embeddingB[i];
      normA += embeddingA[i] * embeddingA[i];
      normB += embeddingB[i] * embeddingB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude === 0) return 0;

    return dotProduct / magnitude;
  }

  /**
   * Compute Euclidean distance between two embeddings.
   * Lower values = more similar.
   * This is the PRIMARY comparison method as per PRD.
   *
   * For face-api.js FaceNet descriptors:
   * - distance < 0.5 → same person
   * - distance 0.5-0.6 → possible match
   * - distance > 0.6 → different person
   */
  static euclideanDistance(embeddingA: number[], embeddingB: number[]): number {
    if (embeddingA.length !== embeddingB.length) {
      throw new Error("Embedding dimensions must match");
    }

    let sumSq = 0;
    for (let i = 0; i < embeddingA.length; i++) {
      const diff = embeddingA[i] - embeddingB[i];
      sumSq += diff * diff;
    }
    return Math.sqrt(sumSq);
  }

  /**
   * Compare two embeddings using Euclidean distance (PRD-recommended method).
   * Returns match result with similarity score and distance.
   *
   * @param registeredEmbedding - stored face descriptor
   * @param capturedEmbedding - captured face descriptor
   * @param threshold - Euclidean distance threshold (default: 0.5)
   */
  static compare(
    registeredEmbedding: number[],
    capturedEmbedding: number[],
    threshold: number = SimilarityService.DEFAULT_EUCLIDEAN_THRESHOLD
  ): { match: boolean; similarity: number; distance: number } {
    // Use Euclidean distance as primary comparison (per PRD)
    const distance = this.euclideanDistance(
      registeredEmbedding,
      capturedEmbedding
    );

    // Convert distance to similarity percentage for display:
    // distance 0.0 = 100%, distance 0.5 = 50%, distance 1.0 = 0%
    const similarity = Math.max(0, Math.round((1 - distance) * 10000) / 10000);

    return {
      match: distance < threshold,
      similarity,
      distance: Math.round(distance * 10000) / 10000,
    };
  }

  /**
   * Get the default Euclidean distance threshold.
   */
  static getDefaultThreshold(): number {
    return this.DEFAULT_EUCLIDEAN_THRESHOLD;
  }

  /**
   * Find the best match from a list of registered embeddings using Euclidean distance.
   */
  static findBestMatch(
    capturedEmbedding: number[],
    registeredEmbeddings: Array<{ id: string; embedding: number[] }>,
    threshold: number = SimilarityService.DEFAULT_EUCLIDEAN_THRESHOLD
  ): {
    bestMatch: { id: string; similarity: number; distance: number } | null;
    allMatches: Array<{ id: string; similarity: number; distance: number }>;
  } {
    const allMatches = registeredEmbeddings.map((reg) => {
      const { similarity, distance } = this.compare(
        reg.embedding,
        capturedEmbedding,
        threshold
      );
      return { id: reg.id, similarity, distance };
    });

    // Sort by distance ascending (lower distance = better match)
    allMatches.sort((a, b) => a.distance - b.distance);

    const bestMatch =
      allMatches.length > 0 && allMatches[0].distance < threshold
        ? allMatches[0]
        : null;

    return { bestMatch, allMatches };
  }
}