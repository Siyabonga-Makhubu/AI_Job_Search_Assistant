import type { Request, Response, NextFunction, Express } from "express";
import { cleanText } from "../utils/textCleaner";
import { parseResume, detectSkills } from "../services/AlgorithmResumeParser";
import { ResumeParserService } from "../services/ResumeParserService";
import { EmbeddingService } from "../services/EmbeddingService";
import { ResumeIngestionService } from "../services/ResumeIngestionService";
import { LLMResumeParser } from "../services/LLMResumeParser";
import { ResumeIngestionRepository } from "../repositories/ResumeIngestionRepository";
import { extractCVIdentifiers } from "../services/cv_extractor";

function getUploadedFile(req: Request): Express.Multer.File | undefined {
  if (req.file) return req.file;

  if (Array.isArray(req.files)) {
    return req.files[0] as Express.Multer.File | undefined;
  }

  if (req.files && typeof req.files === "object") {
    const groups = Object.values(req.files) as Express.Multer.File[][];
    const flattened = groups.flat();
    return flattened[0];
  }

  return undefined;
}

export const ingestionController = {
  health: (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", module: "resume-ingestion" });
  },

  uploadResume: (req: Request, res: Response) => {
    const file = getUploadedFile(req);

    if (!file) {
      return res.status(400).json({ success: false, errorCode: "FILE_REQUIRED", message: "Resume PDF is required" });
    }

    return res.status(200).json({
      success: true,
      message: "Resume uploaded successfully",
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size
      }
    });
  },

  extractText: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = getUploadedFile(req);
      if (!file) {
        return res.status(400).json({ success: false, errorCode: "FILE_REQUIRED", message: "Resume PDF is required" });
      }

      const service = new ResumeParserService();
      const rawText = await service.extractTextFromPdf(file.path);

      if (!rawText) {
        return res.status(422).json({ success: false, errorCode: "RESUME_EXTRACTION_FAILED", message: "Resume extraction failed" });
      }

      return res.status(200).json({ success: true, rawText, characters: rawText.length });
    } catch (error) {
      next(error);
    }
  },

  cleanText: (req: Request, res: Response) => {
    const rawText = String(req.body?.rawText ?? "");
    const cleaned = cleanText(rawText);

    return res.status(200).json({ success: true, cleanText: cleaned });
  },

  extractRegexMatches: (req: Request, res: Response) => {
    const rawText = String(req.body?.rawText ?? "");

    return res.status(200).json({
      success: true,
      ...extractCVIdentifiers(rawText)
    });
  },

  detectSkills: (req: Request, res: Response) => {
    const rawText = String(req.body?.rawText ?? "");
    return res.status(200).json({ success: true, skills: detectSkills(rawText) });
  },

  parseResume: (req: Request, res: Response) => {
    const rawText = String(req.body?.rawText ?? "");
    return res.status(200).json({ success: true, resume: parseResume(rawText) });
  },

  parseResumeWithLlm: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawText = String(req.body?.rawText ?? "");
      const parser = new LLMResumeParser();
      const resume = await parser.parseResume(rawText);
      return res.status(200).json({ success: true, resume });
    } catch (error) {
      next(error);
    }
  },

  generateEmbedding: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body;
      const service = new EmbeddingService();
      const result = await service.generateEmbedding(payload);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  storeResume: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const repository = new ResumeIngestionRepository();
      const document = {
        fileName: req.body.fileName ?? "resume.pdf",
        rawText: String(req.body.rawText ?? ""),
        name: req.body.resume?.name ?? null,
        email: null,
        phone: null,
        location: null,
        company: req.body.resume?.company ?? null,
        role: req.body.resume?.role ?? null,
        education: req.body.resume?.education ?? null,
        totalExperience: req.body.resume?.totalExperience ?? null,
        relevantExperience: null,
        skills: Array.isArray(req.body.resume?.skills) ? req.body.resume.skills : [],
        jobTitles: Array.isArray(req.body.resume?.jobTitles) ? req.body.resume.jobTitles : [],
        experienceSummary: req.body.resume?.experienceSummary ?? null,
        embedding: Array.isArray(req.body.embedding) ? req.body.embedding : [],
        embeddingModel: "mistral-embed",
        embeddingDimension: 1024,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const resumeId = await repository.insertResume(document);
      return res.status(200).json({ success: true, message: "Resume stored successfully", resumeId });
    } catch (error) {
      next(error);
    }
  },

  ingestResume: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = getUploadedFile(req) as Express.Multer.File | undefined;
      const service = new ResumeIngestionService();
      const result = await service.ingestResume(file as Express.Multer.File);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
};
