import fs from "node:fs/promises";
import type { Express } from "express";
import { parseResume } from "./AlgorithmResumeParser";
import { EmbeddingService } from "./EmbeddingService";
import { ResumeParserService } from "./ResumeParserService";
import { ResumeIngestionRepository } from "../repositories/ResumeIngestionRepository";
import { cleanText } from "../utils/textCleaner";

export class ResumeIngestionService {
  async ingestResume(file: Express.Multer.File): Promise<{
    success: boolean;
    message: string;
    resumeId: string;
    data: {
      name?: string | null;
      address?: string | null;
      email?: string | null;
      phone?: string | null;
      role?: string | null;
      company?: string | null;
      totalExperience?: number | null;
      skillsCount: number;
      embeddingModel: string;
      embeddingDimension: number;
    };
    timings: Record<string, number>;
  }> {
    if (!file) {
      throw Object.assign(new Error("Resume PDF is required"), {
        statusCode: 400,
        errorCode: "FILE_REQUIRED"
      });
    }

    const startedAt = Date.now();
    const extractStarted = Date.now();
    const parserService = new ResumeParserService();
    const rawText = await parserService.extractTextFromPdf(file.path);
    const extractMs = Date.now() - extractStarted;

    if (!rawText || rawText.trim().length === 0) {
      throw Object.assign(new Error("Resume extraction failed"), {
        statusCode: 422,
        errorCode: "RESUME_EXTRACTION_FAILED"
      });
    }

    const cleanStarted = Date.now();
    const cleanedText = cleanText(rawText);
    const cleanMs = Date.now() - cleanStarted;

    const parseStarted = Date.now();
    const parsedResume = parseResume(cleanedText);
    const parseMs = Date.now() - parseStarted;

    const embeddingStarted = Date.now();
    const embeddingService = new EmbeddingService();
    const embedding = await embeddingService.generateEmbedding({
      name: parsedResume.name ?? file.originalname,
      role: parsedResume.role,
      skills: parsedResume.skills,
      company: parsedResume.company,
      experienceSummary: parsedResume.experienceSummary,
      rawText: cleanedText
    });
    const embeddingMs = Date.now() - embeddingStarted;

    const resumeDocument = {
      fileName: file.originalname,
      rawText: cleanedText,
      name: parsedResume.name,
      address: parsedResume.address,
      email: parsedResume.email,
      phone: parsedResume.phone,
      location: parsedResume.location,
      company: parsedResume.company,
      role: parsedResume.role,
      education: parsedResume.education,
      totalExperience: parsedResume.totalExperience,
      relevantExperience: parsedResume.relevantExperience,
      skills: parsedResume.skills,
      jobTitles: parsedResume.jobTitles,
      experienceSummary: parsedResume.experienceSummary,
      embedding: embedding.embedding,
      embeddingModel: embedding.model,
      embeddingDimension: embedding.dimension,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const mongoStarted = Date.now();
    const repository = new ResumeIngestionRepository();
    const resumeId = await repository.insertResume(resumeDocument);
    const mongoInsertMs = Date.now() - mongoStarted;

    await fs.unlink(file.path).catch(() => undefined);

    return {
      success: true,
      message: "Resume ingestion completed",
      resumeId,
      data: {
        name: parsedResume.name,
        address: parsedResume.address,
        email: parsedResume.email,
        phone: parsedResume.phone,
        role: parsedResume.role,
        company: parsedResume.company,
        totalExperience: parsedResume.totalExperience,
        skillsCount: parsedResume.skills.length,
        embeddingModel: embedding.model,
        embeddingDimension: embedding.dimension
      },
      timings: {
        extractMs,
        cleanMs,
        parseMs,
        embeddingMs,
        mongoInsertMs,
        totalMs: Date.now() - startedAt
      }
    };
  }
}
