export function normalizeQuery(query: string): string {
  return (query ?? "").trim().replace(/\s+/g, " ");
}

export function isBlankQuery(query: string): boolean {
  return !normalizeQuery(query);
}

/**
 * Returns true when the query contains no professional or technical signal.
 *
 * A query like "Find a candidate with experience in love" has no skills,
 * roles, technologies, or domain keywords — it should not hit the retrieval
 * pipeline at all and instead return a clear "not found" answer.
 *
 * The check is intentionally broad: any single word from the allowlist is
 * enough to let the query through. The allowlist covers:
 *   — generic recruiting words (candidate, developer, engineer, …)
 *   — common technical skills and domain terms
 *   — experience / education keywords
 *
 * This is a fast pre-filter, not a classifier. Edge cases that slip through
 * are caught by the relevance score threshold further down the pipeline.
 */
export function isNonProfessionalQuery(query: string): boolean {
  const q = query.toLowerCase();

  const professionalTerms = [
    // Recruiting / HR
    "candidate", "developer", "engineer", "architect", "designer", "manager",
    "analyst", "consultant", "specialist", "lead", "senior", "junior",
    "intern", "trainee", "graduate", "professional", "recruiter", "hr",
    "hire", "hiring", "recruitment", "resume", "cv", "skill", "skills",
    "experience", "experienced", "role", "position", "job", "career",
    "work", "working", "background", "qualification", "qualified",
    // Technologies & languages
    "python", "java", "javascript", "typescript", "react", "angular", "vue",
    "node", "nodejs", "express", "django", "flask", "spring", "dotnet",
    "csharp", "c#", "c++", "golang", "go", "rust", "kotlin", "swift",
    "php", "ruby", "rails", "scala", "r", "matlab",
    // Data / AI / ML
    "sql", "nosql", "mongodb", "postgresql", "mysql", "redis", "elasticsearch",
    "machine learning", "deep learning", "nlp", "computer vision", "llm",
    "rag", "langchain", "tensorflow", "pytorch", "hugging face", "bert",
    "ai", "ml", "data science", "data engineer", "data analyst",
    "vector", "embedding", "transformer", "model", "training",
    // Cloud / DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd",
    "devops", "linux", "git", "github", "api", "rest", "graphql",
    // Business domains
    "finance", "banking", "healthcare", "retail", "ecommerce", "logistics",
    "sales", "marketing", "accounting", "legal", "operations",
    // Education
    "degree", "btech", "mtech", "bachelor", "master", "phd", "diploma",
    "university", "college", "certification", "certified",
    // Soft signals
    "years", "yrs", "months",
  ];

  return !professionalTerms.some((term) => q.includes(term));
}

/**
 * Parses a minimum-experience requirement from a natural-language query.
 *
 * Handles patterns like:
 *   "10+ years"  "at least 5 years"  "minimum 8 years"
 *   "more than 3 years"  "over 7 years"
 *   "10 years experience"  "with 5+ yrs"
 *
 * Returns null when no experience requirement is detected.
 */
export function extractExperienceFromQuery(query: string): number | null {
  const q = query.toLowerCase();

  const plusPattern = q.match(/(\d+)\s*\+\s*(?:years?|yrs?)/i);
  if (plusPattern) return Number(plusPattern[1]);

  const prefixPattern = q.match(
    /(?:at\s+least|at\s+minimum|minimum|min\.?|more\s+than|over|above)\s+(\d+)\s*(?:years?|yrs?)/i
  );
  if (prefixPattern) return Number(prefixPattern[1]);

  const yearsOfPattern = q.match(/(\d+)\s+(?:years?|yrs?)\s+(?:of\s+)?experience/i);
  if (yearsOfPattern) return Number(yearsOfPattern[1]);

  const withPattern = q.match(
    /(?:with|having|need|needs|require|requires|want|wants|looking\s+for)\s+(\d+)\s*(?:years?|yrs?)/i
  );
  if (withPattern) return Number(withPattern[1]);

  return null;
}
