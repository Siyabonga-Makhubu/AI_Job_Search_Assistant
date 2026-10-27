export type HealthStatus = {
  status?: string;
  app?: string;
  database?: string;
  connected?: boolean;
  version?: string;
  llmConfigured?: boolean;
  latencyMs?: number;
  errorCode?: string;
}

export type ResumeStats = {
  success: boolean;
  resumeCount: number;
  indexedCount: number;
}

export type LibraryResume = {
  resumeId: string;
  name: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
  skills: string[];
  totalExperience: number | null;
  indexed: boolean;
  embeddingDimension: number | null;
  createdAt: string | null;
}

export type SearchResult = {
  resumeId: string;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  company?: string | null;
  skills: string[];
  totalExperience?: number | null;
  vectorScore?: number;
  keywordScore?: number;
  hybridScore?: number;
  rerankScore?: number;
  score?: number;
}

export type SearchSource = {
  resumeId: string;
  name?: string | null;
  score?: number;
  evidence?: string;
}

export type SearchResponse = {
  success: boolean;
  query: string;
  answer: string;
  results: SearchResult[];
  sources: SearchSource[];
  metadata?: Record<string, unknown>;
  timings?: Record<string, number>;
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
}

export type DeduplicationGroup = {
  duplicateKey: string;
  matchedBy: string;
  kept: { resumeId: string; name: string | null };
  deleted: Array<{ resumeId: string; name: string | null }>;
}

export type DeduplicationPreview = {
  success: boolean;
  totalDocuments: number;
  duplicateGroups: number;
  duplicatesToRemove: number;
  groups: Array<{
    duplicateKey: string;
    matchedBy: string;
    count: number;
    kept: { resumeId: string; name: string | null; fileName: string | null; createdAt: string | null };
    duplicates: Array<{ resumeId: string; name: string | null; fileName: string | null; createdAt: string | null }>;
  }>;
}

export type DeduplicationResult = {
  success: boolean;
  totalBefore: number;
  deletedCount: number;
  totalAfter: number;
  groups: DeduplicationGroup[];
}

export type SearchRequest = {
  query: string;
  topK?: number;
  filters?: Record<string, unknown>;
  mode?: 'hybrid' | 'vector' | 'bm25';
}
