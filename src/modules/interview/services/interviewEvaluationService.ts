import type { InterviewAnswerEvaluation, InterviewQuestion, InterviewSession } from "../types/interviewTypes";
import { InterviewPromptService } from "./interviewPromptService";
import { InterviewQuestionService, isObject, modelOutputError } from "./interviewQuestionService";

export class InterviewEvaluationService {
  constructor(private readonly questions = new InterviewQuestionService(), private readonly prompts = new InterviewPromptService()) {}
  async evaluate(session: InterviewSession, question: InterviewQuestion, transcript: string): Promise<InterviewAnswerEvaluation> {
    const value = await this.questions.generateJson(this.prompts.evaluation({
      question: question.question, expectedAreas: question.expectedAreas, transcript, jobTitle: session.jobTitle,
      requiredSkills: session.jobContext.requiredSkills,
      resumeEvidence: { matched: session.resumeMatch.matchedRequirements, partial: session.resumeMatch.partialRequirements, notEvidenced: session.resumeMatch.notEvidencedRequirements, relevantSkills: session.resumeMatch.relevantSkills, relevantProjects: session.resumeMatch.relevantProjects, relevantExperience: session.resumeMatch.relevantExperience, relevantEducation: session.resumeMatch.relevantEducation, evidence: session.resumeMatch.evidence },
    }));
    if (!isObject(value)) throw modelOutputError("Answer evaluation returned invalid structured data");
    const score = (key: string) => Number.isInteger(value[key]) && Number(value[key]) >= 1 && Number(value[key]) <= 5 ? Number(value[key]) : undefined;
    const strings = (key: string) => Array.isArray(value[key]) && value[key].every((item) => typeof item === "string") ? (value[key] as string[]).slice(0, 8).map((item) => item.slice(0, 300)) : undefined;
    const relevance = score("relevance"), technicalAccuracy = score("technicalAccuracy"), clarity = score("clarity"), depth = score("depth");
    const strengths = strings("strengths"), improvements = strings("improvements"), topicsToReview = strings("topicsToReview"), candidateStatedClaims = strings("candidateStatedClaims");
    if (!relevance || !technicalAccuracy || !clarity || !depth || !strengths || !improvements || !topicsToReview || !candidateStatedClaims || !["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_EVIDENCED"].includes(String(value.grounding))) throw modelOutputError("Answer evaluation returned fields outside the required schema");
    return { relevance, technicalAccuracy, clarity, depth, grounding: value.grounding as InterviewAnswerEvaluation["grounding"], strengths, improvements, topicsToReview, candidateStatedClaims, ...(typeof value.followUpQuestion === "string" && value.followUpQuestion.trim() ? { followUpQuestion: value.followUpQuestion.trim().slice(0, 1000) } : {}) };
  }
}
