import type { NextFunction, Request, Response } from "express";
import { InterviewService } from "../services/interviewService";
const service = new InterviewService();

export const interviewController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body ?? {};
      if (typeof body.jobId !== "string" || !body.jobId.trim()) throw Object.assign(new Error("jobId is required"), { statusCode: 400, errorCode: "INVALID_INTERVIEW_CONFIGURATION" });
      if (body.candidateId !== undefined && (typeof body.candidateId !== "string" || !body.candidateId.trim())) throw Object.assign(new Error("candidateId must be a non-empty string"), { statusCode: 400, errorCode: "INVALID_CANDIDATE_ID" });
      res.status(201).json(await service.create({ jobId: body.jobId.trim(), candidateId: body.candidateId, mode: body.mode, difficulty: body.difficulty, totalQuestions: body.totalQuestions }));
    } catch (error) { next(error); }
  },
  start: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(await service.start(String(req.params.sessionId))); } catch (error) { next(error); }
  },
  answer: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { questionNumber, transcript } = req.body ?? {};
      if (!Number.isInteger(questionNumber) || typeof transcript !== "string") throw Object.assign(new Error("questionNumber and transcript are required"), { statusCode: 400, errorCode: "INVALID_INTERVIEW_ANSWER" });
      res.status(200).json(await service.submitAnswer(String(req.params.sessionId), questionNumber, transcript));
    } catch (error) { next(error); }
  },
  complete: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(await service.complete(String(req.params.sessionId))); } catch (error) { next(error); }
  },
  get: async (req: Request, res: Response, next: NextFunction) => {
    try { res.status(200).json(await service.get(String(req.params.sessionId))); } catch (error) { next(error); }
  },
};
