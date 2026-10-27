import { JobRepository } from "../ingestion/repositories/JobRepository";
import { JobDiscoveryService } from "../discovery/services/JobDiscoveryService";
import { MultiSiteJobSearchService } from "../discovery/services/MultiSiteJobSearchService";
import { JobIngestionService } from "../ingestion/services/JobIngestionService";
import { JobMatchingService } from "../matching/services/JobMatchingService";
import { JobSearchService } from "../matching/services/JobSearchService";
import { ApplicationMessageService } from "../matching/services/ApplicationMessageService";
import type { JobMatchRequest } from "../matching/types/matching.types";
import type { JobSearchCriteria } from "../types/job.types";
import type { RawJobPost } from "../types/job.types";
import { FreeJobSearchProvider } from "../discovery/services/FreeJobSearchProvider";
import { JSearchProvider } from "../discovery/services/JSearchProvider";
import type { JobSourceProvider } from "../discovery/types/discovery.types";
import { LinkedInJobsProvider } from "../discovery/services/LinkedInJobsProvider";

/** Adapt the configured public search providers to the discovery/ingestion flow. */
class PublicSearchDiscoveryProvider implements JobSourceProvider {
  readonly providerName = "public-job-search";
  private readonly adzuna = new FreeJobSearchProvider();
  private readonly jsearch = new JSearchProvider();

  async searchJobs(criteria: JobSearchCriteria) {
    const results = await new MultiSiteJobSearchService(this.adzuna, this.jsearch).search(criteria);
    return results.map(({ job }) => ({
      url: job.source.url,
      title: job.title,
      company: job.company,
      location: job.location,
      rawText: job.rawText || job.description,
      publishedAt: job.publishedAt,
      provider: job.source.provider,
    }));
  }

  async getJob(url: string): Promise<RawJobPost> {
    throw new Error(`Fetching a discovered listing is not supported: ${url}`);
  }
}

export class JobApplicationService {
  readonly publicJobSearch = new MultiSiteJobSearchService();
  constructor(
    readonly jobs = new JobRepository(),
    readonly discovery = new JobDiscoveryService([new PublicSearchDiscoveryProvider(), new LinkedInJobsProvider()]),
    readonly ingestion = new JobIngestionService(jobs),
    readonly search = new JobSearchService(jobs),
    readonly matching = new JobMatchingService(jobs),
    readonly applications = new ApplicationMessageService(jobs, new JobMatchingService(jobs)),
  ) {}

  async analyse(request: JobMatchRequest) {
    const match = await this.matching.analyseJobMatch(request);
    const job = await this.jobs.findByJobId(request.jobId);
    if (!job) throw Object.assign(new Error(`Job not found: ${request.jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
    const draft = await this.applications.generateFromAnalysis(job, match);
    return {
      job: { jobId: job.jobId, title: job.title, company: job.company, location: job.location, url: job.source.url },
      match: { matched: match.matchedRequirements, partial: match.partialRequirements, notEvidenced: match.notEvidencedRequirements },
      candidateEvidence: match.evidence,
      applicationMessage: draft.message,
      evidenceUsed: draft.evidenceUsed,
      applicationDraft: { status: draft.status, historyId: draft.historyId },
      summary: match.summary,
    };
  }

  searchJobs(criteria: JobSearchCriteria) { return this.search.search(criteria); }
  searchPublicJobs(criteria: JobSearchCriteria) { return this.publicJobSearch.search(criteria); }
}
