export interface ResumeDocument {
  fileName?: string;
  rawText: string;
  name?: string | null;
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
  embeddingModel: string;
  embeddingDimension: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionResult {
  success: boolean;
  message: string;
  resumeId?: string;
  data?: Record<string, unknown>;
  timings?: Record<string, number>;
}
