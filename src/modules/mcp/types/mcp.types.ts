/**
 * Shared types used across MCP tools and resources.
 *
 * These are the shapes the MCP server returns to AI agents —
 * intentionally stripped of internal scoring details and raw embeddings.
 */

export interface McpCandidateResult {
  resumeId: string;
  candidateName: string | null;
  role: string | null;
  company: string | null;
  skills: string[];
  matchedSkills: string[];
  experience: number | null;
  evidence: string[];
  vectorScore: number | null;
  bm25Score: number | null;
  rerankScore: number | null;
}

export interface McpSearchResult {
  query: string;
  totalFound: number;
  results: McpCandidateResult[];
}

export interface McpCandidateDetail {
  resumeId: string;
  name: string | null;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  education: string | null;
  totalExperience: number | null;
  skills: string[];
  experienceSummary: string | null;
}

export interface McpSkillsResult {
  resumeId: string;
  candidateName: string | null;
  skills: string[];
  totalSkills: number;
}

export interface McpExperienceResult {
  resumeId: string;
  candidateName: string | null;
  totalExperience: number | null;
  experienceSummary: string | null;
  role: string | null;
  company: string | null;
}

export interface McpEducationResult {
  resumeId: string;
  candidateName: string | null;
  education: string | null;
}

export interface McpCompaniesResult {
  resumeId: string;
  candidateName: string | null;
  company: string | null;
}

export interface McpJobMatchResult {
  jobDescription: string;
  totalMatched: number;
  matches: Array<{
    resumeId: string;
    candidateName: string | null;
    role: string | null;
    matchedRequirements: string[];
    missingRequirements: string[];
    matchScore: number;
    rerankScore: number | null;
  }>;
}

export interface McpResumeEvidenceResult {
  resumeId: string;
  candidateName: string | null;
  query: string;
  evidence: string[];
  skills: string[];
  role: string | null;
  rerankScore: number | null;
}

export interface McpToolError {
  error: string;
  code: string;
}

// ── Deduplication types ──────────────────────────────────────────────────────

export interface McpDuplicateGroup {
  /** The deduplication key used to identify this group */
  duplicateKey: string;
  /** The signal that matched: 'email' | 'name_experience' | 'filename' */
  matchedBy: string;
  /** Total documents in this group */
  count: number;
  /** The document that will be KEPT (most recently ingested) */
  kept: {
    resumeId: string;
    name: string | null;
    fileName: string | null;
    createdAt: string | null;
  };
  /** The documents that will be DELETED if deduplication runs */
  duplicates: Array<{
    resumeId: string;
    name: string | null;
    fileName: string | null;
    createdAt: string | null;
  }>;
}

export interface McpFindDuplicatesResult {
  totalDocuments: number;
  duplicateGroups: number;
  duplicatesToRemove: number;
  groups: McpDuplicateGroup[];
}

export interface McpDeleteDuplicatesResult {
  deletedCount: number;
  keptCount: number;
  groups: Array<{
    duplicateKey: string;
    matchedBy: string;
    kept: { resumeId: string; name: string | null };
    deleted: Array<{ resumeId: string; name: string | null }>;
  }>;
}
