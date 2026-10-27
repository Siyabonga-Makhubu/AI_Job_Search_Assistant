import { z } from "zod";
import { ResumeRetrievalRepository } from "../../retrieval/repositories/ResumeRetrievalRepository";
import { normalizeResumeFields } from "../../ingestion/services/AlgorithmResumeParser";
import type { McpCompaniesResult } from "../types/mcp.types";

export const getCandidateCompaniesSchema = {
  resumeId: z.string().min(1).describe(
    "The MongoDB ObjectId of the resume document"
  ),
};

export async function getCandidateCompaniesTool(
  args: { resumeId: string }
): Promise<McpCompaniesResult> {
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
    candidateName: fields.name ?? resume.name ?? null,
    company: resume.company ?? null,
  };
}
