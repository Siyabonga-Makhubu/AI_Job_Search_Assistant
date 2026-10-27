import type { NextFunction, Request, Response } from "express";
import { getJobConfig } from "../../../config/jobConfig";
import { JobApplicationService } from "../services/JobApplicationService";
import { InterviewChatService, type InterviewChatMessage } from "../matching/services/InterviewChatService";
import { TailoredCvService, type TailoredCvEdits } from "../matching/services/TailoredCvService";
import { APPLICATION_STATUSES, type ApplicationStatus, type InterviewPreparation } from "../types/job.types";

/** Shared composition root for the REST job endpoints. */
const jobService = new JobApplicationService();
const interviewChat = new InterviewChatService();
const tailoredCvService = new TailoredCvService();

function candidateId(req: Request): string | undefined {
  const value = req.body?.candidateId;
  if (value !== undefined && (typeof value !== "string" || !value.trim())) {
    throw Object.assign(new Error("candidateId must be a non-empty string"), { statusCode: 400, errorCode: "INVALID_CANDIDATE_ID" });
  }
  return value;
}

function validationError(field: string, requirement: string): Error {
  return Object.assign(new Error(`${field} ${requirement}`), { statusCode: 400, errorCode: "INVALID_APPLICATION_UPDATE" });
}

function parseCvEntries(value: unknown, field: string): Array<{ title: string; details: string[] }> {
  if (!Array.isArray(value) || value.length > 30) throw validationError(field, "must be an array of at most 30 CV entries");
  return value.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      Object.keys(entry).some((key) => key !== "title" && key !== "details") ||
      typeof entry.title !== "string" || entry.title.length > 300 ||
      !Array.isArray(entry.details) || entry.details.length > 50 ||
      !entry.details.every((detail: unknown) => typeof detail === "string" && detail.length <= 3000)) {
      throw validationError(`${field}[${index}]`, "must contain a title and up to 50 detail strings");
    }
    return { title: entry.title.trim(), details: entry.details.map((detail: string) => detail.trim()).filter(Boolean) };
  }).filter((entry) => entry.title || entry.details.length > 0);
}

function parseCvTextList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length > 100 || !value.every((item) => typeof item === "string" && item.length <= 2000)) {
    throw validationError(field, "must be an array of at most 100 strings, each no longer than 2000 characters");
  }
  return value.map((item: string) => item.trim()).filter(Boolean);
}

function parseApplicationDate(value: unknown, field: string): Date | null {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d))?$/.test(value)) {
    throw validationError(field, "must be a valid ISO date/time string or null");
  }
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const parsed = new Date(value);
  if (calendarDate.toISOString().slice(0, 10) !== datePart || Number.isNaN(parsed.getTime())) {
    throw validationError(field, "must be a valid ISO date/time string or null");
  }
  return parsed;
}

function parseStatus(value: unknown): ApplicationStatus {
  if (typeof value !== "string" || !APPLICATION_STATUSES.includes(value as ApplicationStatus)) {
    throw validationError("status", `must be one of ${APPLICATION_STATUSES.join(", ")}`);
  }
  return value as ApplicationStatus;
}

