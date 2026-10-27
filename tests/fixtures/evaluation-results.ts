/**
 * DeepEval evaluation fixtures.
 *
 * Used to mock POST /v1/jobs/evaluations/run and GET /v1/jobs/evaluations
 * responses so tests never call the real Groq judge.
 */

export const RUN_ID = "run_fixture_001";

export const SAMPLE_EVAL_ALIGNMENT = {
  id: "eval_001",
  runId: RUN_ID,
  query: "Junior AI Engineer RAG Python",
  jobId: "test_job_abc123",
  jobTitle: "Junior AI Engineer",
  company: "Example Co",
  metricName: "Job-Query Alignment" as const,
  score: 0.88,
  threshold: 0.7,
  passed: true,
  reason:
    "The job title matches the query. Required skills (Python, RAG) align with the search intent.",
  timestamp: "2026-10-15T10:00:00.000Z",
  judgeModel: "openai/gpt-oss-120b",
  cached: false,
};

export const SAMPLE_EVAL_RELEVANCY = {
  id: "eval_002",
  runId: RUN_ID,
  query: "Junior AI Engineer RAG Python",
  jobId: "test_job_abc123",
  jobTitle: "Junior AI Engineer",
  company: "Example Co",
  metricName: "Contextual Relevancy" as const,
  score: 0.82,
  threshold: 0.7,
  passed: true,
  reason: "The retrieved context directly addresses the query about RAG and Python.",
  generatedAnswer:
    "This Junior AI Engineer role at Example Co requires Python and RAG experience, matching the query.",
  timestamp: "2026-10-15T10:00:00.000Z",
  judgeModel: "openai/gpt-oss-120b",
  cached: false,
};

export const SAMPLE_EVAL_FAITHFULNESS = {
  id: "eval_003",
  runId: RUN_ID,
  query: "Junior AI Engineer RAG Python",
  jobId: "test_job_abc123",
  jobTitle: "Junior AI Engineer",
  company: "Example Co",
  metricName: "Faithfulness" as const,
  score: 0.75,
  threshold: 0.7,
  passed: true,
  reason: "The generated answer is fully supported by the job listing context.",
  generatedAnswer:
    "This Junior AI Engineer role at Example Co requires Python and RAG experience, matching the query.",
  timestamp: "2026-10-15T10:00:00.000Z",
  judgeModel: "openai/gpt-oss-120b",
  cached: false,
};

export const SAMPLE_EVAL_FAILED = {
  id: "eval_004",
  runId: RUN_ID,
  query: "Junior AI Engineer RAG Python",
  jobId: "test_job_abc123",
  jobTitle: "Junior AI Engineer",
  company: "Example Co",
  metricName: "Job-Query Alignment" as const,
  score: 0.45,
  threshold: 0.7,
  passed: false,
  reason: "The seniority level does not match the junior query intent.",
  timestamp: "2026-10-15T10:00:00.000Z",
  judgeModel: "openai/gpt-oss-120b",
  cached: false,
};

export const SAMPLE_EVAL_ERROR = {
  id: "eval_005",
  runId: RUN_ID,
  query: "Junior AI Engineer RAG Python",
  jobId: "test_job_abc123",
  jobTitle: "Junior AI Engineer",
  company: "Example Co",
  metricName: "Contextual Relevancy" as const,
  score: null,
  threshold: 0.7,
  passed: false,
  reason: "Rate limit exceeded",
  error: "Rate limit exceeded",
  timestamp: "2026-10-15T10:00:00.000Z",
  judgeModel: "openai/gpt-oss-120b",
  cached: false,
};

/** Full mock response for GET /v1/jobs/evaluations */
export const MOCK_EVAL_HISTORY_RESPONSE = {
  success: true,
  settings: {
    enabled: true,
    judgeModel: "openai/gpt-oss-120b",
    alignmentThreshold: 0.7,
    relevancyThreshold: 0.7,
    faithfulnessThreshold: 0.7,
    maxJobs: 10,
  },
  results: [SAMPLE_EVAL_ALIGNMENT, SAMPLE_EVAL_RELEVANCY, SAMPLE_EVAL_FAITHFULNESS],
};

/** Full mock response for POST /v1/jobs/evaluations/run */
export const MOCK_EVAL_RUN_RESPONSE = {
  success: true,
  runId: RUN_ID,
  results: [SAMPLE_EVAL_ALIGNMENT, SAMPLE_EVAL_RELEVANCY, SAMPLE_EVAL_FAITHFULNESS],
};

/** Mock response for evaluation config */
export const MOCK_EVAL_CONFIG_RESPONSE = {
  success: true,
  settings: {
    enabled: true,
    judgeModel: "openai/gpt-oss-120b",
    alignmentThreshold: 0.7,
    relevancyThreshold: 0.7,
    faithfulnessThreshold: 0.7,
    maxJobs: 10,
  },
};
