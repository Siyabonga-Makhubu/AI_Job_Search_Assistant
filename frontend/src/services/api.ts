import type { HealthStatus, LibraryResume, ResumeStats, SearchRequest, SearchResponse, DeduplicationPreview, DeduplicationResult } from '../types/api'

export type ResumeDocument = {
  resumeId: string
  name: string | null
  role: string | null
  fileName: string | null
  rawText: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(errorBody || `Request failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    return request<HealthStatus>('/v1/health')
  },

  async getDatabaseHealth(): Promise<HealthStatus> {
    return request<HealthStatus>('/v1/health/db')
  },

  async getResumeStats(): Promise<ResumeStats> {
    return request<ResumeStats>('/v1/resume/stats')
  },

  async getLibrary(): Promise<{ success: boolean; resumes: LibraryResume[] }> {
    return request<{ success: boolean; resumes: LibraryResume[] }>('/v1/resume/library')
  },

  async search(data: SearchRequest): Promise<SearchResponse> {
    return request<SearchResponse>('/v1/resume/search', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getResume(resumeId: string): Promise<ResumeDocument> {
    const response = await request<{ success: boolean; resume: ResumeDocument }>(`/v1/resume/${encodeURIComponent(resumeId)}`)
    return response.resume
  },

  async ingestResume(file: File): Promise<{ success: boolean; message?: string; resumeId?: string }> {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch(`${API_BASE_URL}/v1/resume/ingest`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(errorBody || `Upload failed with status ${response.status}`)
    }

    return (await response.json()) as { success: boolean; message?: string; resumeId?: string }
  },

  async previewDuplicates(): Promise<DeduplicationPreview> {
    return request<DeduplicationPreview>('/v1/resume/duplicates/preview')
  },

  async deleteDuplicates(): Promise<DeduplicationResult> {
    return request<DeduplicationResult>('/v1/resume/duplicates/delete', {
      method: 'POST',
    })
  },
}