function requireSavedJob(job: { savedAt?: Date } | null): void {
  if (!job) throw Object.assign(new Error("Job not found"), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
  if (!job.savedAt) throw Object.assign(new Error("Save this job before updating its application tracking"), { statusCode: 409, errorCode: "JOB_NOT_SAVED" });
}

export const jobController = {
  health: (_req: Request, res: Response) => {
    const config = getJobConfig();
    res.status(200).json({ status: "ok", module: "jobs", collection: config.collectionName });
  },

  config: (_req: Request, res: Response) => {
    res.status(200).json({ success: true, config: getJobConfig() });
  },

  overview: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const overview = await jobService.jobs.getDashboardOverview();
      res.status(200).json({ success: true, ...overview });
    } catch (error) { next(error); }
  },

  getJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.jobs.findByJobId(String(req.params.jobId));
      if (!job) {
        res.status(404).json({ success: false, errorCode: "JOB_NOT_FOUND", message: "Job not found" });
        return;
      }
      const { embedding: _embedding, ...publicJob } = job;
      res.status(200).json({ success: true, job: publicJob });
    } catch (error) {
      next(error);
    }
  },

  getSavedJobs: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const saved = await jobService.jobs.listSavedJobs();
      const jobs = saved.map(({ embedding: _embedding, ...job }) => job);
      res.status(200).json({ success: true, jobs });
    } catch (error) { next(error); }
  },

  getTailoredCv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.jobs.findByJobId(String(req.params.jobId));
      if (!job) {
        res.status(404).json({ success: false, errorCode: "JOB_NOT_FOUND", message: "Job not found" });
        return;
      }
      if (!job.tailoredCv) {
        res.status(404).json({ success: false, errorCode: "TAILORED_CV_NOT_FOUND", message: "No saved tailored CV exists for this job" });
        return;
      }
      res.status(200).json({ success: true, cv: job.tailoredCv });
    } catch (error) { next(error); }
  },

  generateTailoredCv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cv = await tailoredCvService.generate(String(req.params.jobId), candidateId(req));
      res.status(200).json({ success: true, cv });
    } catch (error) { next(error); }
  },

  saveTailoredCv: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError("body", "must be a JSON object");
      const allowed = new Set(["candidateId", "personalDetails", "education", "projects", "experience", "certificationsAndAchievements"]);
      if (Object.keys(body).some((key) => !allowed.has(key)) || !body.personalDetails || typeof body.personalDetails !== "object" || Array.isArray(body.personalDetails)) {
        throw validationError("body", "must contain only editable personalDetails, education, projects, experience, and certificationsAndAchievements");
      }

      const personalDetails = body.personalDetails as Record<string, unknown>;
      const personalFields = ["email", "phone", "location", "linkedin", "github", "portfolio"] as const;
      if (Object.keys(personalDetails).some((key) => !personalFields.includes(key as typeof personalFields[number])) ||
        personalFields.some((field) => typeof personalDetails[field] !== "string" || (personalDetails[field] as string).length > 300)) {
        throw validationError("personalDetails", "must contain email, phone, location, linkedin, github, and portfolio strings up to 300 characters; name is read-only");
      }
      if (personalDetails.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personalDetails.email as string)) {
        throw validationError("personalDetails.email", "must be a valid email address");
      }
      if (typeof body.education !== "string" || body.education.length > 10000) {
        throw validationError("education", "must be a string of at most 10000 characters");
      }

      const edits: TailoredCvEdits = {
        personalDetails: personalDetails as TailoredCvEdits["personalDetails"],
        education: body.education,
        projects: parseCvEntries(body.projects, "projects"),
        experience: parseCvEntries(body.experience, "experience"),
        certificationsAndAchievements: parseCvTextList(body.certificationsAndAchievements, "certificationsAndAchievements"),
      };
      const cv = await tailoredCvService.save(String(req.params.jobId), edits, candidateId(req));
      res.status(200).json({ success: true, cv });
    } catch (error) { next(error); }
  },

  saveJob: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const job = await jobService.jobs.saveJob(String(req.params.jobId));
      if (!job) {
        res.status(404).json({ success: false, errorCode: "JOB_NOT_FOUND", message: "Job not found" });
        return;
      }
      const { embedding: _embedding, ...publicJob } = job;
      res.status(200).json({ success: true, job: publicJob });
    } catch (error) { next(error); }
  },

  updateStatus: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = parseStatus(req.body?.status);
      const jobId = String(req.params.jobId);
      requireSavedJob(await jobService.jobs.findByJobId(jobId));
      const job = await jobService.jobs.updateApplicationTracking(jobId, { status });
      if (!job) {
        res.status(404).json({ success: false, errorCode: "JOB_NOT_FOUND", message: "Job not found" });
        return;
      }
      const { embedding: _embedding, ...publicJob } = job;
      res.status(200).json({ success: true, job: publicJob });
    } catch (error) { next(error); }
  },

  updateApplication: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) throw validationError("body", "must be a JSON object");
      const allowed = new Set(["status", "appliedAt", "interviewDate", "applicationMessage", "matchAnalysis", "interviewPreparation"]);
      const keys = Object.keys(body);
      if (!keys.length || keys.some((key) => !allowed.has(key))) throw validationError("body", "must contain supported application fields");
      const update: Record<string, unknown> = {};
      if ("status" in body) update.status = parseStatus(body.status);
      for (const field of ["appliedAt", "interviewDate"] as const) {
        if (field in body) update[field] = parseApplicationDate(body[field], field);
      }
      if ("applicationMessage" in body) {
        if (typeof body.applicationMessage !== "string" || body.applicationMessage.length > 20000) throw validationError("applicationMessage", "must be a string of at most 20000 characters");
        update.applicationMessage = body.applicationMessage;
      }
      if ("matchAnalysis" in body) {
        if (!body.matchAnalysis || typeof body.matchAnalysis !== "object" || Array.isArray(body.matchAnalysis)) throw validationError("matchAnalysis", "must be an object");
        update.matchAnalysis = body.matchAnalysis;
      }
      if ("interviewPreparation" in body) {
        const preparation = body.interviewPreparation as Partial<InterviewPreparation> | null;
        if (!preparation || typeof preparation !== "object" || Array.isArray(preparation) ||
          !Array.isArray(preparation.focusTopics) || !preparation.focusTopics.every((item) => typeof item === "string") ||
          !Array.isArray(preparation.discussionAreas) || !preparation.discussionAreas.every((item) => typeof item === "string") ||
          !Array.isArray(preparation.resumeEvidence) || !preparation.resumeEvidence.every((item) => typeof item === "string")) {
          throw validationError("interviewPreparation", "must contain focusTopics, discussionAreas, and resumeEvidence string arrays");
        }
        update.interviewPreparation = { ...preparation, preparedAt: parseApplicationDate(preparation.preparedAt, "interviewPreparation.preparedAt") };
      }

      const jobId = String(req.params.jobId);
      requireSavedJob(await jobService.jobs.findByJobId(jobId));
      const job = await jobService.jobs.updateApplicationTracking(jobId, update);
      if (!job) {
        res.status(404).json({ success: false, errorCode: "JOB_NOT_FOUND", message: "Job not found" });
        return;
      }
      const { embedding: _embedding, ...publicJob } = job;
      res.status(200).json({ success: true, job: publicJob });
    } catch (error) { next(error); }
  },

  discover: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const posts = await jobService.discovery.discoverJobs({
        query: typeof req.body?.query === "string" ? req.body.query : undefined,
        location: typeof req.body?.location === "string" ? req.body.location : undefined,
        remote: typeof req.body?.remote === "boolean" ? req.body.remote : undefined,
        topK: typeof req.body?.topK === "number" ? req.body.topK : undefined,
      });
      const ingested = [];
      for (const post of posts) ingested.push(await jobService.ingestion.ingestFromText({
        url: post.url,
        rawText: post.rawText,
        provider: post.provider,
        title: post.title,
        company: post.company,
        location: post.location,
        publishedAt: post.publishedAt,
      }));
      res.status(200).json({ success: true, discovered: posts.length, ingested });
    } catch (error) { next(error); }
  },
  ingest: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (typeof req.body?.url !== "string" && typeof req.body?.rawText !== "string") {
        throw Object.assign(new Error("Provide a public job url or rawText"), { statusCode: 400, errorCode: "JOB_INGESTION_INVALID_INPUT" });
      }
      const result = await jobService.ingestion.ingestFromText({ url: req.body.url, rawText: req.body.rawText, provider: req.body.provider });
      res.status(result.alreadyExisted ? 200 : 201).json(result);
    } catch (error) { next(error); }
  },
  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await jobService.searchPublicJobs({
        query: req.body?.query,
        location: req.body?.location,
        remote: req.body?.remote,
        topK: req.body?.topK,
        mode: req.body?.mode,
        source: typeof req.body?.source === "string" ? req.body.source as any : "all",
      });
      const storedResults = [];
      for (const result of results) {
        const job = result.job;
        const ingested = await jobService.ingestion.ingestFromText({
          url: job.source.url,
          rawText: job.rawText || job.description,
          provider: job.source.provider,
          sourceSite: job.source.site,
          title: job.title,
          company: job.company,
          location: job.location,
          publishedAt: job.publishedAt instanceof Date ? job.publishedAt : undefined,
        });
        const storedJob = await jobService.jobs.findByJobId(ingested.jobId);
        if (!storedJob) continue;
        const { embedding: _embedding, ...publicJob } = storedJob;
        storedResults.push({ ...result, job: { ...publicJob, external: false } });
      }
      res.status(200).json({ success: true, results: storedResults });
    } catch (error) { next(error); }
  },
  match: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = String(req.params.jobId);
      const result = await jobService.matching.analyseJobMatch({ jobId, candidateId: candidateId(req) });
      await jobService.jobs.updateApplicationTracking(jobId, { matchAnalysis: result });
      res.status(200).json({ success: true, match: result });
    } catch (error) { next(error); }
  },
  applicationMessage: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allowedTypes = ["Recruiter message", "Cover letter", "Email", "LinkedIn message"] as const;
      const requestedType = req.body?.messageType;
      const messageType = allowedTypes.includes(requestedType) ? requestedType : "Recruiter message";
      const requestedOptions = req.body?.options ?? {};
      if (!requestedOptions || typeof requestedOptions !== "object" || Array.isArray(requestedOptions)) {
        throw validationError("options", "must be an object");
      }
      const allowedOptionKeys = new Set(["company", "companyAddress", "recipient", "senderName", "subject"]);
      if (Object.keys(requestedOptions).some((key) => !allowedOptionKeys.has(key))) {
        throw validationError("options", "may contain only company, recipient, and subject");
      }
      for (const [key, value] of Object.entries(requestedOptions)) {
        if (typeof value !== "string" || value.length > 300) {
          throw validationError(`options.${key}`, "must be a string of at most 300 characters");
        }
      }
      const draft = await jobService.applications.generate(String(req.params.jobId), candidateId(req), messageType, requestedOptions);
      await jobService.jobs.updateApplicationTracking(String(req.params.jobId), { applicationMessage: draft.message });
      res.status(201).json({ success: true, ...draft });
    } catch (error) { next(error); }
  },
  interviewChat: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const question = req.body?.question;
      if (typeof question !== "string" || !question.trim() || question.length > 2000) {
        throw Object.assign(new Error("question must be a non-empty string of at most 2000 characters"), { statusCode: 400, errorCode: "INVALID_INTERVIEW_QUESTION" });
      }
      const history = Array.isArray(req.body?.history) ? req.body.history.filter((item: any) =>
        item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string",
      ).slice(-8) as InterviewChatMessage[] : [];
      const answer = await interviewChat.answer(String(req.params.jobId), question.trim(), history);
      res.status(200).json({ success: true, answer });
    } catch (error) { next(error); }
  },
  analyse: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await jobService.analyse({ jobId: String(req.params.jobId), candidateId: candidateId(req) });
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  },
};
