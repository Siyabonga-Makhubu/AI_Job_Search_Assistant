import type { ApplicationDraft, ApplicationMessageOptions, ApplicationMessageType, ApplicationStatus, CombinedAnalysis, EvaluationResult, EvaluationSettings, InterviewPreparation, Job, JobConfig, JobDashboardOverview, JobIngestionResult, JobSearchResult, MatchAnalysis, TailoredCv, TailoredCvEdits } from '../types/jobs'

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
    const apiError = body && typeof body === 'object' ? body as { message?: string; errorCode?: string } : undefined
    if (response.status === 404) throw new Error(apiError?.message ?? 'Job or candidate profile not found.')
    if (response.status === 503) throw new Error(apiError?.message ?? 'The job or candidate evidence service is currently unavailable.')
    if (response.status >= 500) throw new Error(apiError?.message ?? 'The request could not be completed. Please try again.')
    throw new Error(apiError?.message ?? `Request was rejected (${response.status}). Check the submitted information.`)
  }
  return body as T
}

export const jobsApi = {
  async getConfig(): Promise<JobConfig> {
    const result = await request<{ success: boolean; config: JobConfig }>('/v1/jobs/config')
    return result.config
  },
  getOverview(): Promise<JobDashboardOverview> {
    return request<{ success: boolean } & JobDashboardOverview>('/v1/jobs/overview')
  },
  search(data: { query: string; location?: string; remote?: boolean; topK?: number; mode?: 'hybrid' | 'vector' | 'bm25'; source?: string }) {
    return request<{ success: boolean; results: JobSearchResult[] }>('/v1/jobs/search', { method: 'POST', body: JSON.stringify(data) })
  },
  async getEvaluationHistory(): Promise<{ settings: EvaluationSettings; results: EvaluationResult[] }> {
    const result = await request<{ success: boolean; settings: EvaluationSettings; results: EvaluationResult[] }>('/v1/jobs/evaluations')
    return result
  },
  async runEvaluation(data: { query: string; jobIds: string[] }): Promise<{ runId: string; results: EvaluationResult[] }> {
    return request<{ success: boolean; runId: string; results: EvaluationResult[] }>('/v1/jobs/evaluations/run', { method: 'POST', body: JSON.stringify(data) })
  },
  async getJob(jobId: string): Promise<Job> {
    const result = await request<{ success: boolean; job: Job }>(`/v1/jobs/${encodeURIComponent(jobId)}`)
    return result.job
  },
  async getSavedJobs(): Promise<Job[]> {
    const result = await request<{ success: boolean; jobs: Job[] }>('/v1/jobs/saved')
    return result.jobs
  },
  async saveJob(jobId: string): Promise<Job> {
    const result = await request<{ success: boolean; job: Job }>(`/v1/jobs/${encodeURIComponent(jobId)}/save`, { method: 'POST', body: JSON.stringify({}) })
    return result.job
  },
  async updateStatus(jobId: string, status: ApplicationStatus): Promise<Job> {
    const result = await request<{ success: boolean; job: Job }>(`/v1/jobs/${encodeURIComponent(jobId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    return result.job
  },
  async updateApplication(jobId: string, data: { status?: ApplicationStatus; appliedAt?: string | null; interviewDate?: string | null; applicationMessage?: string; matchAnalysis?: MatchAnalysis; interviewPreparation?: InterviewPreparation }): Promise<Job> {
    const result = await request<{ success: boolean; job: Job }>(`/v1/jobs/${encodeURIComponent(jobId)}/application`, { method: 'PATCH', body: JSON.stringify(data) })
    return result.job
  },
  async getTailoredCv(jobId: string): Promise<TailoredCv> {
    const result = await request<{ success: boolean; cv: TailoredCv }>(`/v1/jobs/${encodeURIComponent(jobId)}/tailored-cv`)
    return result.cv
  },
  async generateTailoredCv(jobId: string): Promise<TailoredCv> {
    const result = await request<{ success: boolean; cv: TailoredCv }>(`/v1/jobs/${encodeURIComponent(jobId)}/tailored-cv`, { method: 'POST', body: JSON.stringify({}) })
    return result.cv
  },
  async saveTailoredCv(jobId: string, data: TailoredCvEdits): Promise<TailoredCv> {
    const result = await request<{ success: boolean; cv: TailoredCv }>(`/v1/jobs/${encodeURIComponent(jobId)}/tailored-cv`, { method: 'PUT', body: JSON.stringify(data) })
    return result.cv
  },
  match(jobId: string) {
    return request<{ success: boolean; match: MatchAnalysis }>(`/v1/jobs/${encodeURIComponent(jobId)}/match`, { method: 'POST', body: JSON.stringify({}) })
  },
  analyse(jobId: string) {
    return request<{ success: boolean } & CombinedAnalysis>(`/v1/jobs/${encodeURIComponent(jobId)}/analyse`, { method: 'POST', body: JSON.stringify({}) })
  },
  applicationMessage(jobId: string, messageType: ApplicationMessageType = 'Recruiter message', options: ApplicationMessageOptions = {}) {
    return request<{ success: boolean } & ApplicationDraft>(`/v1/jobs/${encodeURIComponent(jobId)}/application-message`, { method: 'POST', body: JSON.stringify({ messageType, options }) })
  },
  interviewChat(jobId: string, question: string, history: { role: 'user' | 'assistant'; content: string }[]) {
    return request<{ success: boolean; answer: string }>(`/v1/jobs/${encodeURIComponent(jobId)}/interview-chat`, { method: 'POST', body: JSON.stringify({ question, history }) })
  },
  ingest(url: string) {
    return request<JobIngestionResult>('/v1/jobs/ingest', { method: 'POST', body: JSON.stringify({ url }) })
  },
  async ingestResume(file: File): Promise<{ success: boolean; message?: string; resumeId?: string; data?: { name?: string | null; role?: string | null } }> {
    const form = new FormData()
    form.append('file', file)
    let response: Response
    try {
      response = await fetch(`${baseUrl}/v1/resume/ingest`, { method: 'POST', body: form })
    } catch {
      throw new Error('Unable to connect to the Resume RAG API. Check that the backend is running.')
    }
    const body = await response.json().catch(() => null) as { message?: string; data?: { name?: string | null; role?: string | null }; resumeId?: string } | null
    if (!response.ok) throw new Error(body?.message ?? 'Unable to ingest this CV.')
    return body as { success: boolean; message?: string; resumeId?: string; data?: { name?: string | null; role?: string | null } }
  },
  discover(data: { query?: string; location?: string; remote?: boolean; topK?: number }) {
    return request<{ success: boolean; discovered: number; ingested: JobIngestionResult[] }>('/v1/jobs/discover', { method: 'POST', body: JSON.stringify(data) })
  },
}
