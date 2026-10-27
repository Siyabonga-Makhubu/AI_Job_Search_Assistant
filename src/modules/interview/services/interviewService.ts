import { JobRepository } from "../../jobs/ingestion/repositories/JobRepository";
import { JobMatchingService } from "../../jobs/matching/services/JobMatchingService";
import { InterviewSessionRepository } from "../models/interviewSession";
import type { InterviewAnswerEvaluation, InterviewCreateInput, InterviewFeedback, InterviewQuestion, InterviewSession } from "../types/interviewTypes";
import { InterviewEvaluationService } from "./interviewEvaluationService";
import { InterviewPromptService } from "./interviewPromptService";
import { InterviewQuestionService, isObject, modelOutputError } from "./interviewQuestionService";

export class InterviewService {
  constructor(
    private readonly sessions = new InterviewSessionRepository(), private readonly jobs = new JobRepository(),
    private readonly matching = new JobMatchingService(), private readonly questionService = new InterviewQuestionService(),
    private readonly evaluationService = new InterviewEvaluationService(), private readonly prompts = new InterviewPromptService(),
  ) {}

  async create(input: InterviewCreateInput): Promise<{ sessionId: string; status: "created" }> {
    const mode = input.mode ?? "technical", difficulty = input.difficulty ?? "junior", totalQuestions = input.totalQuestions ?? 10;
    if (!input.jobId || !["technical", "behavioral", "mixed"].includes(mode) || !["junior", "intermediate", "advanced"].includes(difficulty) || ![5, 10, 15].includes(totalQuestions)) {
      throw Object.assign(new Error("Use a jobId, supported mode and difficulty, and 5, 10, or 15 questions"), { statusCode: 400, errorCode: "INVALID_INTERVIEW_CONFIGURATION" });
    }
    const job = await this.jobs.findByJobId(input.jobId);
    if (!job) throw Object.assign(new Error(`Job not found: ${input.jobId}`), { statusCode: 404, errorCode: "JOB_NOT_FOUND" });
    const match = await this.matching.analyseJobMatch({ jobId: job.jobId, candidateId: input.candidateId });
    const topicNames = [...new Set([...job.requiredSkills, ...job.technologies, ...match.relevantSkills].map((item) => item.trim()).filter(Boolean))].slice(0, 30);
    const session: InterviewSession = {
      candidateId: match.candidateId, jobId: job.jobId, jobTitle: job.title, company: job.company, mode, difficulty,
      totalQuestions, currentQuestion: 0, status: "created",
      jobContext: { description: (job.description ?? "").slice(0, 12000), requiredSkills: [...new Set([...job.requiredSkills, ...job.preferredSkills])].slice(0, 40), technologies: job.technologies.slice(0, 40) },
      resumeMatch: { matchedRequirements: match.matchedRequirements, partialRequirements: match.partialRequirements, notEvidencedRequirements: match.notEvidencedRequirements, relevantSkills: match.relevantSkills, relevantProjects: match.relevantProjects, relevantExperience: match.relevantExperience, relevantEducation: match.relevantEducation, evidence: match.evidence, summary: match.summary },
      topics: Object.fromEntries(topicNames.map((topic) => [topic, "not_covered"])), questions: [], createdAt: new Date(),
    };
    return { sessionId: await this.sessions.insert(session), status: "created" };
  }

  async start(sessionId: string): Promise<InterviewQuestion> {
    const session = await this.requireSession(sessionId);
    if (session.status !== "created") throw stateError("Interview has already started or is completed");
    const question = await this.nextQuestion(session, 1);
    session.questions.push({ ...question, askedAt: new Date() });
    session.currentQuestion = 1; session.status = "in_progress";
    await this.sessions.update(sessionId, session);
    return question;
  }

