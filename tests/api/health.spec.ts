/**
 * API tests — Health endpoints
 *
 * These tests hit the real Express server. The server must be running on
 * API_BASE_URL (default http://localhost:3000) before these tests execute.
 *
 * Tags: @smoke @api
 */

import { test, expect } from "@playwright/test";
import { get, timedGet, RESPONSE_TIME_THRESHOLD_MS } from "../utils/api-helpers";

// ── GET /v1/health ────────────────────────────────────────────────────────────

test.describe("GET /v1/health @smoke @api", () => {
  test("returns 200 with correct shape", async ({ request }) => {
    const response = await get(request, "/v1/health");

    expect(response.status()).toBe(200);
    const body = await response.json() as Record<string, unknown>;

    expect(body.status).toBe("ok");
    expect(body.app).toBe("resume-rag-backend");
    expect(body.version).toBe("1.0.0");
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime as number).toBeGreaterThanOrEqual(0);
    expect(typeof body.llmConfigured).toBe("boolean");
  });

  test("responds within threshold", async ({ request }) => {
    const { response, elapsedMs } = await timedGet(request, "/v1/health");

    expect(response.status()).toBe(200);
    expect(
      elapsedMs,
      `Health endpoint took ${elapsedMs}ms, threshold is ${RESPONSE_TIME_THRESHOLD_MS}ms`
    ).toBeLessThan(RESPONSE_TIME_THRESHOLD_MS);
  });

  test("rejects unsupported methods", async ({ request }) => {
    const response = await request.delete(
      `${process.env.API_BASE_URL ?? "http://localhost:3000"}/v1/health`
    );
    // Express 5 returns 404 for unmatched routes; 405 is also acceptable
    expect([404, 405]).toContain(response.status());
  });
});

// ── GET /v1/health/db ─────────────────────────────────────────────────────────

test.describe("GET /v1/health/db @api", () => {
  test("returns valid JSON with status and database fields", async ({ request }) => {
    const response = await get(request, "/v1/health/db");

    // Accept both 200 (connected) and 503 (not connected) — we just verify shape
    expect([200, 503]).toContain(response.status());

    const body = await response.json() as Record<string, unknown>;
    expect(["ok", "error"]).toContain(body.status);
    expect(body.database).toBe("mongodb");
    expect(typeof body.connected).toBe("boolean");
  });

  test("200 response includes latencyMs", async ({ request }) => {
    const response = await get(request, "/v1/health/db");
    if (response.status() !== 200) {
      test.skip(); // DB not available in this environment
      return;
    }
    const body = await response.json() as Record<string, unknown>;
    expect(typeof body.latencyMs).toBe("number");
    expect(body.latencyMs as number).toBeGreaterThanOrEqual(0);
  });
});

// ── Module health endpoints ───────────────────────────────────────────────────

test.describe("Module health endpoints @api", () => {
  const modules = [
    { path: "/v1/resume/health", expectedModule: "resume-ingestion" },
    { path: "/v1/retrieval/health", expectedModule: "resume-retrieval" },
    { path: "/v1/jobs/health", expectedModule: "jobs" },
  ];

  for (const { path, expectedModule } of modules) {
    test(`GET ${path} returns ok`, async ({ request }) => {
      const response = await get(request, path);
      expect(response.status()).toBe(200);
      const body = await response.json() as Record<string, unknown>;
      expect(body.status).toBe("ok");
      expect(body.module).toBe(expectedModule);
    });
  }
});
