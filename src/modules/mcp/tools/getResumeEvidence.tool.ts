import { z } from "zod";
import { ResumeRetrievalService } from "../../retrieval/services/ResumeRetrievalService";
import type { McpResumeEvidenceResult } from "../types/mcp.types";

export const getResumeEvidenceSchema = {
  resumeId: z.string().min(1).describe(
    "The MongoDB ObjectId of the candidate's resume"
  ),
  query: z.string().min(1).describe(
    "The search query or job requirement to find evidence for — e.g. 'Python RAG MongoDB'"
  ),
};

export async function getResumeEvidenceTool(
  args: { resumeId: string; query: string }
): Promise<McpResumeEvidenceResult> {
  const service = new ResumeRetrievalService();

  // Run the hybrid search and find this specific candidate in the results.
  // Using a generous topK so the candidate is likely to appear.
  const response = await service.search(args.query, undefined, 20, "hybrid");

  const match = response.results.find((r) => r.resumeId === args.resumeId);

  if (!match) {
    // Candidate exists but didn't rank in the top 20 for this query —
    // return what we know with an empty evidence list.
    return {
      resumeId: args.resumeId,
      candidateName: null,
      query: args.query,
      evidence: [],
      skills: [],
      role: null,
      rerankScore: null,
    };
  }

  const queryLower = args.query.toLowerCase();
  const matchedSkills = match.skills.filter((s) =>
    queryLower.includes(s.toLowerCase())
  );

  const evidence =
    matchedSkills.length > 0
      ? matchedSkills
      : match.skills.slice(0, 5);

  return {
    resumeId: args.resumeId,
    candidateName: match.name ?? null,
    query: args.query,
    evidence,
    skills: match.skills,
    role: match.role ?? null,
    rerankScore: match.rerankScore ?? null,
  };
}
