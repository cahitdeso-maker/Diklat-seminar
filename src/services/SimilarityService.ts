/**
 * SimilarityService
 *
 * Computes similarity between face embeddings using cosine similarity.
 * Manages similarity threshold configuration.
 */
export class SimilarityService {
  private static readonly DEFAULT_THRESHOLD = 0.90;

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
   * Compare two embeddings and return match result.
   */
  static compare(
    registeredEmbedding: number[],
    capturedEmbedding: number[],
    threshold: number = SimilarityService.DEFAULT_THRESHOLD
  ): { match: boolean; similarity: number; distance: number } {
    const similarity = this.cosineSimilarity(
      registeredEmbedding,
      capturedEmbedding
    );
    const distance = this.euclideanDistance(
      registeredEmbedding,
      capturedEmbedding
    );

    return {
      match: similarity >= threshold,
      similarity: Math.round(similarity * 10000) / 10000,
      distance: Math.round(distance * 10000) / 10000,
    };
  }

  /**
   * Get the default similarity threshold.
   */
  static getDefaultThreshold(): number {
    return this.DEFAULT_THRESHOLD;
  }

  /**
   * Find the best match from a list of registered embeddings.
   */
  static findBestMatch(
    capturedEmbedding: number[],
    registeredEmbeddings: Array<{ id: string; embedding: number[] }>,
    threshold: number = SimilarityService.DEFAULT_THRESHOLD
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

    // Sort by similarity descending
    allMatches.sort((a, b) => b.similarity - a.similarity);

    const bestMatch =
      allMatches.length > 0 && allMatches[0].similarity >= threshold
        ? allMatches[0]
        : null;

    return { bestMatch, allMatches };
  }
}