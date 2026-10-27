import { MetadataFilterService } from "./MetadataFilterService";
import { AtlasVectorFilterService } from "./AtlasVectorFilterService";
import { QueryEmbeddingService } from "./QueryEmbeddingService";
import { GroundedAnswerService } from "./GroundedAnswerService";
import { RerankingService } from "./RerankingService";
import { HybridRetrievalService } from "./HybridRetrievalService";
import { BM25Service } from "./BM25Service";
import { ResumeRetrievalRepository } from "../repositories/ResumeRetrievalRepository";
import {
  normalizeQuery,
  isBlankQuery,
  extractExperienceFromQuery,
  isNonProfessionalQuery,
} from "../utils/queryNormalizer";
import { normalizeResumeFields } from "../../ingestion/services/AlgorithmResumeParser";

import type {
  ResumeMetadataFilter,
  RetrievalResult,
  RetrievalSource,
  RetrievalResponse,
  StoredResume
} from "../types/retrieval.types";

export class ResumeRetrievalService {
  constructor(
    private readonly repository = new ResumeRetrievalRepository(),
    private readonly embeddingService = new QueryEmbeddingService(),
    private readonly filterService = new MetadataFilterService(),
    private readonly atlasFilterService = new AtlasVectorFilterService(),
    private readonly rerankingService = new RerankingService(),
    private readonly hybridService = new HybridRetrievalService(),
    private readonly bm25Service = new BM25Service(),
    private readonly answerService = new GroundedAnswerService()
  ) {}

  /**
   * Pure vector search.
   *
   * This endpoint remains available for testing semantic retrieval
   * independently from hybrid retrieval.
   */
  async searchRaw(
    query: string,
    topK = 5
  ): Promise<{
    success: boolean;
    query: string;
    results: RetrievalResult[];
  }> {
    if (isBlankQuery(query)) {
      throw Object.assign(new Error("Search query is required"), {
        statusCode: 400,
        errorCode: "QUERY_REQUIRED"
      });
    }

    const normalizedQuery = normalizeQuery(query);

    const queryEmbedding =
      await this.embeddingService.embedText(normalizedQuery);

    const rawResults =
      await this.repository.findByVector(
        queryEmbedding,
        topK
      );

    const results: RetrievalResult[] = rawResults.map((resume) => {
      const fields = normalizeResumeFields(resume);

      return {
        resumeId: String(resume._id ?? ""),
        name: fields.name,
        address: fields.address,
        email: fields.email,
        phone: fields.phone,
        role: fields.role,
        company: resume.company,
        skills: resume.skills ?? [],
        totalExperience: resume.totalExperience,

        vectorScore: Number(
          (resume as any).score ?? 0
        ),

        rerankScore: Number((resume as any).score ?? 0)
      };
    });

    return {
      success: true,
      query: normalizedQuery,
      results
    };
  }

