import type { RawJobPost, JobSearchCriteria } from "../../types/job.types";

/**
 * Contract that every job-source provider must satisfy.
 *
 * Providers are kept behind this interface so that new sources (LinkedIn,
 * job boards, generic web pages) can be added without changing the discovery
 * service.
 */
export interface JobSourceProvider {
  readonly providerName: string;

  /**
   * Search for jobs matching the given criteria and return lightweight result
   * objects. The caller can then decide which results to fully ingest via
   * getJob().
   */
  searchJobs(criteria: JobSearchCriteria): Promise<RawJobPost[]>;

  /**
   * Fetch the full raw content of a single job posting by URL.
   * Used during the ingest-by-URL flow.
   */
  getJob(url: string): Promise<RawJobPost>;
}
