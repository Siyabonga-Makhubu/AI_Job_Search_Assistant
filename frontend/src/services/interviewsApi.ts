import type { InterviewAnswerEvaluation, InterviewDifficulty, InterviewFeedback, InterviewMode, InterviewQuestion, InterviewSession } from '../types/interview'

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new Error('Unable to connect to the Resume RAG API. Check that the backend is running.')
  }

  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const apiError = body && typeof body === 'object' ? body as { message?: string } : undefined
    throw new Error(apiError?.message ?? 'The interview request could not be completed.')
  }
  return body as T
}

export const interviewsApi = {
  create(input: { jobId: string; mode: InterviewMode; difficulty: InterviewDifficulty; totalQuestions: number }) {
    return request<{ sessionId: string; status: 'created' }>('/v1/interviews', { method: 'POST', body: JSON.stringify(input) })
  },
  start(sessionId: string) {
    return request<InterviewQuestion>(`/v1/interviews/${encodeURIComponent(sessionId)}/start`, { method: 'POST' })
  },
  get(sessionId: string) {
    return request<InterviewSession>(`/v1/interviews/${encodeURIComponent(sessionId)}`)
  },
  answer(sessionId: string, questionNumber: number, transcript: string) {
    return request<{ evaluation: InterviewAnswerEvaluation; nextQuestion?: InterviewQuestion; completed: boolean }>(`/v1/interviews/${encodeURIComponent(sessionId)}/answers`, {
      method: 'POST',
      body: JSON.stringify({ questionNumber, transcript }),
    })
  },
  complete(sessionId: string) {
    return request<{ sessionId: string; status: 'completed'; feedback: InterviewFeedback }>(`/v1/interviews/${encodeURIComponent(sessionId)}/complete`, { method: 'POST' })
  },
}