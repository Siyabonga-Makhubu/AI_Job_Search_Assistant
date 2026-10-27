import { env } from "../../../../config/env";
import { QueryEmbeddingService } from "../../../retrieval/services/QueryEmbeddingService";
import { GenericWebProvider } from "../../discovery/services/GenericWebProvider";
import { JobParsingService } from "../../parsing/services/JobParsingService";
import type { Job } from "../../types/job.types";
import { JobRepository } from "../repositories/JobRepository";
import type { JobIngestionRequest, JobIngestionResult } from "../types/ingestion.types";
import { canonicalizeUrl } from "../utils/jobUrl";
import { buildContentHash, buildJobId } from "../utils/jobHasher";
import { cleanJobText } from "../utils/jobCleaner";

const JOB_PARSING_VERSION = 4;

export class JobIngestionService {
  constructor(
    private readonly repository = new JobRepository(),
    private readonly provider = new GenericWebProvider(),
    private readonly parser = new JobParsingService(),
    private readonly embeddingService = new QueryEmbeddingService(),
  ) {}

  async ingestFromText(request: JobIngestionRequest): Promise<JobIngestionResult> {
    if (!request.rawText?.trim() && !request.url?.trim()) {
      throw Object.assign(new Error("Either url or rawText is required for job ingestion"), { statusCode: 400, errorCode: "JOB_INGESTION_INVALID_INPUT" });
    }
    const startedAt = Date.now();
    const sourcePost = request.url && request.rawText?.trim()
      ? {
          url: request.url,
          provider: (request.provider as Job["source"]["provider"]) ?? "web",
          rawText: request.rawText,
          title: request.title,
          company: request.company,
          location: request.location,
          publishedAt: request.publishedAt,
        }
      : request.url
        ? await this.provider.getJob(request.url)
        : { url: `manual:${buildContentHash("manual", request.rawText ?? "").slice(0, 24)}`, provider: "manual" as const, rawText: request.rawText ?? "" };
    const rawText = request.rawText?.trim() || sourcePost.rawText;

    const cleanStart = Date.now();
    const cleanedText = cleanJobText(rawText);
    const cleanMs = Date.now() - cleanStart;
    if (!cleanedText) throw Object.assign(new Error("Job text is empty after cleaning"), { statusCode: 422, errorCode: "JOB_INGESTION_EMPTY_TEXT" });

    const sourceUrl = request.url ? canonicalizeUrl(sourcePost.url) : sourcePost.url;
    const jobId = buildJobId(sourceUrl);
    const contentHash = buildContentHash(sourceUrl, cleanedText);
    const existing = await this.repository.findBySourceUrl(sourceUrl);
    if (existing?.contentHash === contentHash && existing.parsingVersion === JOB_PARSING_VERSION) {
      return {
        success: true,
        message: "Job is already current",
        jobId,
        alreadyExisted: true,
        job: { jobId, title: existing.title, company: existing.company, location: existing.location, source: existing.source },
        timings: { cleanMs, embeddingMs: 0, upsertMs: 0, totalMs: Date.now() - startedAt },
      };
    }

    const parsed = await this.parser.parseWithLangChain({ cleanedText, rawTitle: sourcePost.title, rawCompany: sourcePost.company, rawLocation: sourcePost.location });
    const title = parsed.title ?? cleanedText.split(/\n/).map((line) => line.trim()).find((line) => line.length >= 4 && line.length <= 120);
    if (!title) throw Object.assign(new Error("A job title could not be extracted"), { statusCode: 422, errorCode: "JOB_PARSE_FAILED" });

    const document: Omit<Job, "_id"> = {
      jobId,
      title,
      company: parsed.company,
      location: parsed.location,
      remote: parsed.remote,
      source: { provider: (request.provider as Job["source"]["provider"]) ?? sourcePost.provider, site: request.sourceSite, url: sourceUrl },
      description: cleanedText,
      responsibilities: parsed.responsibilities,
      requiredSkills: parsed.requiredSkills,
      preferredSkills: parsed.preferredSkills,
      technologies: parsed.technologies,
      qualifications: parsed.qualifications,
      experienceRequirements: parsed.experienceRequirements,
      educationRequirements: parsed.educationRequirements,
      employmentType: parsed.employmentType,
      publishedAt: sourcePost.publishedAt,
      discoveredAt: new Date(),
      rawText,
      contentHash,
      parsingVersion: JOB_PARSING_VERSION,
    };

    let embeddingMs = 0;
    if (env.mistralApiKey) {
      const embeddingStart = Date.now();
      const embedding = await this.embeddingService.embedText(`${title}\n${cleanedText}`);
      embeddingMs = Date.now() - embeddingStart;
      if (embedding.length !== env.embeddingDimension || embedding.some((value) => !Number.isFinite(value))) {
        throw Object.assign(new Error("Job embedding dimensions are invalid"), { statusCode: 502, errorCode: "JOB_EMBEDDING_INVALID" });
      }
      document.embedding = embedding;
      document.embeddingModel = env.mistralEmbedModel;
      document.embeddingDimensions = embedding.length;
    }

    await this.repository.ensureIndexes();
    const upsertStart = Date.now();
    const { alreadyExisted } = await this.repository.upsertJob(document);
    const upsertMs = Date.now() - upsertStart;
    console.info(JSON.stringify({ event: "job_ingestion_completed", jobId, alreadyExisted, cleanMs, embeddingMs, upsertMs }));

    return {
      success: true,
      message: alreadyExisted ? "Job updated or already current" : "Job ingested successfully",
      jobId,
      alreadyExisted,
      job: { jobId, title, company: document.company, location: document.location, source: document.source },
      timings: { cleanMs, embeddingMs, upsertMs, totalMs: Date.now() - startedAt },
    };
  }
}
