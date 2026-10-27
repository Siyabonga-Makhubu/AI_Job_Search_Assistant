import type { JobMatchAnalysis, CandidateEvidence } from "../../types/job.types";

/**
 * Input to the matching pipeline.
 *
 * Both the REST controller and the MCP analyse_job_match tool pass this
 * to JobMatchingService — no logic is duplicated between the two interfaces.
 */
export interface JobMatchRequest {
  jobId: string;
  /**
   * Resume / candidate document id.
   * When omitted the service uses the first (most recently ingested) resume
   * in the collection — useful for single-user deployments.
   */
  candidateId?: string;
}

export interface JobMatchResponse extends JobMatchAnalysis {
  /** ISO timestamp of when this analysis was computed. */
  analysedAt: string;
}

/**
 * Intermediate result produced per job requirement during matching.
 */
export interface RequirementAnalysisInput {
  requirement: string;
  /** Evidence items retrieved from the Resume RAG for this requirement. */
  evidence: CandidateEvidence[];
}
