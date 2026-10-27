/**
 * API tests — Jobs endpoints
 *
 * All external calls (MongoDB, Mistral, Groq, job providers) are irrelevant
 * here — we test the HTTP contract of each route. Where the backend would
 * call MongoDB we rely on the server returning expected error shapes when
 * the DB is unavailable, or we pass bodies that fail validation before any
 * DB call is made.
 *
 * Tags: @api
 */

import { test, expect } from "@playwright/test";
import { get, post, patch } from "../utils/api-helpers";
import { assertJobShape } from "../utils/assertions";

// ── GET /v1/jobs/health ───────────────────────────────────────────────────────

test("GET /v1/jobs/health returns ok @smoke @api", async ({ request }) => {
  const response = await get(request, "/v1/jobs/health");
  expect(response.status()).toBe(200);
  const body = await response.json() as Record<string, unknown>;
  expect(body.status).toBe("ok");
  expect(body.module).toBe("jobs");
  expect(typeof body.collection).toBe("string");
  expect(body.collection).toBeTruthy();
});

// ── GET /v1/jobs/config ───────────────────────────────────────────────────────

test.describe("GET /v1/jobs/config @api", () => {
  test("returns typed job configuration without secrets", async ({ request }) => {
    const response = await get(request, "/v1/jobs/config");
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;

    expect(body.success).toBe(true);
    const config = body.config as Record<string, unknown>;

    expect(Array.isArray(config.searchRoles)).toBe(true);
    expect((config.searchRoles as string[]).length).toBeGreaterThan(0);
    expect(typeof config.searchLocation).toBe("string");
    expect(typeof config.searchRemote).toBe("boolean");
    expect(Array.isArray(config.searchSources)).toBe(true);

    // No secrets must be present in the config response
    const serialised = JSON.stringify(body);
    expect(serialised).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(serialised.toLowerCase()).not.toContain("api_key");
    expect(serialised.toLowerCase()).not.toContain("secret");
  });
});

// ── GET /v1/jobs/:jobId — not found ──────────────────────────────────────────

test.describe("GET /v1/jobs/:jobId @api", () => {
  test("returns 404 with JOB_NOT_FOUND for a missing job", async ({ request }) => {
    const response = await get(request, "/v1/jobs/nonexistent_job_id_xyz");
    expect(response.status()).toBe(404);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(false);
    expect(body.errorCode).toBe("JOB_NOT_FOUND");
  });
});

// ── GET /v1/jobs/saved ────────────────────────────────────────────────────────

test.describe("GET /v1/jobs/saved @api", () => {
  test("returns 200 with a jobs array", async ({ request }) => {
    const response = await get(request, "/v1/jobs/saved");
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.jobs)).toBe(true);

    // If there are any saved jobs, verify their shape
    const jobs = body.jobs as Array<Record<string, unknown>>;
    for (const job of jobs) {
      assertJobShape(job);
    }
  });
});

// ── POST /v1/jobs/ingest — validation ────────────────────────────────────────

test.describe("POST /v1/jobs/ingest @api", () => {
  test("returns 400 when neither url nor rawText is provided", async ({ request }) => {
    const response = await post(request, "/v1/jobs/ingest", {});
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.errorCode).toBe("JOB_INGESTION_INVALID_INPUT");
  });

  test("accepts rawText and returns jobId", async ({ request }) => {
    const response = await post(request, "/v1/jobs/ingest", {
      rawText: `Junior AI Engineer — Test Company
Build RAG systems with Python, MongoDB, and LangChain.
Requirements: Python, RAG, MongoDB Atlas, TypeScript.
Location: Cape Town. Remote: yes.`,
      provider: "manual",
    });

    // 201 = newly ingested, 200 = already existed, 503 = DB unavailable
    expect([200, 201, 503]).toContain(response.status());

    if (response.status() !== 503) {
      const body = await response.json() as Record<string, unknown>;
      if (response.status() === 200 || response.status() === 201) {
        expect(typeof body.jobId).toBe("string");
        expect(body.jobId).toBeTruthy();
        expect(typeof body.alreadyExisted).toBe("boolean");
        expect(body.success).toBe(true);
      }
    }
  });

  test("is idempotent — ingesting the same rawText twice returns alreadyExisted=true", async ({ request }) => {
    const payload = {
      rawText: `Idempotency Test Job — Idempotent Co
Build ML pipelines with Python and scikit-learn.
Requirements: Python, scikit-learn, SQL.
Location: Pretoria. Remote: no.`,
      provider: "manual",
    };

    const first = await post(request, "/v1/jobs/ingest", payload);
    if (first.status() === 503) {
      test.skip(); // DB not available
      return;
    }
    expect([200, 201]).toContain(first.status());

    const second = await post(request, "/v1/jobs/ingest", payload);
    expect(second.status()).toBe(200);
    const body = await second.json() as Record<string, unknown>;
    expect(body.alreadyExisted).toBe(true);
  });
});

