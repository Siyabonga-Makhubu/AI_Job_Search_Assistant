import type { ObjectId } from "mongodb";

export interface ResumeMetadataFilter {
  skills?: string[];
  minimumExperience?: number;
  maximumExperience?: number;
  roles?: string[];
  companies?: string[];
  locations?: string[];
  education?: string;
}

export interface StoredResume {
  _id?: ObjectId | string;
  fileName?: string;
  rawText?: string;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  company?: string | null;
  role?: string | null;
  education?: string | null;
  totalExperience?: number | null;
  relevantExperience?: number | null;
  skills: string[];
  jobTitles?: string[];
  experienceSummary?: string | null;
  embedding: number[];
  embeddingModel?: string;
  embeddingDimension?: number;
  score?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RetrievalResult {
  resumeId: string;
  name?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  company?: string | null;
  skills: string[];
  totalExperience?: number | null;
  matchedSkills?: string[];
  evidence?: string[];

  // Retrieval signals
  vectorScore?: number;
  keywordScore?: number;
  hybridScore?: number;

  // Final reranking score
  rerankScore?: number;

  score?: number;
}

export interface BM25SearchResult {
  resume: StoredResume;
  keywordScore: number;
}

export interface RetrievalSource {
  resumeId: string;
  name?: string | null;
  score?: number;
  evidence?: string[];
}

export interface RetrievalResponse {
  success: boolean;
  query: string;
  answer: string;
  results: RetrievalResult[];
  sources: RetrievalSource[];
  timings?: Record<string, number>;
  metadata?: {
    retrievalMode: "hybrid" | "vector" | "bm25";
    degraded: boolean;
    state: string;
    reason?: string;
    candidateCounts?: { vector: number; bm25: number; merged: number; final: number };
  };
}

export interface RetrievalSearchRequest {
  query: string;
  filters?: ResumeMetadataFilter;
  topK?: number;
  mode?: "hybrid" | "vector" | "bm25";
}
