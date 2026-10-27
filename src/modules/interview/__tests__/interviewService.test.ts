import { InterviewService } from "../services/interviewService";
import type { InterviewQuestion, InterviewSession } from "../types/interviewTypes";

const match = {
  candidateId: "candidate-1", matchedRequirements: [], partialRequirements: [], notEvidencedRequirements: [],
  relevantSkills: ["Python"], relevantProjects: [], relevantExperience: [], relevantEducation: [], evidence: [], summary: "Python is documented.", analysedAt: new Date().toISOString(), jobId: "job-1",
};
const job = { jobId: "job-1", title: "AI Engineer", company: "Hire Feed", description: "Build AI services", requiredSkills: ["Python"], preferredSkills: [], technologies: ["RAG"] };
const question = (questionNumber: number): Omit<InterviewQuestion, "askedAt"> => ({ questionNumber, topic: "Python", question: `Question ${questionNumber}`, expectedAreas: ["examples"] });
const evaluation = { relevance: 4, technicalAccuracy: 4, clarity: 3, depth: 3, grounding: "SUPPORTED" as const, strengths: ["Clear"], improvements: ["Add detail"], topicsToReview: [], candidateStatedClaims: [] };

function setup() {
  let saved: InterviewSession | undefined;
  const sessions = {
    insert: jest.fn(async (session: InterviewSession) => { saved = structuredClone(session); return "session-1"; }),
    findById: jest.fn(async () => saved ? structuredClone(saved) : null),
    update: jest.fn(async (_id: string, session: InterviewSession) => { saved = structuredClone(session); }),
  };
  const questionService = {
    generate: jest.fn(async (context: { questionNumber: number }) => question(context.questionNumber)),
    generateJson: jest.fn(async () => ({ strengths: ["Clear"], topicsToReview: [], technicalAreas: [], communicationAreas: [], recommendedPractice: [] })),
  };
  const evaluator = { evaluate: jest.fn(async () => evaluation) };
  const service = new InterviewService(sessions as any, { findByJobId: jest.fn(async () => job) } as any, { analyseJobMatch: jest.fn(async () => match) } as any, questionService as any, evaluator as any);
  return { service, sessions, questionService, evaluator, read: () => saved };
}

describe("InterviewService", () => {
  it("creates a session from the existing job and resume match services", async () => {
    const { service, sessions, read } = setup();
    const result = await service.create({ jobId: "job-1" });
    expect(result).toEqual({ sessionId: "session-1", status: "created" });
    expect(sessions.insert).toHaveBeenCalledTimes(1);
    expect(read()?.resumeMatch.relevantSkills).toEqual(["Python"]);
    expect(read()?.jobTitle).toBe("AI Engineer");
    expect(read()?.status).toBe("created");
  });

  it("starts, evaluates answers, adapts next questions, and stores final feedback", async () => {
    const { service, questionService, read } = setup();
    await service.create({ jobId: "job-1", totalQuestions: 5 });
    expect(await service.start("session-1")).toMatchObject({ questionNumber: 1, question: "Question 1" });
    const result = await service.submitAnswer("session-1", 1, "I have used Python.");
    expect(result).toMatchObject({ evaluation: { grounding: "SUPPORTED" }, nextQuestion: { questionNumber: 2 }, completed: false });
    expect(questionService.generate).toHaveBeenCalledWith(expect.objectContaining({ previousAnswer: "I have used Python.", previousEvaluation: evaluation }));
    for (let number = 2; number <= 5; number++) await service.submitAnswer("session-1", number, "Answer");
    const completed = await service.complete("session-1");
    expect(completed.status).toBe("completed");
    expect(read()?.completedAt).toBeTruthy();
    expect(read()?.overallFeedback?.strengths).toEqual(["Clear"]);
  });

  it("rejects invalid configuration, empty answers, and duplicate or out of order answers", async () => {
    const { service } = setup();
    await expect(service.create({ jobId: "job-1", totalQuestions: 7 })).rejects.toMatchObject({ errorCode: "INVALID_INTERVIEW_CONFIGURATION" });
    await service.create({ jobId: "job-1", totalQuestions: 5 });
    await service.start("session-1");
    await expect(service.submitAnswer("session-1", 1, "   ")).rejects.toMatchObject({ errorCode: "INVALID_INTERVIEW_ANSWER" });
    await expect(service.submitAnswer("session-1", 2, "Answer")).rejects.toMatchObject({ errorCode: "QUESTION_NUMBER_MISMATCH" });
    await service.submitAnswer("session-1", 1, "Answer");
    await expect(service.submitAnswer("session-1", 1, "Again")).rejects.toMatchObject({ errorCode: "QUESTION_NUMBER_MISMATCH" });
  });

  it("keeps an unsupported statement separate from resume evidence", async () => {
    const { service, evaluator, read } = setup();
    evaluator.evaluate.mockResolvedValue({ ...evaluation, grounding: "NOT_EVIDENCED", candidateStatedClaims: ["Candidate stated Kubernetes experience"] } as any);
    await service.create({ jobId: "job-1", totalQuestions: 5 });
    await service.start("session-1");
    await service.submitAnswer("session-1", 1, "I used Kubernetes at work.");
    expect(read()?.resumeMatch.relevantSkills).toEqual(["Python"]);
    expect(read()?.questions[0].evaluation?.candidateStatedClaims).toEqual(["Candidate stated Kubernetes experience"]);
  });
});