// ── POST /v1/jobs/search — validation ────────────────────────────────────────

test.describe("POST /v1/jobs/search @api", () => {
  test("returns 200 with results array for a valid query", async ({ request }) => {
    const response = await post(request, "/v1/jobs/search", {
      query: "Junior AI Engineer Python",
      topK: 5,
    });

    // 200 = ok, 503 = DB/embedding unavailable in test env
    expect([200, 503]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test("empty results array is acceptable for a no-match query", async ({ request }) => {
    const response = await post(request, "/v1/jobs/search", {
      query: "zzz_nonexistent_role_xyz_1234",
    });

    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      expect(Array.isArray(body.results)).toBe(true);
      // Empty results are valid — not an error
    }
  });
});

// ── POST /v1/jobs/:jobId/match — not found ────────────────────────────────────

test.describe("POST /v1/jobs/:jobId/match @api", () => {
  test("returns 404 for a non-existent job", async ({ request }) => {
    const response = await post(request, "/v1/jobs/nonexistent_job_xyz/match", {});
    expect([404, 503]).toContain(response.status());
    if (response.status() === 404) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.errorCode).toBe("JOB_NOT_FOUND");
    }
  });
});

// ── PATCH /v1/jobs/:jobId/status — validation ─────────────────────────────────

test.describe("PATCH /v1/jobs/:jobId/status @api", () => {
  test("returns 400 for an invalid status value", async ({ request }) => {
    const response = await patch(request, "/v1/jobs/any_job_id/status", {
      status: "INVALID_STATUS_VALUE",
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.errorCode).toBe("INVALID_APPLICATION_UPDATE");
  });

  test("returns 400 when status field is missing", async ({ request }) => {
    const response = await patch(request, "/v1/jobs/any_job_id/status", {});
    expect(response.status()).toBe(400);
  });
});

// ── PATCH /v1/jobs/:jobId/application — validation ───────────────────────────

test.describe("PATCH /v1/jobs/:jobId/application @api", () => {
  test("returns 400 for invalid interviewDate format", async ({ request }) => {
    const response = await patch(request, "/v1/jobs/any_job_id/application", {
      interviewDate: "not-a-date",
    });
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect((body.message as string).toLowerCase()).toContain("interviewdate");
  });

  test("returns 400 for empty body", async ({ request }) => {
    const response = await patch(request, "/v1/jobs/any_job_id/application", {});
    expect(response.status()).toBe(400);
  });

  test("returns 400 for unrecognised fields", async ({ request }) => {
    const response = await patch(request, "/v1/jobs/any_job_id/application", {
      unknownField: "some value",
    });
    expect(response.status()).toBe(400);
  });
});

// ── GET /v1/jobs/:jobId/tailored-cv — not found ───────────────────────────────

test("GET /v1/jobs/:jobId/tailored-cv returns 404 for missing job @api", async ({ request }) => {
  const response = await get(request, "/v1/jobs/nonexistent_job_xyz/tailored-cv");
  expect([404, 503]).toContain(response.status());
  if (response.status() === 404) {
    const body = await response.json() as Record<string, unknown>;
    expect(["JOB_NOT_FOUND", "TAILORED_CV_NOT_FOUND"]).toContain(body.errorCode);
  }
});
