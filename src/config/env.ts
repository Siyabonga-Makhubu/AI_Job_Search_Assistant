import dotenv from "dotenv";

dotenv.config();

export const env = {
  // ── Server ────────────────────────────────────────────────────────────────
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),

  // ── MongoDB ───────────────────────────────────────────────────────────────
  mongodbUri: process.env.MONGODB_URI,
  mongodbDbName: process.env.MONGODB_DB_NAME ?? "rag_ingestion_resume",
  mongodbCollectionName: process.env.MONGODB_COLLECTION_NAME ?? "rag_ingestion_resume",

  // ── Mistral embeddings ────────────────────────────────────────────────────
  mistralApiKey: process.env.MISTRAL_API_KEY,
  mistralEmbedModel: process.env.MISTRAL_EMBED_MODEL ?? "mistral-embed",
  // All chat/LLM features use this centralized Groq configuration.
  groqApiKey: process.env.GROQ_API_KEY,
  // llama-3.3-70b-versatile was deprecated for developer/free tiers in 2026.
  // Keep the fallback on a current production model with tool-use support.
  groqModel: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  retrievalLlmReranking: process.env.RETRIEVAL_LLM_RERANKING?.trim().toLowerCase() === "true",
  resumeVectorIndexName: process.env.RESUME_VECTOR_INDEX_NAME ?? "resume_vector_index",
  llmConfigured: Boolean(process.env.GROQ_API_KEY),
  embeddingDimension: Number(process.env.EMBEDDING_DIMENSION ?? 1024),

  // ── Resume ingestion ──────────────────────────────────────────────────────
  useLlmParser: process.env.USE_LLM_PARSER?.trim().toLowerCase() === "true",
  maxUploadSizeMb: Number(process.env.MAX_UPLOAD_SIZE_MB ?? 5),

  // ── Jobs — discovery ──────────────────────────────────────────────────────
  /**
   * Comma-separated list of target AI/ML job roles to search for.
   * Example: "Junior AI Engineer,AI Engineer,Generative AI Engineer"
   */
  jobSearchRoles: (
    process.env.JOB_SEARCH_ROLES ??
    "Entry-level AI Engineer,Junior AI Engineer,AI Engineer,Generative AI Engineer,LLM Engineer,RAG Engineer"
  )
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean),

  jobSearchLocation: process.env.JOB_SEARCH_LOCATION ?? "South Africa",
  jobSearchRemote: process.env.JOB_SEARCH_REMOTE?.trim().toLowerCase() === "true",
  adzunaAppId: process.env.ADZUNA_APP_ID,
  adzunaAppKey: process.env.ADZUNA_APP_KEY,
  jsearchApiKey: process.env.JSEARCH_API_KEY,
  linkedInJobsApiKey: process.env.LINKEDIN_JOBS_API_KEY,
  linkedInJobsApiUrl: process.env.LINKEDIN_JOBS_API_URL,

  // ── Jobs — MongoDB ────────────────────────────────────────────────────────
  jobCollectionName: process.env.JOB_COLLECTION_NAME ?? "jobs",

  /** Name of the Atlas vector-search index on the jobs collection. */
  jobVectorIndexName: process.env.JOB_VECTOR_INDEX_NAME ?? "job_vector_index",

  /** Name of the Atlas full-text / BM25-compatible search index on the jobs collection. */
  jobSearchIndexName: process.env.JOB_SEARCH_INDEX_NAME ?? "job_search_index",

  // ── Jobs — retrieval ──────────────────────────────────────────────────────
  jobVectorTopK: Number(process.env.JOB_VECTOR_TOP_K ?? 10),
  jobBm25TopK: Number(process.env.JOB_BM25_TOP_K ?? 10),
  jobMatchTopK: Number(process.env.JOB_MATCH_TOP_K ?? 10),

  // ── DeepEval — job-search evaluation ──────────────────────────────────────
  deepEvalEnabled: process.env.DEEPEVAL_ENABLED?.trim().toLowerCase() === "true",
  deepEvalJudgeModel: process.env.DEEPEVAL_JUDGE_MODEL ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
  deepEvalAlignmentThreshold: Number(process.env.DEEPEVAL_ALIGNMENT_THRESHOLD ?? 0.7),
  deepEvalRelevancyThreshold: Number(process.env.DEEPEVAL_RELEVANCY_THRESHOLD ?? 0.7),
  deepEvalFaithfulnessThreshold: Number(process.env.DEEPEVAL_FAITHFULNESS_THRESHOLD ?? 0.7),
  deepEvalMaxJobs: Math.max(1, Math.min(50, Math.floor(Number(process.env.DEEPEVAL_MAX_JOBS ?? 10)))),

  // ── Jobs — application message ────────────────────────────────────────────
  // ── MCP ───────────────────────────────────────────────────────────────────
  mcpServerName: process.env.MCP_SERVER_NAME ?? "resume-rag-job-assistant",
  mcpTransport: process.env.MCP_TRANSPORT ?? "stdio",
};
