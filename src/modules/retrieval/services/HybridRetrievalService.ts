import type {
  BM25SearchResult,
  StoredResume
} from "../types/retrieval.types";

export interface HybridCandidate {
  resume: StoredResume;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
}

export class HybridRetrievalService {
  private readonly vectorWeight = 0.6;
  private readonly keywordWeight = 0.4;

  /**
   * Combines semantic vector similarity with keyword relevance.
   *
   * hybridScore =
   *   60% vector similarity +
   *   40% keyword relevance
   */
  fuse(
    vectorResults: StoredResume[],
    keywordResults: BM25SearchResult[],
    topK: number
  ): HybridCandidate[] {
    const vectorScores = new Map<string, number>();
    const keywordScores = new Map<string, number>();

    const rawVectorScores = vectorResults.map((resume) =>
      Number.isFinite(Number(resume.score)) ? Number(resume.score) : 0
    );

    const normalizedVectorScores = this.normalizeScores(rawVectorScores);

    vectorResults.forEach((resume, index) => {
      const id = this.getResumeId(resume);
      vectorScores.set(id, normalizedVectorScores[index] ?? 0);
    });

    const rawKeywordScores = keywordResults.map((result) =>
      Number.isFinite(result.keywordScore) ? result.keywordScore : 0
    );

    const normalizedKeywordScores = this.normalizeScores(rawKeywordScores);

    keywordResults.forEach((result, index) => {
      const id = this.getResumeId(result.resume);
      keywordScores.set(id, normalizedKeywordScores[index] ?? 0);
    });

    const allIds = new Set<string>([
      ...vectorScores.keys(),
      ...keywordScores.keys()
    ]);

    const candidates = new Map<string, HybridCandidate>();

    for (const id of allIds) {
      const vectorScore = vectorScores.get(id) ?? 0;
      const keywordScore = keywordScores.get(id) ?? 0;

      const resume =
        vectorResults.find((candidate) => this.getResumeId(candidate) === id) ??
        keywordResults.find((candidate) => this.getResumeId(candidate.resume) === id)?.resume;

      if (!resume) {
        continue;
      }

      const hybridScore =
        this.vectorWeight * vectorScore +
        this.keywordWeight * keywordScore;

      candidates.set(id, {
        resume,
        vectorScore: this.sanitizeFiniteNumber(vectorScore),
        keywordScore: this.sanitizeFiniteNumber(keywordScore),
        hybridScore: this.sanitizeFiniteNumber(hybridScore)
      });
    }

    return [...candidates.values()]
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, topK);
  }

  private normalizeScores(scores: number[]): number[] {
    if (scores.length === 0) {
      return [];
    }

    const sanitized = scores.map((score) => this.sanitizeFiniteNumber(score));

    if (sanitized.length === 1) {
      return [sanitized[0] > 0 ? 1 : 0];
    }

    const min = Math.min(...sanitized);
    const max = Math.max(...sanitized);

    if (max <= 0 || min === max) {
      return sanitized.map((score) => (score > 0 ? 1 : 0));
    }

    const range = max - min;

    if (!Number.isFinite(range) || range <= 0) {
      return sanitized.map(() => 0);
    }

    return sanitized.map((score) => {
      const normalized = (score - min) / range;
      return this.sanitizeFiniteNumber(Math.max(0, Math.min(normalized, 1)));
    });
  }

  private sanitizeFiniteNumber(value: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return value;
  }

  private getResumeId(resume: StoredResume): string {
    return String(resume._id ?? "");
  }
}