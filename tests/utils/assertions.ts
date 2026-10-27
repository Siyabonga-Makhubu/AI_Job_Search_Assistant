/**
 * assertions.ts
 *
 * Shared assertion helpers that encode business rules so individual
 * test files stay concise.
 */

import { expect } from "@playwright/test";

// ── Job shape ────────────────────────────────────────────────────────────────

export function assertJobShape(job: Record<string, unknown>) {
  expect(typeof job.jobId, "jobId must be a string").toBe("string");
  expect(job.jobId, "jobId must be non-empty").toBeTruthy();
  expect(typeof job.title, "title must be a string").toBe("string");
  expect(job.title, "title must be non-empty").toBeTruthy();
  expect(job, "job must have a source object").toHaveProperty("source");
  const source = job.source as Record<string, unknown>;
  expect(typeof source.url, "source.url must be a string").toBe("string");
  expect(typeof source.provider, "source.provider must be a string").toBe("string");
  expect(Array.isArray(job.requiredSkills), "requiredSkills must be an array").toBe(true);
  expect(Array.isArray(job.responsibilities), "responsibilities must be an array").toBe(true);
  expect(Array.isArray(job.technologies), "technologies must be an array").toBe(true);
  // Embedding vectors must NEVER be exposed to the client
  expect(job.embedding, "embedding must not be exposed").toBeUndefined();
}

// ── Evaluation result shape ───────────────────────────────────────────────────

const VALID_METRICS = new Set([
  "Contextual Relevancy",
  "Faithfulness",
  "Job-Query Alignment",
]);

export function assertEvaluationResultShape(result: Record<string, unknown>) {
  expect(typeof result.runId, "runId must be a string").toBe("string");
  expect(typeof result.query, "query must be a string").toBe("string");
  expect(
    VALID_METRICS.has(result.metricName as string),
    `metricName "${String(result.metricName)}" must be a known metric`
  ).toBe(true);
  expect(typeof result.threshold, "threshold must be a number").toBe("number");
  expect(result.threshold as number, "threshold must be >= 0").toBeGreaterThanOrEqual(0);
  expect(result.threshold as number, "threshold must be <= 1").toBeLessThanOrEqual(1);
  expect(typeof result.passed, "passed must be a boolean").toBe("boolean");
  expect(typeof result.judgeModel, "judgeModel must be a string").toBe("string");
  expect(typeof result.cached, "cached must be a boolean").toBe("boolean");

  // score is null on error, otherwise 0–1
  if (result.score !== null && result.score !== undefined) {
    expect(typeof result.score, "score must be a number").toBe("number");
    expect(result.score as number, "score must be >= 0").toBeGreaterThanOrEqual(0);
    expect(result.score as number, "score must be <= 1").toBeLessThanOrEqual(1);
    // pass/fail is consistent with score vs threshold
    const expectedPassed = (result.score as number) >= (result.threshold as number);
    expect(result.passed, "passed must match score >= threshold").toBe(expectedPassed);
  }
}

// ── Match analysis shape ──────────────────────────────────────────────────────

const VALID_MATCH_STATUSES = new Set(["MATCHED", "PARTIAL", "NOT_EVIDENCED"]);

export function assertMatchAnalysisShape(match: Record<string, unknown>) {
  expect(typeof match.jobId, "jobId must be a string").toBe("string");
  expect(typeof match.candidateId, "candidateId must be a string").toBe("string");
  expect(typeof match.summary, "summary must be a string").toBe("string");

  for (const key of ["matchedRequirements", "partialRequirements", "notEvidencedRequirements"]) {
    const arr = match[key] as Array<Record<string, unknown>>;
    expect(Array.isArray(arr), `${key} must be an array`).toBe(true);
    for (const req of arr) {
      expect(typeof req.requirement, "requirement must be a string").toBe("string");
      expect(
        VALID_MATCH_STATUSES.has(req.status as string),
        `status "${String(req.status)}" must be MATCHED, PARTIAL, or NOT_EVIDENCED`
      ).toBe(true);
      expect(Array.isArray(req.evidence), "evidence must be an array").toBe(true);
    }
  }

  for (const key of ["relevantSkills", "relevantProjects", "relevantExperience", "relevantEducation"]) {
    expect(Array.isArray(match[key]), `${key} must be an array`).toBe(true);
  }
}

// ── Resume library shape ──────────────────────────────────────────────────────

export function assertLibraryResumeShape(resume: Record<string, unknown>) {
  expect(typeof resume.resumeId, "resumeId must be a string").toBe("string");
  expect(resume.resumeId, "resumeId must be non-empty").toBeTruthy();
  expect(typeof resume.indexed, "indexed must be a boolean").toBe("boolean");
}
