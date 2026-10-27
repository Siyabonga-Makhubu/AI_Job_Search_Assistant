import { JobRepository } from "../../ingestion/repositories/JobRepository";
import type { JobMatchAnalysis, RequirementMatch, CandidateEvidence, MatchStatus } from "../../types/job.types";
import type { JobMatchRequest, JobMatchResponse } from "../types/matching.types";
import { CandidateEvidenceService } from "./CandidateEvidenceService";

export class JobMatchingService {
  constructor(private readonly jobRepository = new JobRepository(), private readonly evidenceService = new CandidateEvidenceService()) {}

  async analyseJobMatch(request: JobMatchRequest): Promise<JobMatchResponse> {
    const job = await this.jobRepository.findByJobId(request.jobId);
    if (!job) throw Object.assign(new Error(`Job not found: ${request.jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
    const profile = await this.evidenceService.getCandidateProfile(request.candidateId);
    if (!profile) throw Object.assign(new Error("No candidate profile found in the Resume RAG database"), { statusCode: 404, errorCode: "CANDIDATE_PROFILE_NOT_FOUND" });
    const candidateId = String(profile._id ?? request.candidateId ?? "unknown");
    const requirements = [...new Set([
      ...job.requiredSkills,
      ...job.preferredSkills,
      ...job.technologies,
      ...job.qualifications,
      ...job.experienceRequirements,
      ...job.educationRequirements,
    ].map((item) => item.trim()).filter(Boolean))];
    const classified: RequirementMatch[] = await Promise.all(requirements.map(async (requirement) => {
      const evidence = await this.evidenceService.findEvidenceForRequirement(requirement, candidateId, profile);
      return { requirement, evidence, status: this.classifyMatch(requirement, evidence) };
    }));
    const allEvidence = this.uniqueEvidence(classified.flatMap((entry) => entry.evidence));
    const analysis: JobMatchAnalysis = {
      jobId: job.jobId,
      candidateId,
      matchedRequirements: classified.filter((entry) => entry.status === "MATCHED"),
      partialRequirements: classified.filter((entry) => entry.status === "PARTIAL"),
      notEvidencedRequirements: classified.filter((entry) => entry.status === "NOT_EVIDENCED"),
      relevantSkills: [...new Set(allEvidence.filter((entry) => entry.source === "skill").map((entry) => entry.name ?? entry.technology ?? ""))].filter(Boolean),
      relevantProjects: [...new Set(allEvidence.filter((entry) => entry.source === "project").map((entry) => entry.name ?? entry.text))],
      relevantExperience: [...new Set(allEvidence.filter((entry) => entry.source === "experience").map((entry) => entry.text))],
      relevantEducation: [...new Set(allEvidence.filter((entry) => entry.source === "education").map((entry) => entry.text))],
      evidence: allEvidence,
      summary: this.buildGroundedSummary(classified),
    };
    return { ...analysis, analysedAt: new Date().toISOString() };
  }

  classifyMatch(requirement: string, evidence: CandidateEvidence[]): MatchStatus {
    if (!evidence.length) return "NOT_EVIDENCED";
    const normalized = requirement.toLowerCase().trim();
    if (evidence.some((item) => item.source === "skill" && (item.name ?? item.technology ?? "").toLowerCase() === normalized)) return "MATCHED";
    const terms = this.terms(requirement);
    const bestCoverage = Math.max(0, ...evidence.map((item) => {
      const text = `${item.name ?? ""} ${item.technology ?? ""} ${item.text}`.toLowerCase();
      return terms.length ? terms.filter((term) => this.containsTerm(text, term)).length / terms.length : 0;
    }));
    if (bestCoverage >= 0.75 || evidence.some((item) => this.containsTerm(item.text.toLowerCase(), normalized))) return "MATCHED";
    return bestCoverage > 0 ? "PARTIAL" : "NOT_EVIDENCED";
  }

  private terms(value: string): string[] {
    const noise = new Set(["with", "from", "years", "year", "experience", "knowledge", "ability", "strong", "good", "required", "preferred", "and", "the", "for", "using"]);
    return [...new Set((value.toLowerCase().match(/[a-z0-9+#.]+/g) ?? []).filter((word) => word.length > 1 && !noise.has(word)))];
  }

  private containsTerm(text: string, term: string): boolean {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\s+/g, "\\s+");
    return Boolean(escaped && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text));
  }

  private uniqueEvidence(evidence: CandidateEvidence[]): CandidateEvidence[] {
    const keys = new Set<string>();
    return evidence.filter((item) => {
      const key = `${item.source}|${item.name ?? ""}|${item.text}`.toLowerCase();
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    });
  }

  private buildGroundedSummary(entries: RequirementMatch[]): string {
    if (!entries.length) return "No structured job requirements were extracted, so an evidence-based alignment score is unavailable.";
    const matched = entries.filter((entry) => entry.status === "MATCHED").length;
    const partial = entries.filter((entry) => entry.status === "PARTIAL").length;
    const missing = entries.filter((entry) => entry.status === "NOT_EVIDENCED").length;
    return `Resume evidence supports ${matched} of ${entries.length} extracted requirements, partially supports ${partial}, and contains no evidence for ${missing}. Missing evidence indicates that the uploaded resume does not document these requirements; it does not establish that the candidate lacks them.`;
  }
}
