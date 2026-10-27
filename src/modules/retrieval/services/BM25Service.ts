import type {
  BM25SearchResult,
  StoredResume
} from "../types/retrieval.types";

interface BM25Document {
  resume: StoredResume;
  tokens: string[];
}

export class BM25Service {
  private readonly k1 = 1.5;
  private readonly b = 0.75;

  search(
    query: string,
    resumes: StoredResume[],
    topK: number
  ): BM25SearchResult[] {
    if (!query.trim() || resumes.length === 0) {
      return [];
    }

    const documents: BM25Document[] = resumes.map((resume) => ({
      resume,
      tokens: this.tokenize(this.buildDocument(resume))
    }));

    const queryTokens = this.tokenize(query);

    if (queryTokens.length === 0) {
      return [];
    }

    const documentLengths = documents.map(
      (document) => document.tokens.length
    );

    const averageDocumentLength =
      documentLengths.reduce((sum, length) => sum + length, 0) /
      Math.max(documentLengths.length, 1);

    const documentFrequency = new Map<string, number>();

    for (const document of documents) {
      const uniqueTokens = new Set(document.tokens);

      for (const token of uniqueTokens) {
        documentFrequency.set(
          token,
          (documentFrequency.get(token) ?? 0) + 1
        );
      }
    }

    const totalDocuments = documents.length;

    const scored: BM25SearchResult[] = documents.map((document, index) => {
      const termFrequency = new Map<string, number>();

      for (const token of document.tokens) {
        termFrequency.set(
          token,
          (termFrequency.get(token) ?? 0) + 1
        );
      }

      const documentLength = documentLengths[index];

      let score = 0;

      for (const token of queryTokens) {
        const tf = termFrequency.get(token) ?? 0;

        if (tf === 0) {
          continue;
        }

        const df = documentFrequency.get(token) ?? 0;

        const idf = Math.log(
          1 +
            (totalDocuments - df + 0.5) /
              (df + 0.5)
        );

        const denominator =
          tf +
          this.k1 *
            (1 -
              this.b +
              this.b *
                (documentLength /
                  Math.max(averageDocumentLength, 1)));

        score +=
          idf *
          ((tf * (this.k1 + 1)) / denominator);
      }

      return {
        resume: document.resume,
        keywordScore: Number.isFinite(score) ? score : 0
      };
    });

    return scored
      .filter((result) => Number.isFinite(result.keywordScore) && result.keywordScore > 0)
      .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, topK);
  }

  private buildDocument(resume: StoredResume): string {
    return [
      resume.name,
      resume.role,
      resume.company,
      resume.location,
      resume.education,
      resume.experienceSummary,
      resume.skills?.join(" "),
      resume.jobTitles?.join(" "),
      resume.rawText
    ]
      .filter(Boolean)
      .join(" ");
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}+#.-]+/gu, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
  }
}