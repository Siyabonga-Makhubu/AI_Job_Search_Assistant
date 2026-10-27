import type { Request, Response, NextFunction } from "express";
import { normalizeQuery, isBlankQuery } from "../utils/queryNormalizer";
import { QueryEmbeddingService } from "../services/QueryEmbeddingService";
import { ResumeRetrievalRepository } from "../repositories/ResumeRetrievalRepository";
import { MetadataFilterService } from "../services/MetadataFilterService";
import { RerankingService } from "../services/RerankingService";
import { GroundedAnswerService } from "../services/GroundedAnswerService";
import { ResumeRetrievalService } from "../services/ResumeRetrievalService";
import { DeduplicationService } from "../services/DeduplicationService";
import { parseResume } from "../../ingestion/services/AlgorithmResumeParser";
import { RetrievalReadinessService } from "../services/RetrievalReadinessService";

function parsedResumeFields(resume: { rawText?: string | null; name?: string | null; role?: string | null; company?: string | null; location?: string | null; skills?: string[]; totalExperience?: number | null }) {
  const parsed = resume.rawText ? parseResume(resume.rawText) : null;

  return {
    name: parsed?.name ?? resume.name ?? null,
    role: parsed?.role ?? resume.role ?? null,
    company: parsed?.company ?? resume.company ?? null,
    location: parsed?.location ?? resume.location ?? null,
    skills: parsed?.skills?.length ? parsed.skills : resume.skills ?? [],
    totalExperience: parsed?.totalExperience ?? resume.totalExperience ?? null,
  };
}

function isValidFilters(value: unknown): boolean {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const filters = value as Record<string, unknown>;
  const allowed = new Set(["skills", "minimumExperience", "maximumExperience", "roles", "companies", "locations", "education"]);
  if (Object.keys(filters).some((key) => !allowed.has(key))) return false;
  for (const key of ["skills", "roles", "companies", "locations"]) {
    const list = filters[key];
    if (list !== undefined && (!Array.isArray(list) || list.length > 50 || list.some((item) => typeof item !== "string" || item.length > 100))) return false;
  }
  for (const key of ["minimumExperience", "maximumExperience"]) {
    const years = filters[key];
    if (years !== undefined && (typeof years !== "number" || !Number.isFinite(years) || years < 0 || years > 100)) return false;
  }
  if (filters.education !== undefined && (typeof filters.education !== "string" || filters.education.length > 200)) return false;
  if (typeof filters.minimumExperience === "number" && typeof filters.maximumExperience === "number" && filters.minimumExperience > filters.maximumExperience) return false;
  return true;
}

