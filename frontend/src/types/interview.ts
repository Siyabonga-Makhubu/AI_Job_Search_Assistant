export type InterviewMode = 'technical' | 'behavioral' | 'mixed'
export type InterviewDifficulty = 'junior' | 'intermediate' | 'advanced'
export type InterviewTopicStatus = 'not_covered' | 'partial' | 'covered'

export type InterviewQuestion = {
  questionNumber: number
  topic: string
  question: string
  expectedAreas: string[]
}

export type InterviewAnswerEvaluation = {
  relevance: number
  technicalAccuracy: number
  clarity: number
  depth: number
  grounding: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'NOT_EVIDENCED'
  strengths: string[]
  improvements: string[]
  topicsToReview: string[]
}

export type InterviewFeedback = {
  strengths: string[]
  topicsToReview: string[]
  technicalAreas: string[]
  communicationAreas: string[]
  recommendedPractice: string[]
}

export type InterviewSession = {
  _id?: string
  jobId: string
  jobTitle: string
  company?: string
  mode: InterviewMode
  difficulty: InterviewDifficulty
  totalQuestions: number
  currentQuestion: number
  status: 'created' | 'in_progress' | 'completed'
  topics: Record<string, InterviewTopicStatus>
  questions: (InterviewQuestion & { answerTranscript?: string; evaluation?: InterviewAnswerEvaluation })[]
  overallFeedback?: InterviewFeedback
}