import { z } from "zod";
import { ResumeRetrievalService } from "../../retrieval/services/ResumeRetrievalService";
import type { McpSearchResult, McpCandidateResult } from "../types/mcp.types";

export const searchResumesSchema = {
  query: z.string().min(1).describe(
    "Natural-language search query — e.g. 'senior Python developer with RAG and MongoDB experience'"
  ),
  limit: z.number().int().min(1).max(20).optional().default(5).describe(
    "Maximum number of candidates to return (1–20, default 5)"
  ),
  mode: z.enum(["hybrid", "vector", "bm25"]).optional().default("hybrid").describe(
    "Retrieval mode: hybrid (default), vector-only, or BM25-only"
  ),
};

export async function searchResumesTool(
  args: { query: string; limit?: number; mode?: "hybrid" | "vector" | "bm25" }
): Promise<McpSearchResult> {
  const service = new ResumeRetrievalService();
  const response = await service.search(
    args.query,
    undefined,
    args.limit ?? 5,
    args.mode ?? "hybrid"
  );

  const results: McpCandidateResult[] = response.results.map((r) => {
    // Derive matched skills: skills mentioned in the query
    const queryLower = args.query.toLowerCase();
    const matchedSkills = r.skills.filter((s) =>
      queryLower.includes(s.toLowerCase())
    );

    return {
      resumeId: r.resumeId,
      candidateName: r.name ?? null,
      role: r.role ?? null,
      company: r.company ?? null,
      skills: r.skills,
      matchedSkills,
      experience: r.totalExperience ?? null,
      evidence: matchedSkills.length > 0 ? matchedSkills : r.skills.slice(0, 4),
      vectorScore: r.vectorScore ?? null,
      bm25Score: r.keywordScore ?? null,
      rerankScore: r.rerankScore ?? null,
    };
  });

  return {
    query: response.query,
    totalFound: results.length,
    results,
  };
}