export const retrievalController = {
  listResumes: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const repository = new ResumeRetrievalRepository();
      const resumes = await repository.listResumes();
      return res.status(200).json({
        success: true,
        resumes: resumes.map((resume) => ({
          resumeId: String(resume._id ?? ""),
          ...parsedResumeFields(resume),
          indexed: Array.isArray(resume.embedding) && resume.embedding.length > 0,
          embeddingDimension: resume.embeddingDimension ?? resume.embedding?.length ?? null,
          createdAt: resume.createdAt ?? null,
        }))
      });
    } catch (error) {
      next(error);
    }
  },

  stats: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const repository = new ResumeRetrievalRepository();
      const stats = await repository.getStats();
      return res.status(200).json({ success: true, ...stats });
    } catch (error) {
      next(error);
    }
  },

  getResume: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resumeId = String(req.params.resumeId ?? "");
      const repository = new ResumeRetrievalRepository();
      const resume = await repository.findById(resumeId);

      if (!resume) {
        return res.status(404).json({ success: false, message: "Resume not found" });
      }

      const fields = parsedResumeFields(resume);

      return res.status(200).json({
        success: true,
        resume: {
          resumeId,
          name: fields.name,
          role: fields.role,
          fileName: (resume as any).fileName ?? null,
          rawText: resume.rawText ?? ""
        }
      });
    } catch (error) {
      next(error);
    }
  },

  health: (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      module: "resume-retrieval"
    });
  },

  readiness: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const readiness = await new RetrievalReadinessService().check();
      return res.status(readiness.ready ? 200 : 503).json({
        status: readiness.ready ? "ready" : "not_ready",
        requestId: res.locals.requestId,
        ...readiness,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Raw semantic vector-search endpoint.
   *
   * This intentionally bypasses hybrid retrieval so that
   * vector search can be tested independently.
   */
  searchRaw: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const query = String(req.body?.query ?? "");

      if (isBlankQuery(query)) {
        return res.status(400).json({
          success: false,
          errorCode: "QUERY_REQUIRED",
          message: "Search query is required"
        });
      }

      const normalizedQuery = normalizeQuery(query);

      const embeddingService = new QueryEmbeddingService();

      const queryEmbedding =
        await embeddingService.embedText(
          normalizedQuery
        );

      const repository =
        new ResumeRetrievalRepository();

      const results =
        await repository.findByVector(
          queryEmbedding,
          Number(req.body?.topK ?? 5)
        );

      return res.status(200).json({
        success: true,
        query: normalizedQuery,
        results: results.map((resume) => ({
          resumeId: String(resume._id ?? ""),
          name: resume.name,
          address: resume.address,
          email: resume.email,
          phone: resume.phone,
          role: resume.role,
          company: resume.company,
          skills: resume.skills ?? [],
          totalExperience: resume.totalExperience,
          score: Number(resume.score ?? 0)
        }))
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Main resume retrieval endpoint.
   *
   * Delegates the complete retrieval pipeline to
   * ResumeRetrievalService.
   */
  search: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return res.status(400).json({ success: false, errorCode: "INVALID_REQUEST", message: "Request body must be a JSON object", requestId: res.locals.requestId });
      }
      if (typeof body.query !== "string" || isBlankQuery(body.query) || body.query.length > 2000) {
        return res.status(400).json({
          success: false,
          errorCode: "INVALID_QUERY",
          message: "Query must be a non-empty string of at most 2000 characters",
          requestId: res.locals.requestId
        });
      }

      const requestedLimit = body.limit ?? body.topK ?? 5;
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 20) {
        return res.status(400).json({ success: false, errorCode: "INVALID_REQUEST", message: "limit must be an integer between 1 and 20", requestId: res.locals.requestId });
      }
      const mode = body.mode ?? "hybrid";
      if (mode !== "vector" && mode !== "bm25" && mode !== "hybrid") {
        return res.status(400).json({ success: false, errorCode: "INVALID_REQUEST", message: "mode must be vector, bm25, or hybrid", requestId: res.locals.requestId });
      }
      if (!isValidFilters(body.filters)) {
        return res.status(400).json({ success: false, errorCode: "INVALID_REQUEST", message: "filters contains unsupported or invalid values", requestId: res.locals.requestId });
      }
      const query = body.query;
      const topK = requestedLimit as number;

      const retrievalService =
        new ResumeRetrievalService();

      const result =
        await retrievalService.search(
          query,
          body.filters,
          topK,
          mode
        );

      return res.status(200).json({
        ...result,
        metadata: {
          requestId: res.locals.requestId,
          retrievalMode: mode,
          degraded: false,
          state: result.results.length === 0 ? "no_relevant_results" : "normal"
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Preview duplicate resume documents without deleting anything.
   * GET /v1/resume/duplicates/preview
   */
  previewDuplicates: async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = new DeduplicationService();
      const preview = await service.findDuplicates();
      return res.status(200).json({ success: true, ...preview });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Find and permanently delete duplicate resume documents.
   * Keeps the most recently ingested copy of each duplicate group.
   * POST /v1/resume/duplicates/delete
   */
  deleteDuplicates: async (
    _req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const service = new DeduplicationService();
      const result = await service.deleteDuplicates();
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }
};
