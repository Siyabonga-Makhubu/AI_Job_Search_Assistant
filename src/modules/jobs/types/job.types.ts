import type { ObjectId } from "mongodb";

// ─────────────────────────────────────────────────────────────────────────────
// Job source
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Identifier for a job-source backend.
 * Distinct from the `JobSourceProvider` interface in discovery/types.
 */
export type JobSourceProviderName = "linkedin" | "linkedin-jobs" | "indeed" | "careers24" | "pnet" | "careerjunction" | "jobmail" | "jobvine" | "glassdoor" | "arbeitnow" | "adzuna" | "jsearch" | "jobboard" | "web" | "manual";

export interface JobSource {
  provider: JobSourceProviderName;
  /** Original publisher name when results come through a multi-site aggregator. */
  site?: string;
  /** Canonical URL of the job post. Used as the primary deduplication key. */
  url: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw job post (pre-parse)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw content returned by a JobSourceProvider before any parsing or cleaning.
 * All fields except url are optional because the provider may not expose them.
 */
  export interface RawJobPost {
    externalId?: string;
  url: string;
  title?: string;
  company?: string;
  location?: string;
  rawText: string;
  publishedAt?: Date;
  provider: JobSourceProviderName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsed / structured job
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalised job representation stored in MongoDB.
 *
 * Fields are extracted from the raw job description during the parsing phase.
 * Fields that cannot be confidently extracted are left undefined rather than
 * invented.
 */
export interface Job {
  /** MongoDB document id. Present after storage. */
  _id?: ObjectId | string;

  /** Deterministic identifier derived from the source URL (slug / hash). */
  jobId: string;
  /** True when returned directly from the public search index and not stored. */
  external?: boolean;

  title: string;
  company?: string;
  location?: string;
  remote?: boolean;

  source: JobSource;

  /** Full cleaned description text, used for BM25 and vector search. */
  description: string;

  responsibilities: string[];
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  qualifications: string[];
  experienceRequirements: string[];
  educationRequirements: string[];

  employmentType?: string;

  publishedAt?: Date;

  /** Timestamp set when the job was first discovered / ingested. */
  discoveredAt: Date;

  /** Original raw text before cleaning. */
  rawText: string;

  /** SHA-256 hash of normalized source URL + normalised content. */
  contentHash: string;
  /** Version of the extraction rules used to structure the job. */
  parsingVersion?: number;

  /** User-owned application tracking fields. AI workflows never update status. */
  savedAt?: Date;
  status?: ApplicationStatus;
  appliedAt?: Date | null;
  interviewDate?: Date | null;
  applicationMessage?: string;
  matchAnalysis?: JobMatchAnalysis;
  interviewPreparation?: InterviewPreparation;
  tailoredCv?: TailoredCv;

  // ── Embedding metadata ──────────────────────────────────────────────────
  embedding?: number[];
  embeddingModel?: string;
  embeddingDimensions?: number;

  createdAt?: Date;
  updatedAt?: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job search
// ─────────────────────────────────────────────────────────────────────────────

export interface JobSearchCriteria {
  query: string;
  location?: string;
  remote?: boolean;
  topK?: number;
  mode?: "hybrid" | "vector" | "bm25";
  source?: JobSourceProviderName | "all";
}

export interface JobSearchResult {
  job: Job;
  vectorScore?: number;
  keywordScore?: number;
  hybridScore?: number;
}

export type JobActivityType =
  | "job_discovered"
  | "job_saved"
  | "application_submitted"
  | "interview_scheduled"
  | "resume_match"
  | "tailored_cv_saved"
  | "interview_prepared";

export interface JobActivity {
  type: JobActivityType;
  jobId: string;
  title: string;
  company?: string;
  occurredAt: Date;
}

export interface JobDashboardOverview {
  stats: {
    totalJobs: number;
    savedJobs: number;
    applications: number;
    interviews: number;
    offers: number;
  };
  activity: JobActivity[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Candidate evidence
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateEvidenceSource =
  | "skill"
  | "project"
  | "experience"
  | "education"
  | "certification"
  | "resume_text";

export interface CandidateEvidence {
  source: CandidateEvidenceSource;
  /** Name of the skill / project / employer / institution. */
  name?: string;
  /** Verbatim or summarised text from the resume that provides the evidence. */
  text: string;
  /** Specific skill or technology referenced by this evidence item. */
  technology?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Job-to-candidate matching
// ─────────────────────────────────────────────────────────────────────────────

export type MatchStatus = "MATCHED" | "PARTIAL" | "NOT_EVIDENCED";

export const APPLICATION_STATUSES = ["SAVED", "ANALYSED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED", "CLOSED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface InterviewPreparation {
  preparedAt: Date;
  focusTopics: string[];
  discussionAreas: string[];
  resumeEvidence: string[];
}

export interface TailoredCv {
  jobId: string;
  jobTitle: string;
  company?: string;
  generatedAt: Date;
  savedAt?: Date;
  personalDetails: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    github: string;
    portfolio: string;
  };
  headline: string;
  professionalSummary: string;
  technicalSkills: Array<{ category: string; skills: string[] }>;
  projects: Array<{ title: string; details: string[] }>;
  experience: Array<{ title: string; details: string[] }>;
  certificationsAndAchievements: string[];
  /** Kept to read tailored CV records created before the section schema. */
  skills: string[];
  relevantExperience: string[];
  matchedRequirements: string[];
  partialRequirements: string[];
  education: string;
}

export interface RequirementMatch {
  /** The original requirement text extracted from the job. */
  requirement: string;
  status: MatchStatus;
  /** Evidence items from the candidate profile that support this match. */
  evidence: CandidateEvidence[];
}

export interface JobMatchAnalysis {
  jobId: string;
  candidateId: string;

  matchedRequirements: RequirementMatch[];
  partialRequirements: RequirementMatch[];
  notEvidencedRequirements: RequirementMatch[];

  relevantSkills: string[];
  relevantProjects: string[];
  relevantExperience: string[];
  relevantEducation: string[];

  evidence: CandidateEvidence[];

  /** LLM-generated grounded summary of alignment. Never invented — only references evidence. */
  summary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Application message
// ─────────────────────────────────────────────────────────────────────────────

export type ApplicationMessageStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";

export interface ApplicationMessage {
  _id?: ObjectId | string;
  jobId: string;
  candidateId: string;

  message: string;

  /** Skills, projects, experience items referenced in the message. */
  evidenceUsed: string[];

  generatedAt: Date;
  status: ApplicationMessageStatus;
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined job analysis response
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returned by POST /v1/jobs/:jobId/analyse and the MCP analyse_job_match tool.
 * Both the REST controller and the MCP tool call the same underlying service
 * that returns this shape.
 */
export interface JobAnalysisResult {
  job: {
    jobId: string;
    title: string;
    company?: string;
    location?: string;
    url: string;
  };

  match: {
    matched: RequirementMatch[];
    partial: RequirementMatch[];
    notEvidenced: RequirementMatch[];
  };

  candidateEvidence: CandidateEvidence[];

  applicationMessage: string;

  evidenceUsed: string[];
}
