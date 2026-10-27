import type { ObjectId } from "mongodb";
import type { JobMatchResponse } from "../../jobs/matching/types/matching.types";

export type InterviewMode = "technical" | "behavioral" | "mixed";
export type InterviewDifficulty = "junior" | "intermediate" | "advanced";
export type InterviewStatus = "created" | "in_progress" | "completed";
export type EvidenceGrounding = "SUPPORTED" | "PARTIALLY_SUPPORTED" | "NOT_EVIDENCED";
export interface InterviewAnswerEvaluation {
  relevance: number; technicalAccuracy: number; clarity: number; depth: number;
  grounding: EvidenceGrounding; strengths: string[]; improvements: string[];
  topicsToReview: string[]; candidateStatedClaims: string[]; followUpQuestion?: string;
}
export interface InterviewQuestion {
  questionNumber: number; topic: string; question: string; expectedAreas: string[];
  answerTranscript?: string; evaluation?: InterviewAnswerEvaluation; askedAt?: Date; answeredAt?: Date;
  followUpQuestionAsked?: boolean;
}
export interface InterviewFeedback {
  strengths: string[]; topicsToReview: string[]; technicalAreas: string[];
  communicationAreas: string[]; recommendedPractice: string[];
}
export interface InterviewSession {
  _id?: ObjectId | string; candidateId?: string; jobId: string; jobTitle: string; company?: string;
  mode: InterviewMode; difficulty: InterviewDifficulty; totalQuestions: number; currentQuestion: number;
  status: InterviewStatus;
  jobContext: { description: string; requiredSkills: string[]; technologies: string[] };
  resumeMatch: Pick<JobMatchResponse, "matchedRequirements" | "partialRequirements" | "notEvidencedRequirements" | "relevantSkills" | "relevantProjects" | "relevantExperience" | "relevantEducation" | "evidence" | "summary">;
  topics: Record<string, "not_covered" | "partial" | "covered">;
  questions: InterviewQuestion[]; overallFeedback?: InterviewFeedback; createdAt: Date; completedAt?: Date;
}
export interface InterviewCreateInput {
  jobId: string; candidateId?: string; mode?: InterviewMode; difficulty?: InterviewDifficulty; totalQuestions?: number;
}
export interface InterviewQuestionGenerationContext {
  jobTitle: string; jobDescription: string; requiredSkills: string[]; mode: InterviewMode;
  difficulty: InterviewDifficulty; questionNumber: number;
  topics: Record<string, "not_covered" | "partial" | "covered">;
  questions: InterviewQuestion[]; resumeMatch: InterviewSession["resumeMatch"];
  previousAnswer?: string; previousEvaluation?: InterviewAnswerEvaluation;
}
