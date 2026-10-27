import type { Job } from "../../types/job.types";

export interface JobIngestionRequest {
  /** Direct URL to a job post. Either this or rawText must be supplied. */
  url?: string;
  /** Pre-fetched raw text of a job post. Used when the caller has already
   *  retrieved the page content. */
  rawText?: string;
  /** Metadata already returned by a job search provider. Supplying rawText and
   * metadata avoids re-fetching a publisher's redirect URL during ingestion. */
  title?: string;
  company?: string;
  location?: string;
  publishedAt?: Date;
  sourceSite?: string;
  /** Optional override for provider name stored on the resulting Job. */
  provider?: string;
}

export interface JobIngestionResult {
  success: boolean;
  message: string;
  jobId: string;
  /** true when the job already existed in MongoDB (idempotent upsert). */
  alreadyExisted: boolean;
  job: Pick<Job, "jobId" | "title" | "company" | "location" | "source">;
  timings: Record<string, number>;
}