  async submitAnswer(sessionId: string, questionNumber: number, transcript: string): Promise<{ evaluation: InterviewAnswerEvaluation; nextQuestion?: InterviewQuestion; completed: boolean }> {
    const session = await this.requireSession(sessionId);
    if (session.status !== "in_progress") throw stateError("Interview is not accepting answers");
    if (questionNumber !== session.currentQuestion) throw Object.assign(new Error("questionNumber does not match the active question"), { statusCode: 409, errorCode: "QUESTION_NUMBER_MISMATCH" });
    if (typeof transcript !== "string" || !transcript.trim() || transcript.length > 12000) throw Object.assign(new Error("transcript must be a non-empty string of at most 12000 characters"), { statusCode: 400, errorCode: "INVALID_INTERVIEW_ANSWER" });
    const question = session.questions.find((item) => item.questionNumber === questionNumber);
    if (!question || question.answerTranscript !== undefined) throw Object.assign(new Error("Question is missing or already answered"), { statusCode: 409, errorCode: "DUPLICATE_INTERVIEW_ANSWER" });
    const evaluation = await this.evaluationService.evaluate(session, question, transcript.trim());
    question.answerTranscript = transcript.trim(); question.evaluation = evaluation; question.answeredAt = new Date();
    this.updateTopics(session, question, evaluation);
    let nextQuestion: InterviewQuestion | undefined;
    if (questionNumber < session.totalQuestions) {
      const alreadyFollowedUp = session.questions.some((item) => item.questionNumber === questionNumber && item.followUpQuestionAsked);
      if (evaluation.followUpQuestion && !alreadyFollowedUp) {
        question.followUpQuestionAsked = true;
        nextQuestion = { questionNumber: questionNumber + 1, topic: question.topic, question: evaluation.followUpQuestion, expectedAreas: question.expectedAreas, askedAt: new Date() };
      } else {
        nextQuestion = { ...await this.nextQuestion(session, questionNumber + 1, transcript.trim(), evaluation), askedAt: new Date() };
      }
      session.questions.push(nextQuestion); session.currentQuestion = questionNumber + 1;
    }
    await this.sessions.update(sessionId, session);
    return { evaluation, ...(nextQuestion ? { nextQuestion } : {}), completed: !nextQuestion };
  }

  async complete(sessionId: string): Promise<{ sessionId: string; status: "completed"; feedback: InterviewFeedback }> {
    const session = await this.requireSession(sessionId);
    if (session.status === "completed" && session.overallFeedback) return { sessionId, status: "completed", feedback: session.overallFeedback };
    if (session.status !== "in_progress" || session.questions.some((question) => question.answerTranscript === undefined)) throw Object.assign(new Error("Answer the active question before completing the interview"), { statusCode: 409, errorCode: "INTERVIEW_INCOMPLETE" });
    const value = await this.questionService.generateJson(this.prompts.finalFeedback({ jobTitle: session.jobTitle, questions: session.questions.map(({ question, answerTranscript, evaluation }) => ({ question, answerTranscript, evaluation })), topics: session.topics }));
    if (!isObject(value)) throw modelOutputError("Final feedback returned invalid structured data");
    const array = (key: string) => Array.isArray(value[key]) && value[key].every((item) => typeof item === "string") ? (value[key] as string[]).slice(0, 12).map((item) => item.slice(0, 300)) : undefined;
    const strengths = array("strengths"), topicsToReview = array("topicsToReview"), technicalAreas = array("technicalAreas"), communicationAreas = array("communicationAreas"), recommendedPractice = array("recommendedPractice");
    if (!strengths || !topicsToReview || !technicalAreas || !communicationAreas || !recommendedPractice) throw modelOutputError("Final feedback returned fields outside the required schema");
    session.overallFeedback = { strengths, topicsToReview, technicalAreas, communicationAreas, recommendedPractice };
    session.status = "completed"; session.completedAt = new Date();
    await this.sessions.update(sessionId, session);
    return { sessionId, status: "completed", feedback: session.overallFeedback };
  }

  async get(sessionId: string): Promise<InterviewSession> { return this.requireSession(sessionId); }
  private async requireSession(id: string): Promise<InterviewSession> {
    const session = await this.sessions.findById(id);
    if (!session) throw Object.assign(new Error("Interview session not found"), { statusCode: 404, errorCode: "INTERVIEW_SESSION_NOT_FOUND" });
    return session;
  }
  private async nextQuestion(session: InterviewSession, number: number, previousAnswer?: string, previousEvaluation?: InterviewAnswerEvaluation) {
    return this.questionService.generate({ jobTitle: session.jobTitle, jobDescription: session.jobContext.description, requiredSkills: session.jobContext.requiredSkills, mode: session.mode, difficulty: session.difficulty, questionNumber: number, topics: session.topics, questions: session.questions, resumeMatch: session.resumeMatch, previousAnswer, previousEvaluation });
  }
  private updateTopics(session: InterviewSession, question: InterviewQuestion, evaluation: InterviewAnswerEvaluation): void {
    session.topics[question.topic] = evaluation.relevance >= 4 && evaluation.depth >= 3 ? "covered" : "partial";
    for (const topic of evaluation.topicsToReview) if (topic in session.topics && session.topics[topic] !== "covered") session.topics[topic] = "partial";
  }
}

function stateError(message: string): Error { return Object.assign(new Error(message), { statusCode: 409, errorCode: "INVALID_INTERVIEW_STATE" }); }