  /**
   * Hybrid retrieval.
   *
   * Combines:
   *
   * 1. Semantic vector retrieval
   * 2. BM25 keyword retrieval
   * 3. Hybrid score fusion
   * 4. Existing business-aware reranking
   * 5. Grounded answer generation
   */
  async search(
    query: string,
    filters?: ResumeMetadataFilter,
    topK = 5,
    mode: "hybrid" | "vector" | "bm25" = "hybrid"
  ): Promise<RetrievalResponse> {
    if (isBlankQuery(query)) {
      throw Object.assign(new Error("Search query is required"), {
        statusCode: 400,
        errorCode: "QUERY_REQUIRED"
      });
    }

    const totalStart = performance.now();
    let effectiveMode: "hybrid" | "vector" | "bm25" = mode;
    let degradedReason: string | undefined;

    const queryNormalizationStart = performance.now();
    const normalizedQuery = normalizeQuery(query);
    const queryNormalizationMs = performance.now() - queryNormalizationStart;

    // ── Gate 1: non-professional query ──────────────────────────────────────
    // If the query contains no professional or technical signal at all
    // (e.g. "experience in love", "find someone who is happy"), skip the
    // entire retrieval pipeline and return a clear explanation immediately.
    if (isNonProfessionalQuery(normalizedQuery)) {
      const answer = await this.answerService.buildAnswer(
        normalizedQuery,
        [],
        { nonProfessionalQuery: true }
      );
      return {
        success: true,
        query: normalizedQuery,
        answer,
        results: [],
        sources: [],
        timings: {
          queryNormalizationMs: Number((performance.now() - totalStart).toFixed(2)),
          embeddingMs: 0,
          vectorSearchMs: 0,
          keywordSearchMs: 0,
          hybridFusionMs: 0,
          metadataFilterMs: 0,
          rerankingMs: 0,
          answerGenerationMs: 0,
          totalMs: Number((performance.now() - totalStart).toFixed(2)),
        },
        metadata: { retrievalMode: mode, degraded: false, state: "no_relevant_results", candidateCounts: { vector: 0, bm25: 0, merged: 0, final: 0 } },
      };
    }

    const metadataFilterStart = performance.now();
    const mongoFilter = this.filterService.buildMongoFilter(filters);
    const atlasFilter = this.atlasFilterService.buildFilter(filters);
    const metadataFilterMs = performance.now() - metadataFilterStart;

    let embeddingMs = 0;
    let vectorSearchMs = 0;
    let vectorResults: StoredResume[] = [];
    if (mode !== "bm25") {
      const embeddingStart = performance.now();
      try {
        const queryEmbedding = await this.embeddingService.embedText(normalizedQuery);
        embeddingMs = performance.now() - embeddingStart;
        const vectorSearchStart = performance.now();
        if (Object.keys(atlasFilter).length > 0) {
          try {
            vectorResults = await this.repository.findByVectorWithFilter(queryEmbedding, atlasFilter, Math.max(topK * 10, 50));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes("needs to be indexed as filter")) throw error;
            vectorResults = await this.repository.findByVector(queryEmbedding, Math.max(topK * 10, 50));
          }
        } else {
          vectorResults = await this.repository.findByVector(queryEmbedding, Math.max(topK * 2, 10));
        }
        vectorResults = this.applyMetadataFilter(vectorResults, filters);
        vectorSearchMs = performance.now() - vectorSearchStart;
      } catch (error) {
        if (mode !== "hybrid") throw error;
        effectiveMode = "bm25";
        degradedReason = "Vector retrieval unavailable";
      }
    }

    const keywordSearchStart = performance.now();
    let keywordCorpus = await this.repository.findAllForKeywordSearch();

    if (Object.keys(mongoFilter).length > 0) {
      keywordCorpus = this.applyMetadataFilter(keywordCorpus, filters);
    }

    let keywordResults: import("../types/retrieval.types").BM25SearchResult[] = [];
    try {
      keywordResults = this.bm25Service.search(normalizedQuery, keywordCorpus, Math.max(topK * 2, 10));
    } catch (error) {
      if (mode !== "hybrid" || vectorResults.length === 0) throw error;
      effectiveMode = "vector";
      degradedReason = "BM25 retrieval unavailable";
    }
    const keywordSearchMs = performance.now() - keywordSearchStart;

    const hybridFusionStart = performance.now();
    const candidateLimit = Math.max(topK * 2, 10);
    const hybridCandidates = effectiveMode === "vector"
      ? vectorResults.slice(0, candidateLimit).map((resume) => ({
        resume,
        vectorScore: Number(resume.score ?? 0),
        keywordScore: 0,
        hybridScore: Number(resume.score ?? 0),
      }))
      : effectiveMode === "bm25"
        ? keywordResults.slice(0, candidateLimit).map((result) => ({
          resume: result.resume,
          vectorScore: 0,
          keywordScore: result.keywordScore,
          hybridScore: result.keywordScore,
        }))
        : this.hybridService.fuse(
          vectorResults,
          keywordResults,
          candidateLimit
        );
    const hybridFusionMs = performance.now() - hybridFusionStart;

    const rerankingStart = performance.now();
    const scoredResults: RetrievalResult[] = hybridCandidates.map((candidate) => {
      const resume = candidate.resume;
      const fields = normalizeResumeFields(resume);

      const skillMatchScore = this.calculateSkillMatchScore(
        resume.skills ?? [],
        normalizedQuery
      );

      const experienceScore = resume.totalExperience
        ? Math.min(resume.totalExperience / 10, 1)
        : 0;

      const roleScore = this.calculateRoleScore(fields.role, normalizedQuery);

      const rerankScore = this.rerankingService.rerank({
        vectorScore: candidate.hybridScore,
        skillMatchScore,
        experienceScore,
        roleScore
      });

      return {
        resumeId: String(resume._id ?? ""),
        name: fields.name,
        address: fields.address,
        email: fields.email,
        phone: fields.phone,
        role: fields.role,
        company: resume.company,
        skills: resume.skills ?? [],
        totalExperience: resume.totalExperience,

        vectorScore: candidate.vectorScore,
        keywordScore: candidate.keywordScore,
        hybridScore: candidate.hybridScore,

        rerankScore
      };
    });

