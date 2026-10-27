/**
 * Job fixtures used across API and E2E tests.
 *
 * These are deterministic, synthetic data objects that do not depend on
 * any live database state.
 */

export const SAMPLE_JOB = {
  jobId: "test_job_abc123",
  title: "Junior AI Engineer",
  company: "Example Co",
  location: "Cape Town, South Africa",
  remote: true,
  employmentType: "full-time",
  source: {
    provider: "web",
    url: "https://example.com/jobs/junior-ai-engineer",
  },
  description:
    "Build and maintain retrieval-augmented generation (RAG) systems using Python, LangChain, and MongoDB Atlas.",
  responsibilities: [
    "Implement vector search pipelines",
    "Maintain embedding generation services",
    "Write unit and integration tests",
  ],
  requiredSkills: ["Python", "RAG", "MongoDB"],
  preferredSkills: ["TypeScript", "LangChain"],
  technologies: ["MongoDB Atlas", "Mistral", "Node.js"],
  qualifications: ["BSc Computer Science or equivalent"],
  experienceRequirements: ["1+ years building production APIs"],
  educationRequirements: ["Degree in Computer Science, Engineering, or related"],
  publishedAt: "2026-10-01T08:00:00.000Z",
  discoveredAt: "2026-10-01T09:00:00.000Z",
  contentHash: "abc123hash",
};

export const SAMPLE_JOB_2 = {
  jobId: "test_job_def456",
  title: "Generative AI Engineer",
  company: "AI Startup",
  location: "Johannesburg, South Africa",
  remote: false,
  source: {
    provider: "web",
    url: "https://example.com/jobs/gen-ai-engineer",
  },
  description:
    "Develop LLM-powered applications using LangChain, Llama 3, and cloud APIs.",
  responsibilities: ["Fine-tune open-source LLMs", "Design prompt templates"],
  requiredSkills: ["Python", "LLMs", "LangChain"],
  preferredSkills: ["AWS", "Docker"],
  technologies: ["Llama 3", "LangChain", "Python"],
  qualifications: [],
  experienceRequirements: [],
  educationRequirements: [],
  discoveredAt: "2026-10-02T09:00:00.000Z",
  contentHash: "def456hash",
};

/** A job search result wrapping SAMPLE_JOB (as returned by POST /v1/jobs/search). */
export const SAMPLE_SEARCH_RESULT = {
  job: SAMPLE_JOB,
  vectorScore: 0.92,
  keywordScore: 0.85,
  hybridScore: 0.89,
};

/** Minimal valid job ingestion payload for POST /v1/jobs/ingest. */
export const INGEST_PAYLOAD = {
  rawText: `Junior AI Engineer — Example Co
Location: Cape Town, South Africa | Remote: Yes

About the role
We are looking for a junior AI engineer to build RAG systems.

Requirements
- Python 3.10+
- Experience with vector databases (MongoDB Atlas, Pinecone)
- RAG and LLM integration experience
- TypeScript is a plus

Responsibilities
- Build retrieval pipelines
- Write clean, tested code
- Collaborate with senior engineers`,
  provider: "manual",
};
