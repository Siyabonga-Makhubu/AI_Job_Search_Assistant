import { JobRepository } from "../../ingestion/repositories/JobRepository";
import { BM25Service } from "../../../retrieval/services/BM25Service";
import { QueryEmbeddingService } from "../../../retrieval/services/QueryEmbeddingService";
import type { Job, JobSearchCriteria, JobSearchResult } from "../../types/job.types";
import type { StoredResume } from "../../../retrieval/types/retrieval.types";

export class JobSearchService {
  constructor(
    private readonly jobRepository = new JobRepository(),
    private readonly bm25Service = new BM25Service(),
    private readonly embeddingService = new QueryEmbeddingService(),
  ) {}

  async search(criteria: JobSearchCriteria): Promise<JobSearchResult[]> {
    const query = criteria.query?.trim();
    if (!query || query.length > 2000) throw Object.assign(new Error("query must be 1 to 2000 characters"), { statusCode: 400, errorCode: "INVALID_QUERY" });
    const topK = Math.max(1, Math.min(50, Math.floor(criteria.topK ?? 10)));
    const mode = criteria.mode ?? "hybrid";
    let vectorResults: JobSearchResult[] = [];
    let keywordResults: JobSearchResult[] = [];
    let vectorError: unknown;
    let keywordError: unknown;
    if (mode !== "bm25") {
      try { vectorResults = await this.vectorSearch(query, topK * 2); }
      catch (error) { vectorError = error; }
    }
    if (mode !== "vector") {
      try { keywordResults = await this.bm25Search(query, topK * 2); }
      catch (error) { keywordError = error; }
    }
    if (mode === "vector" && vectorError) throw vectorError;
    if (mode === "bm25" && keywordError) throw keywordError;
    if (mode === "hybrid" && vectorError && keywordError) {
      throw Object.assign(new Error("Job vector and keyword retrieval are unavailable"), { statusCode: 503, errorCode: "JOB_SEARCH_UNAVAILABLE" });
    }

    const merged = new Map<string, JobSearchResult>();
    const add = (result: JobSearchResult, rank: number, channel: "vector" | "keyword") => {
      const current = merged.get(result.job.jobId) ?? { job: result.job, vectorScore: 0, keywordScore: 0, hybridScore: 0 };
      if (channel === "vector") current.vectorScore = result.vectorScore ?? 0;
      else current.keywordScore = result.keywordScore ?? 0;
      // Reciprocal-rank fusion keeps BM25 and vector score scales separate.
      current.hybridScore = (current.hybridScore ?? 0) + 1 / (60 + rank);
      merged.set(result.job.jobId, current);
    };
    vectorResults.forEach((result, index) => add(result, index + 1, "vector"));
    keywordResults.forEach((result, index) => add(result, index + 1, "keyword"));

    let results = [...merged.values()];
    if (criteria.location) results = results.filter(({ job }) => job.location?.toLowerCase().includes(criteria.location!.toLowerCase()));
    if (criteria.remote === true) results = results.filter(({ job }) => job.remote === true);
    return results.sort((a, b) => (b.hybridScore ?? 0) - (a.hybridScore ?? 0)).slice(0, topK);
  }

  async bm25Search(query: string, topK: number): Promise<JobSearchResult[]> {
    const jobs = await this.jobRepository.listJobsForBM25();
    const byId = new Map(jobs.map((job) => [job.jobId, job]));
    const results = this.bm25Service.search(query, jobs.map((job) => this.jobToResumeAdapter(job)), topK);
    return results.flatMap((result) => {
      const jobId = String((result.resume as any)._jobId ?? result.resume._id ?? "");
      const job = byId.get(jobId);
      return job ? [{ job, keywordScore: result.keywordScore }] : [];
    });
  }

  async vectorSearch(query: string, topK: number): Promise<JobSearchResult[]> {
    const queryVector = await this.embeddingService.embedText(query);
    const jobs = await this.jobRepository.findByVector(queryVector, topK);
    return jobs.map((job) => ({ job, vectorScore: Number((job as any).score ?? 0) }));
  }

  private jobToResumeAdapter(job: Job): StoredResume {
    return {
      _id: job.jobId,
      _jobId: job.jobId,
      rawText: [job.title, job.company, job.description, ...job.requiredSkills, ...job.preferredSkills, ...job.technologies, ...job.responsibilities].filter(Boolean).join("\n"),
      name: job.title,
      role: job.title,
      company: job.company,
      location: job.location,
      skills: [...job.requiredSkills, ...job.preferredSkills, ...job.technologies],
      embedding: job.embedding ?? [],
    } as unknown as StoredResume;
  }
}
