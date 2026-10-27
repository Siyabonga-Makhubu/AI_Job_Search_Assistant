export const EVALUATION_METRICS = [
  "Contextual Relevancy",
  "Faithfulness",
  "Job-Query Alignment",
] as const;

export type EvaluationMetricName = typeof EVALUATION_METRICS[number];

export type EvaluationMetricOutput = {
  query: string;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  metricName: EvaluationMetricName;
  score: number | null;
  threshold: number;
  passed: boolean;
  reason: string | null;
  generatedAnswer?: string;
  timestamp: Date;
  judgeModel: string;
  error?: string;
};

export type EvaluationResultDocument = EvaluationMetricOutput & {
  runId: string;
  cached: boolean;
};

export type EvaluationCacheDocument = EvaluationMetricOutput & {
  cacheKey: string;
};

export type EvaluationRunRequest = {
  query: string;
  jobIds: string[];
};

export type EvaluationHistoryFilters = {
  query?: string;
  from?: Date;
  to?: Date;
  metricName?: EvaluationMetricName;
  passed?: boolean;
};

export type EvaluationSettings = {
  enabled: boolean;
  judgeModel: string;
  alignmentThreshold: number;
  relevancyThreshold: number;
  faithfulnessThreshold: number;
  maxJobs: number;
};
