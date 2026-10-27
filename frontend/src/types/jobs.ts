export const APPLICATION_STATUSES = ['SAVED', 'ANALYSED', 'APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'CLOSED'] as const
export type ApplicationStatus = typeof APPLICATION_STATUSES[number]

export type InterviewPreparation = {
  preparedAt: string
  focusTopics: string[]
  discussionAreas: string[]
  resumeEvidence: string[]
}

export type TailoredCv = {
  jobId: string
  jobTitle: string
  company?: string
  generatedAt: string
  savedAt?: string
  personalDetails: { name: string; email: string; phone: string; location: string; linkedin: string; github: string; portfolio: string }
  headline: string
  professionalSummary: string
  technicalSkills: { category: string; skills: string[] }[]
  projects: { title: string; details: string[] }[]
  experience: { title: string; details: string[] }[]
  certificationsAndAchievements: string[]
  /** Legacy fields kept readable for CV drafts saved before section formatting. */
  skills: string[]
  relevantExperience: string[]
  matchedRequirements: string[]
  partialRequirements: string[]
  education: string
}

export type TailoredCvEdits = {
  personalDetails: Omit<TailoredCv['personalDetails'], 'name'>
  education: string
  projects: TailoredCv['projects']
  experience: TailoredCv['experience']
  certificationsAndAchievements: string[]
}

export type Job = {
  jobId: string
  title: string
  company?: string
  location?: string
  remote?: boolean
  employmentType?: string
  source: { provider: string; site?: string; url: string }
  description: string
  responsibilities: string[]
  requiredSkills: string[]
  preferredSkills: string[]
  technologies: string[]
  qualifications: string[]
  experienceRequirements: string[]
  educationRequirements: string[]
  publishedAt?: string
  discoveredAt?: string
  external?: boolean
  savedAt?: string
  status?: ApplicationStatus
  appliedAt?: string | null
  interviewDate?: string | null
  applicationMessage?: string
  matchAnalysis?: MatchAnalysis
  interviewPreparation?: InterviewPreparation
  tailoredCv?: TailoredCv
}

export type JobSearchResult = { job: Job; vectorScore?: number; keywordScore?: number; hybridScore?: number }
export type JobActivity = {
  type: 'job_discovered' | 'job_saved' | 'application_submitted' | 'interview_scheduled' | 'resume_match' | 'tailored_cv_saved' | 'interview_prepared'
  jobId: string
  title: string
  company?: string
  occurredAt: string
}
export type JobDashboardOverview = {
  stats: { totalJobs: number; savedJobs: number; applications: number; interviews: number; offers: number }
  activity: JobActivity[]
}
export type CandidateEvidence = { source: string; name?: string; text: string; technology?: string }
export type RequirementMatch = { requirement: string; status: 'MATCHED' | 'PARTIAL' | 'NOT_EVIDENCED'; evidence: CandidateEvidence[] }
export type MatchAnalysis = {
  jobId: string
  candidateId: string
  matchedRequirements: RequirementMatch[]
  partialRequirements: RequirementMatch[]
  notEvidencedRequirements: RequirementMatch[]
  relevantSkills: string[]
  relevantProjects: string[]
  relevantExperience: string[]
  relevantEducation: string[]
  evidence: CandidateEvidence[]
  summary: string
  analysedAt: string
}
export type CombinedAnalysis = {
  job: { jobId: string; title: string; company?: string; location?: string; url: string }
  match: { matched: RequirementMatch[]; partial: RequirementMatch[]; notEvidenced: RequirementMatch[] }
  candidateEvidence: CandidateEvidence[]
  applicationMessage: string
  evidenceUsed: string[]
  applicationDraft?: { status: string; historyId: string }
  summary: string
}
export type ApplicationDraft = {
  jobId: string
  candidateId: string
  message: string
  messageType: string
  evidenceUsed: string[]
  status: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'REJECTED'
  historyId: string
}
export type ApplicationMessageType = 'Recruiter message' | 'Cover letter' | 'Email' | 'LinkedIn message'
export type ApplicationMessageOptions = { company?: string; companyAddress?: string; recipient?: string; senderName?: string; subject?: string }
export type JobIngestionResult = { success: boolean; message: string; jobId: string; alreadyExisted: boolean; job: Pick<Job, 'jobId' | 'title' | 'company' | 'location' | 'source'> }
export type JobConfig = { searchRoles: string[]; searchLocation: string; searchRemote: boolean; searchProviderConfigured: boolean; searchSources: { name: string; label: string }[] }

export type EvaluationMetricName = 'Contextual Relevancy' | 'Faithfulness' | 'Job-Query Alignment'
export type EvaluationResult = {
  id?: string
  runId: string
  query: string
  jobId: string | null
  jobTitle: string | null
  company: string | null
  metricName: EvaluationMetricName
  score: number | null
  threshold: number
  passed: boolean
  reason: string | null
  generatedAnswer?: string
  error?: string
  timestamp: string
  judgeModel: string
  cached: boolean
}
export type EvaluationSettings = {
  enabled: boolean
  judgeModel: string
  alignmentThreshold: number
  relevancyThreshold: number
  faithfulnessThreshold: number
  maxJobs: number
}
