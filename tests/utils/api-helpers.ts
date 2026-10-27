/**
 * api-helpers.ts
 *
 * Reusable request helpers for Playwright API tests.
 * All tests that need to call the backend import from here
 * rather than repeating fetch boilerplate.
 */

import { type APIRequestContext } from "@playwright/test";

export const API_BASE = process.env.API_BASE_URL ?? "http://localhost:3000";

// ── Thin wrappers ────────────────────────────────────────────────────────────

export async function get(request: APIRequestContext, path: string) {
  return request.get(`${API_BASE}${path}`);
}

export async function post(
  request: APIRequestContext,
  path: string,
  body: Record<string, unknown> = {}
) {
  return request.post(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    data: body,
  });
}

export async function patch(
  request: APIRequestContext,
  path: string,
  body: Record<string, unknown> = {}
) {
  return request.patch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    data: body,
  });
}

// ── Common health helpers ────────────────────────────────────────────────────

export async function getHealth(request: APIRequestContext) {
  return get(request, "/v1/health");
}

export async function getDbHealth(request: APIRequestContext) {
  return get(request, "/v1/health/db");
}

// ── Timing helper ────────────────────────────────────────────────────────────

/**
 * Measures the wall-clock time of a single API call in milliseconds.
 * Use with the RESPONSE_TIME_THRESHOLD_MS env var for configurable checks.
 */
export async function timedGet(
  request: APIRequestContext,
  path: string
): Promise<{ response: Awaited<ReturnType<typeof get>>; elapsedMs: number }> {
  const start = Date.now();
  const response = await get(request, path);
  return { response, elapsedMs: Date.now() - start };
}

export const RESPONSE_TIME_THRESHOLD_MS = Number(
  process.env.RESPONSE_TIME_THRESHOLD_MS ?? 2000
);
