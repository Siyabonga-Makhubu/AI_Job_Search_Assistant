import { z } from "zod";
import { ResumeRetrievalRepository } from "../../retrieval/repositories/ResumeRetrievalRepository";
import { normalizeResumeFields } from "../../ingestion/services/AlgorithmResumeParser";
import type { McpCandidateDetail } from "../types/mcp.types";

export const getCandidateSchema = {
  resumeId: z.string().min(1).describe(
    "The MongoDB ObjectId of the resume document to retrieve"
  ),
};

export async function getCandidateTool(
  args: { resumeId: string }
): Promise<McpCandidateDetail> {
  const repository = new ResumeRetrievalRepository();
  const resume = await repository.findById(args.resumeId);

  if (!resume) {
    throw Object.assign(
      new Error(`No resume found with id: ${args.resumeId}`),
      { code: "CANDIDATE_NOT_FOUND" }
    );
  }

  const fields = normalizeResumeFields(resume);

  return {
    resumeId: args.resumeId,
    name: fields.name ?? resume.name ?? null,
    role: fields.role ?? resume.role ?? null,
    company: resume.company ?? null,
    email: fields.email ?? resume.email ?? null,
    phone: fields.phone ?? resume.phone ?? null,
    address: fields.address ?? resume.address ?? null,
    education: resume.education ?? null,
    totalExperience: resume.totalExperience ?? null,
    skills: resume.skills ?? [],
    experienceSummary: resume.experienceSummary ?? null,
  };
}
