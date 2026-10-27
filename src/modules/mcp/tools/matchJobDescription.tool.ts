import { z } from "zod";
import { ResumeRetrievalService } from "../../retrieval/services/ResumeRetrievalService";
import { detectSkills } from "../../ingestion/services/AlgorithmResumeParser";
import type { McpJobMatchResult } from "../types/mcp.types";

export const matchJobDescriptionSchema = {
  jobDescription: z.string().min(10).describe(
    "The full job description or requirements text to match candidates against"
  ),
  limit: z.number().int().min(1).max(20).optional().default(5).describe(
    "Maximum number of matching candidates to return (1–20, default 5)"
  ),
};

export async function matchJobDescriptionTool(
  args: { jobDescription: string; limit?: number }
): Promise<McpJobMatchResult> {
  const service = new ResumeRetrievalService();

  // Extract required skills from the job description using the existing skill detector
  const requiredSkills = detectSkills(args.jobDescription);

  const response = await service.search(
    args.jobDescription,
    requiredSkills.length > 0 ? undefined : undefined, // let the full pipeline decide
    args.limit ?? 5,
    "hybrid"
  );

  const matches = response.results.map((r) => {
    const candidateSkillsLower = r.skills.map((s) => s.toLowerCase());

    const matchedRequirements = requiredSkills.filter((req) =>
      candidateSkillsLower.includes(req.toLowerCase())
    );

    const missingRequirements = requiredSkills.filter((req) =>
      !candidateSkillsLower.includes(req.toLowerCase())
    );

    const matchScore =
      requiredSkills.length > 0
        ? Math.round((matchedRequirements.length / requiredSkills.length) * 100)
        : 0;

    return {
      resumeId: r.resumeId,
      candidateName: r.name ?? null,
      role: r.role ?? null,
      matchedRequirements,
      missingRequirements,
      matchScore,
      rerankScore: r.rerankScore ?? null,
    };
  });

  // Sort by matchScore desc, then rerankScore desc
  matches.sort((a, b) =>
    b.matchScore !== a.matchScore
      ? b.matchScore - a.matchScore
      : (b.rerankScore ?? 0) - (a.rerankScore ?? 0)
  );

  return {
    jobDescription: args.jobDescription,
    totalMatched: matches.length,
    matches,
  };
}
