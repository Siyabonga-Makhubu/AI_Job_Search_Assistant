/**
 * API tests — DeepEval evaluation endpoints
 *
 * Real DeepEval runs are never triggered here. We verify:
 *   - Response shape and field types
 *   - Validation errors
 *   - Score range enforcement (0–1)
 *   - Pass/fail consistency
 *
 * The optional live test at the bottom requires RUN_LIVE_EVAL=true and
 * a configured GROQ_API_KEY + Python venv. It is SKIPPED by default.
 *
 * Tags: @api
 */

import { test, expect } from "@playwright/test";
import { get, post } from "../utils/api-helpers";
import { assertEvaluationResultShape } from "../utils/assertions";
import { MOCK_EVAL_HISTORY_RESPONSE, MOCK_EVAL_RUN_RESPONSE } from "../fixtures/evaluation-results";

// ── GET /v1/jobs/evaluations/config ───────────────────────────────────────────

test.describe("GET /v1/jobs/evaluations/config @api", () => {
  test("returns EvaluationSettings with correct shape", async ({ request }) => {
    const response = await get(request, "/v1/jobs/evaluations/config");
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);

    const settings = body.settings as Record<string, unknown>;
    expect(typeof settings.enabled).toBe("boolean");
    expect(typeof settings.judgeModel).toBe("string");
    expect(settings.judgeModel).toBeTruthy();

    for (const field of ["alignmentThreshold", "relevancyThreshold", "faithfulnessThreshold"]) {
      expect(typeof settings[field]).toBe("number");
      expect(settings[field] as number).toBeGreaterThanOrEqual(0);
      expect(settings[field] as number).toBeLessThanOrEqual(1);
    }

    expect(typeof settings.maxJobs).toBe("number");
    expect(settings.maxJobs as number).toBeGreaterThanOrEqual(1);
    expect(settings.maxJobs as number).toBeLessThanOrEqual(50);
  });
});

// ── GET /v1/jobs/evaluations ─────────────────────────────────────────────────

test.describe("GET /v1/jobs/evaluations @api", () => {
  test("returns 200 with settings and results array", async ({ request }) => {
    const response = await get(request, "/v1/jobs/evaluations");
    expect([200, 503]).toContain(response.status());
    if (response.status() !== 200) return;

    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.settings).toBeDefined();

    for (const result of body.results as Array<Record<string, unknown>>) {
      assertEvaluationResultShape(result);
    }
  });

  test("accepts metric filter query param", async ({ request }) => {
    const response = await get(
      request,
      "/v1/jobs/evaluations?metric=Job-Query+Alignment"
    );
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      const results = body.results as Array<Record<string, unknown>>;
      for (const result of results) {
        expect(result.metricName).toBe("Job-Query Alignment");
      }
    }
  });

  test("accepts passed filter query param", async ({ request }) => {
    const response = await get(request, "/v1/jobs/evaluations?passed=true");
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      const results = body.results as Array<Record<string, unknown>>;
      for (const result of results) {
        expect(result.passed).toBe(true);
      }
    }
  });

  test("returns 400 for invalid metric filter", async ({ request }) => {
    const response = await get(
      request,
      "/v1/jobs/evaluations?metric=InvalidMetricName"
    );
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.errorCode).toBe("INVALID_EVALUATION_FILTER");
  });

  test("returns 400 for invalid passed filter", async ({ request }) => {
    const response = await get(
      request,
      "/v1/jobs/evaluations?passed=maybe"
    );
    expect(response.status()).toBe(400);
  });
});

// ── POST /v1/jobs/evaluations/run — validation ───────────────────────────────

test.describe("POST /v1/jobs/evaluations/run — validation @api", () => {
  test("returns 400 for missing query", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      jobIds: ["test_job_abc123"],
    });
    expect([400, 503]).toContain(response.status());
  });

  test("returns 400 for empty query string", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "",
      jobIds: ["test_job_abc123"],
    });
    expect([400, 503]).toContain(response.status());
  });

  test("returns 400 for missing jobIds", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "Junior AI Engineer",
    });
    expect([400, 503]).toContain(response.status());
  });

  test("returns 400 for empty jobIds array", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "Junior AI Engineer",
      jobIds: [],
    });
    expect([400, 503]).toContain(response.status());
  });

  test("returns 400 for query exceeding 2000 chars", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "x".repeat(2001),
      jobIds: ["test_job_abc123"],
    });
    expect([400, 503]).toContain(response.status());
  });

  test("returns 400 or 404 for non-existent jobIds (DeepEval disabled env returns 503)", async ({ request }) => {
    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "Junior AI Engineer",
      jobIds: ["nonexistent_job_id_xyz_000"],
    });
    // 400 = validation, 404 = jobs not found, 503 = DeepEval disabled / DB unavailable
    expect([400, 404, 503]).toContain(response.status());
  });
});

// ── Fixture shape validation ──────────────────────────────────────────────────
// Verify our own fixtures match the schema contract (catches fixture drift).

test.describe("Evaluation fixture shape validation @api", () => {
  for (const result of MOCK_EVAL_HISTORY_RESPONSE.results) {
    test(`fixture "${result.metricName}" has a valid shape`, () => {
      assertEvaluationResultShape(result as unknown as Record<string, unknown>);
    });
  }

  for (const result of MOCK_EVAL_RUN_RESPONSE.results) {
    test(`run fixture "${result.metricName}" score is consistent with passed flag`, () => {
      if (result.score !== null) {
        expect(result.passed).toBe(result.score >= result.threshold);
      }
    });
  }
});

// ── OPTIONAL: live evaluation test ───────────────────────────────────────────

test.describe("LIVE evaluation test — requires RUN_LIVE_EVAL=true @api @slow", () => {
  test.skip(
    process.env.RUN_LIVE_EVAL !== "true",
    "Skipped: set RUN_LIVE_EVAL=true to run this test. " +
      "Requires GROQ_API_KEY, DEEPEVAL_ENABLED=true, and a Python venv. " +
      "WARNING: consumes API quota."
  );

  test("runs real DeepEval evaluation and returns scored results", async ({ request }) => {
    // First ingest a synthetic job so we have something to evaluate
    const ingestResponse = await post(request, "/v1/jobs/ingest", {
      rawText: `Junior AI Engineer (Live Eval Test) — Live Test Co
Build RAG and vector search pipelines with Python and MongoDB Atlas.
Requirements: Python 3.10+, RAG, MongoDB Atlas, TypeScript.
Location: Cape Town. Remote: yes.`,
      provider: "manual",
    });

    expect([200, 201]).toContain(ingestResponse.status());
    const { jobId } = await ingestResponse.json() as { jobId: string };

    const response = await post(request, "/v1/jobs/evaluations/run", {
      query: "Junior AI Engineer RAG Python South Africa",
      jobIds: [jobId],
    });

    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(typeof body.runId).toBe("string");

    const results = body.results as Array<Record<string, unknown>>;
    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      assertEvaluationResultShape(result);
      // All three metric types should be present
      expect([
        "Contextual Relevancy",
        "Faithfulness",
        "Job-Query Alignment",
      ]).toContain(result.metricName);
    }
  });
});
