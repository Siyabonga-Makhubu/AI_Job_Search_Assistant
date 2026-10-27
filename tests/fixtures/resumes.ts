/**
 * Synthetic resume fixtures.
 *
 * IMPORTANT: these contain no real personal information.
 * All names, emails, phone numbers, and addresses are fictional.
 */

export const SAMPLE_RESUME_TEXT = `
Thabo Dlamini
thabo.dlamini@example.com | +27 82 000 0000 | Johannesburg, South Africa
linkedin.com/in/thabodlamini | github.com/thabodlamini

Professional Summary
AI Engineer with experience building retrieval-augmented generation (RAG)
systems, vector search pipelines, and LLM-powered APIs.

Skills
Python, TypeScript, Node.js, MongoDB, MongoDB Atlas Vector Search,
RAG, LangChain, FastAPI, Docker, Git, REST APIs

Experience
AI Engineer Intern | Tech Solutions SA | 2025 - Present
- Built a resume RAG system using MongoDB Atlas Vector Search
- Implemented hybrid BM25 + vector retrieval with Mistral embeddings
- Developed REST APIs with Express and TypeScript

Projects
Resume RAG Application
- End-to-end RAG pipeline: PDF ingestion, embedding, hybrid retrieval
- Mistral API for embeddings, Groq LLM for answer generation
- MCP server exposing resume tools to AI assistants

Education
BSc Computer Science | University of the Witwatersrand | 2021 - 2024

Certifications
MongoDB Associate Developer
`;

/** Library entry shape returned by GET /v1/resume/library */
export const SAMPLE_LIBRARY_RESUME = {
  resumeId: "resume_fixture_001",
  name: "Thabo Dlamini",
  role: "AI Engineer Intern",
  indexed: true,
  embeddingDimension: 1024,
};

/** Stored resume shape used by service-level mocks */
export const SAMPLE_STORED_RESUME = {
  _id: "resume_fixture_001",
  name: "Thabo Dlamini",
  role: "AI Engineer Intern",
  company: "Tech Solutions SA",
  location: "Johannesburg, South Africa",
  email: "thabo.dlamini@example.com",
  phone: "+27 82 000 0000",
  education: "BSc Computer Science",
  totalExperience: 1,
  skills: ["Python", "TypeScript", "RAG", "MongoDB", "LangChain", "Docker"],
  rawText: SAMPLE_RESUME_TEXT,
  embedding: Array.from({ length: 1024 }, () => 0),
  embeddingModel: "mistral-embed",
  embeddingDimension: 1024,
};
