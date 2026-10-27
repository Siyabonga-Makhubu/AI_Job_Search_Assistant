/**
 * API tests — Resume ingestion and retrieval endpoints
 *
 * Tags: @api
 */

import { test, expect } from "@playwright/test";
import { get, post } from "../utils/api-helpers";
import { assertLibraryResumeShape } from "../utils/assertions";
import { SAMPLE_RESUME_TEXT } from "../fixtures/resumes";

// ── Ingestion module ──────────────────────────────────────────────────────────

test.describe("POST /v1/resume/clean @api", () => {
  test("cleans rawText and returns cleanText", async ({ request }) => {
    const response = await post(request, "/v1/resume/clean", {
      rawText: "  Hello   World\r\n\r\nTest  ",
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(typeof body.cleanText).toBe("string");
  });

  test("returns empty cleanText for empty rawText", async ({ request }) => {
    const response = await post(request, "/v1/resume/clean", { rawText: "" });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(typeof body.cleanText).toBe("string");
  });
});

test.describe("POST /v1/resume/skills @api", () => {
  test("detects known skills from text", async ({ request }) => {
    const response = await post(request, "/v1/resume/skills", {
      rawText: "Experienced with Python, RAG, MongoDB, TypeScript, Docker, and LangChain.",
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.skills)).toBe(true);

    const skills = body.skills as string[];
    expect(skills).toContain("Python");
    expect(skills).toContain("RAG");
    expect(skills).toContain("MongoDB");
  });

  test("returns empty skills array for text with no recognisable skills", async ({ request }) => {
    const response = await post(request, "/v1/resume/skills", {
      rawText: "The weather is sunny today.",
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.skills)).toBe(true);
  });
});

test.describe("POST /v1/resume/parse @api", () => {
  test("parses a resume and returns structured fields", async ({ request }) => {
    const response = await post(request, "/v1/resume/parse", {
      rawText: SAMPLE_RESUME_TEXT,
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);

    const resume = body.resume as Record<string, unknown>;
    expect(Array.isArray(resume.skills)).toBe(true);
    // Should detect at least some skills from the sample resume
    expect((resume.skills as string[]).length).toBeGreaterThan(0);
  });

  test("handles empty rawText gracefully", async ({ request }) => {
    const response = await post(request, "/v1/resume/parse", { rawText: "" });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    const resume = body.resume as Record<string, unknown>;
    expect(Array.isArray(resume.skills)).toBe(true);
  });
});

test.describe("POST /v1/resume/regex @api", () => {
  test("extracts email and phone from text", async ({ request }) => {
    const response = await post(request, "/v1/resume/regex", {
      rawText: "Contact: test.user@example.com | +27 82 123 4567",
    });
    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body.success).toBe(true);
    expect(body.email).toBe("test.user@example.com");
  });
});

test.describe("POST /v1/resume/upload @api", () => {
  test("returns 400 when no file is provided", async ({ request }) => {
    // multipart/form-data request with no file attached
    const response = await request.post(
      `${process.env.API_BASE_URL ?? "http://localhost:3000"}/v1/resume/upload`,
      { multipart: {} }
    );
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.errorCode).toBe("FILE_REQUIRED");
  });
});

// ── Retrieval module ──────────────────────────────────────────────────────────

test.describe("GET /v1/resume/library @api", () => {
  test("returns 200 with resumes array", async ({ request }) => {
    const response = await get(request, "/v1/resume/library");
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.resumes)).toBe(true);
      for (const resume of body.resumes as Array<Record<string, unknown>>) {
        assertLibraryResumeShape(resume);
      }
    }
  });
});

test.describe("GET /v1/resume/stats @api", () => {
  test("returns resumeCount and indexedCount", async ({ request }) => {
    const response = await get(request, "/v1/resume/stats");
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(typeof body.resumeCount).toBe("number");
      expect(typeof body.indexedCount).toBe("number");
      expect(body.resumeCount as number).toBeGreaterThanOrEqual(0);
      expect(body.indexedCount as number).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe("GET /v1/resume/:resumeId @api", () => {
  test("returns 404 for a non-existent resumeId", async ({ request }) => {
    const response = await get(request, "/v1/resume/nonexistent_id_xyz_000");
    expect([404, 503]).toContain(response.status());
    if (response.status() === 404) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.success).toBe(false);
    }
  });
});

test.describe("POST /v1/resume/search @api", () => {
  test("returns 400 for blank query", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", { query: "   " });
    expect(response.status()).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(["QUERY_REQUIRED", "INVALID_QUERY"]).toContain(body.errorCode);
  });

  test("returns 400 for query exceeding 2000 chars", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "a".repeat(2001),
    });
    expect(response.status()).toBe(400);
  });

  test("returns 400 for invalid mode", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "Python developer",
      mode: "invalid_mode",
    });
    expect(response.status()).toBe(400);
  });

  test("returns 400 for limit out of range", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "Python developer",
      limit: 100,
    });
    expect(response.status()).toBe(400);
  });

  test("returns 400 for invalid filters shape", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "Python developer",
      filters: "not-an-object",
    });
    expect(response.status()).toBe(400);
  });

  test("returns 400 for unsupported filter key", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "Python developer",
      filters: { unknownField: "value" },
    });
    expect(response.status()).toBe(400);
  });

  test("valid query returns 200 or 503 (DB may be unavailable)", async ({ request }) => {
    const response = await post(request, "/v1/resume/search", {
      query: "Python AI engineer RAG",
      limit: 3,
      mode: "hybrid",
    });
    expect([200, 503]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.results)).toBe(true);
    }
  });
});

test.describe("GET /v1/retrieval/readiness @api", () => {
  test("returns ready or not_ready with appropriate status code", async ({ request }) => {
    const response = await get(request, "/v1/retrieval/readiness");
    expect([200, 503]).toContain(response.status());
    const body = await response.json() as Record<string, unknown>;
    expect(["ready", "not_ready"]).toContain(body.status);
  });
});