    // ── Gate 2: zero lexical grounding ─────────────────────────────────────
    // Mistral embeddings score high (0.8+) for most queries — the raw vector
    // score threshold is not reliable. Instead we check lexical grounding:
    // if BM25 found zero matches AND none of the query's meaningful tokens
    // appear in any retrieved candidate's skills, role, or experience summary,
    // the retrieval has no textual evidence and the query is irrelevant to the
    // database contents.
    const sortedResults = [...scoredResults]
      .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
      .slice(0, topK);
    const rerankingMs = performance.now() - rerankingStart;

    const hasLexicalGrounding = this.hasLexicalGrounding(
      normalizedQuery,
      keywordResults,
      scoredResults
    );

    if (!hasLexicalGrounding) {
      const answer = await this.answerService.buildAnswer(
        normalizedQuery,
        [],
        { belowRelevanceThreshold: true }
      );
      return {
        success: true,
        query: normalizedQuery,
        answer,
        results: [],
        sources: [],
        timings: {
          queryNormalizationMs: Number(queryNormalizationMs.toFixed(2)),
          embeddingMs: Number(embeddingMs.toFixed(2)),
          vectorSearchMs: Number(vectorSearchMs.toFixed(2)),
          keywordSearchMs: Number(keywordSearchMs.toFixed(2)),
          hybridFusionMs: Number(hybridFusionMs.toFixed(2)),
          metadataFilterMs: Number(metadataFilterMs.toFixed(2)),
          rerankingMs: Number(rerankingMs.toFixed(2)),
          answerGenerationMs: 0,
          totalMs: Number((performance.now() - totalStart).toFixed(2)),
        },
      };
    }
    // Extract any minimum-experience requirement from the natural-language
    // query. If one exists AND the explicit filters don't already enforce it,
    // apply it now to the ranked results.
    //
    // This ensures that a query like "Find candidates with 10+ years of Python
    // experience" returns an empty result set (with a clear LLM answer) instead
    // of silently returning whoever ranked highest regardless of experience.
    const queryMinExp =
      filters?.minimumExperience != null
        ? null // already enforced by the metadata filter — don't double-apply
        : extractExperienceFromQuery(normalizedQuery);

    const experienceFilteredResults =
      queryMinExp != null && queryMinExp > 0
        ? sortedResults.filter(
            (r) =>
              r.totalExperience != null &&
              r.totalExperience >= queryMinExp
          )
        : sortedResults;

    // When the experience guard removed every result, find the highest
    // available experience so the LLM answer can give useful context.
    const maxAvailableExperience =
      queryMinExp != null &&
      queryMinExp > 0 &&
      experienceFilteredResults.length === 0
        ? Math.max(
            0,
            ...scoredResults
              .map((r) => r.totalExperience ?? 0)
              .filter((v) => v > 0)
          ) || null
        : null;

    const answerEvidence = experienceFilteredResults.map((result) => {
      const source = hybridCandidates.find(
        (candidate) => String(candidate.resume._id ?? "") === result.resumeId
      );

      return {
        ...result,
        rawText: source?.resume.rawText ?? null,
      };
    });

    const answerGenerationStart = performance.now();
    const answer = await this.answerService.buildAnswer(
      normalizedQuery,
      answerEvidence,
      {
        requiredMinExperience: queryMinExp,
        maxAvailableExperience,
      }
    );
    const answerGenerationMs = performance.now() - answerGenerationStart;

    const sources: RetrievalSource[] = experienceFilteredResults
      .filter((candidate, index, self) =>
        index === self.findIndex((other) => other.resumeId === candidate.resumeId)
      )
      .map((candidate) => ({
        resumeId: candidate.resumeId,
        name: candidate.name,
        score: candidate.rerankScore,
        evidence: [candidate.role, candidate.company, ...candidate.skills].filter((item): item is string => Boolean(item))
      }));

    if (process.env.NODE_ENV === "development") {
      const vectorDebug = vectorResults.map((resume) => ({
        id: String(resume._id ?? ""),
        score: Number.isFinite(Number(resume.score)) ? Number(resume.score) : 0
      }));

      const keywordDebug = keywordResults.map((result) => ({
        id: String(result.resume._id ?? ""),
        keywordScore: Number.isFinite(result.keywordScore) ? result.keywordScore : 0
      }));

      const hybridDebug = hybridCandidates.map((candidate) => ({
        id: String(candidate.resume._id ?? ""),
        vectorScore: candidate.vectorScore,
        keywordScore: candidate.keywordScore,
        hybridScore: candidate.hybridScore
      }));

      const rerankDebug = experienceFilteredResults.map((candidate) => ({
        id: candidate.resumeId,
        hybridScore: candidate.hybridScore ?? 0,
        rerankScore: candidate.rerankScore ?? 0
      }));

      console.debug("[VECTOR RESULTS]", vectorDebug);
      console.debug("[BM25 RESULTS]", keywordDebug);
      console.debug("[HYBRID RESULTS]", hybridDebug);
      console.debug("[FINAL RERANK]", rerankDebug);
    }

    return {
      success: true,
      query: normalizedQuery,
      answer,
      results: experienceFilteredResults,
      sources,
      timings: {
        queryNormalizationMs: Number(queryNormalizationMs.toFixed(2)),
        embeddingMs: Number(embeddingMs.toFixed(2)),
        vectorSearchMs: Number(vectorSearchMs.toFixed(2)),
        keywordSearchMs: Number(keywordSearchMs.toFixed(2)),
        hybridFusionMs: Number(hybridFusionMs.toFixed(2)),
        metadataFilterMs: Number(metadataFilterMs.toFixed(2)),
        rerankingMs: Number(rerankingMs.toFixed(2)),
        answerGenerationMs: Number(answerGenerationMs.toFixed(2)),
        totalMs: Number((performance.now() - totalStart).toFixed(2))
      }
    };
  }

  /**
   * Returns true when the query has meaningful lexical grounding in the
   * retrieved results — meaning at least one non-trivial query token
   * (skill, technology, role, or domain keyword) appears in either:
   *   a) the BM25 keyword results for that specific token, OR
   *   b) any candidate's skills, role, or experience summary.
   *
   * Generic words like "experience", "candidate", "find", etc. are excluded
   * from consideration — a BM25 hit on "experience" alone is not grounding.
   *
   * A query like "experience in love" has no non-trivial tokens that match
   * anything in the resume database → returns false → results suppressed.
   */
  private hasLexicalGrounding(
    query: string,
    keywordResults: import("../types/retrieval.types").BM25SearchResult[],
    scoredResults: RetrievalResult[]
  ): boolean {
    // These words are so common in resumes that a BM25/text match on them
    // alone carries no meaningful signal about query relevance.
    const NOISE_TOKENS = new Set([
      "find", "a", "an", "the", "with", "for", "in", "of", "and", "or",
      "who", "has", "have", "that", "is", "are", "was", "be", "been",
      "experience", "experienced", "candidate", "candidates", "someone",
      "person", "people", "looking", "need", "want", "require", "skilled",
      "skill", "strong", "good", "great", "excellent", "proficient",
      "knowledge", "background", "professional", "work", "working",
      "years", "yrs", "months", "senior", "junior", "lead", "job", "role",
    ]);

    // Extract the meaningful (non-noise) tokens from the query
    const meaningfulTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s.#+]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !NOISE_TOKENS.has(t));

    // If the query has no meaningful tokens at all, no grounding is possible
    if (meaningfulTokens.length === 0) {
      return false;
    }

    // Check whether any meaningful token appears in candidates' structured fields
    for (const result of scoredResults) {
      const haystack = [
        ...(result.skills ?? []),
        result.role ?? "",
        result.company ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (meaningfulTokens.some((token) => haystack.includes(token))) {
        return true;
      }
    }

    // Check whether any meaningful token drove a BM25 result
    // (i.e. the token exists in resume text, not just the generic BM25 match)
    if (keywordResults.length > 0) {
      for (const kResult of keywordResults) {
        const docText = [
          ...(kResult.resume.skills ?? []),
          kResult.resume.role ?? "",
          kResult.resume.company ?? "",
          kResult.resume.experienceSummary ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (meaningfulTokens.some((token) => docText.includes(token))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculates how strongly the query matches the
   * candidate's skills.
   */
  private calculateSkillMatchScore(
    skills: string[],
    query: string
  ): number {
    if (skills.length === 0) {
      return 0;
    }

    const normalizedQuery =
      query.toLowerCase();

    const matchedSkills =
      skills.filter((skill) =>
        normalizedQuery.includes(
          skill.toLowerCase()
        )
      );

    if (matchedSkills.length === 0) {
      return 0;
    }

    return Math.min(
      matchedSkills.length / 3,
      1
    );
  }

  /**
   * Calculates whether the candidate's role
   * appears relevant to the query.
   */
  private calculateRoleScore(
    role: string | null | undefined,
    query: string
  ): number {
    if (!role) {
      return 0;
    }

    const normalizedRole =
      role.toLowerCase();

    const normalizedQuery =
      query.toLowerCase();

    if (
      normalizedQuery.includes(
        normalizedRole
      )
    ) {
      return 1;
    }

    const roleTokens =
      normalizedRole
        .split(/\s+/)
        .filter(Boolean);

    const matchedTokens =
      roleTokens.filter((token) =>
        normalizedQuery.includes(token)
      );

    if (matchedTokens.length === 0) {
      return 0;
    }

    return Math.min(
      matchedTokens.length /
        Math.max(roleTokens.length, 1),
      1
    );
  }

  /**
   * Applies the same metadata concepts to the local
   * BM25 corpus.
   *
   * MongoDB metadata filtering and local BM25 need
   * equivalent filtering behaviour.
   */
  private applyMetadataFilter(
    resumes: import("../types/retrieval.types").StoredResume[],
    filters?: ResumeMetadataFilter
  ): import("../types/retrieval.types").StoredResume[] {
    if (!filters) {
      return resumes;
    }

    return resumes.filter((resume) => {
      // Skills
      if (
        filters.skills &&
        filters.skills.length > 0
      ) {
        const candidateSkills =
          (resume.skills ?? []).map((skill) =>
            skill.toLowerCase().trim()
          );

        const requiredSkills =
          filters.skills
            .map((skill) =>
              skill.toLowerCase().trim()
            )
            .filter(Boolean);

        const hasAllSkills =
          requiredSkills.every((skill) =>
            candidateSkills.includes(skill)
          );

        if (!hasAllSkills) {
          return false;
        }
      }

      // Minimum experience
      if (
        filters.minimumExperience !==
          undefined &&
        filters.minimumExperience !== null
      ) {
        if (
          resume.totalExperience ===
            undefined ||
          resume.totalExperience === null ||
          resume.totalExperience <
            filters.minimumExperience
        ) {
          return false;
        }
      }

      // Maximum experience
      if (
        filters.maximumExperience !==
          undefined &&
        filters.maximumExperience !== null
      ) {
        if (
          resume.totalExperience ===
            undefined ||
          resume.totalExperience === null ||
          resume.totalExperience >
            filters.maximumExperience
        ) {
          return false;
        }
      }

      // Roles
      if (
        filters.roles &&
        filters.roles.length > 0
      ) {
        const allowedRoles =
          filters.roles.map((role) =>
            role.toLowerCase().trim()
          );

        const candidateRole =
          resume.role?.toLowerCase().trim();

        if (
          !candidateRole ||
          !allowedRoles.includes(candidateRole)
        ) {
          return false;
        }
      }

      // Companies
      if (
        filters.companies &&
        filters.companies.length > 0
      ) {
        const allowedCompanies =
          filters.companies.map((company) =>
            company.toLowerCase().trim()
          );

        const candidateCompany =
          resume.company?.toLowerCase().trim();

        if (
          !candidateCompany ||
          !allowedCompanies.includes(
            candidateCompany
          )
        ) {
          return false;
        }
      }

      // Locations
      if (
        filters.locations &&
        filters.locations.length > 0
      ) {
        const allowedLocations =
          filters.locations.map((location) =>
            location.toLowerCase().trim()
          );

        const candidateLocation =
          resume.location?.toLowerCase().trim();

        if (
          !candidateLocation ||
          !allowedLocations.includes(
            candidateLocation
          )
        ) {
          return false;
        }
      }

      // Education
      if (filters.education) {
        const education =
          resume.education?.toLowerCase() ?? "";

        if (
          !education.includes(
            filters.education.toLowerCase().trim()
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }
}
