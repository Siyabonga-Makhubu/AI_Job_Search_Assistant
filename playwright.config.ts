import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for the Resume RAG Job Assistant.
 *
 * Environment variables (all optional — defaults work for local dev):
 *   BASE_URL       Frontend URL  (default: http://localhost:4173)
 *   API_BASE_URL   Backend URL   (default: http://localhost:3000)
 *   CI             Set by GitHub Actions — enables retries and stricter timeouts
 */

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4173";
const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  // ── Test discovery ──────────────────────────────────────────────────────
  testDir: "./tests",
  testMatch: "**/*.spec.ts",

  // ── Parallelism ─────────────────────────────────────────────────────────
  // API tests are I/O-bound and run fine in parallel.
  // E2E Chromium tests are memory-heavy; limit to 2 workers to avoid
  // Node.js heap exhaustion when backend + Vite are also running locally.
  fullyParallel: true,
  workers: process.env.CI ? 2 : 2,

  // ── Retries ─────────────────────────────────────────────────────────────
  // Retry once in CI to reduce flakiness from startup timing.
  // No retries locally so failures are obvious immediately.
  retries: process.env.CI ? 1 : 0,

  // ── Global timeout ───────────────────────────────────────────────────────
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // ── Reporters ────────────────────────────────────────────────────────────
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  // ── Shared settings ──────────────────────────────────────────────────────
  use: {
    baseURL: BASE_URL,

    // Capture on first retry only (keeps CI artifacts small).
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    // Make the API base URL available inside every test via a custom option.
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },

  // ── Projects ─────────────────────────────────────────────────────────────
  projects: [
    // ── Default: Chromium (all tests) ───────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },

    // ── Optional: uncomment to enable Firefox / WebKit ───────────────────
    // { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
    // { name: "webkit",   use: { ...devices["Desktop Safari"]  } },

    // ── Mobile viewport (responsive checks) ─────────────────────────────
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      // Only run specs tagged @responsive
      grep: /@responsive/,
    },

    // ── API-only project — no browser needed ────────────────────────────
    {
      name: "api",
      testMatch: "**/api/**/*.spec.ts",
      use: {
        // API tests drive the Express server directly; no browser needed.
        baseURL: API_BASE_URL,
      },
    },
  ],

  // ── Web server — start the Vite frontend before E2E tests ────────────────
  // API tests bypass this because they talk directly to the backend.
  // To run E2E tests you must start the backend separately:
  //   npm run dev   (in one terminal)
  //   npm run test:e2e   (in another)
  //
  // The webServer block starts the Vite preview server for the built frontend.
  // For development, set BASE_URL=http://localhost:4173 and run `npm run dev`
  // in the frontend/ directory manually, then run tests.
  webServer: process.env.CI
    ? {
        // In CI, build and preview the frontend.
        command: "cd frontend && npm run build && npm run preview",
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: false,
      }
    : {
        // Locally, expect the dev server to already be running.
        command: "cd frontend && npm run dev",
        url: BASE_URL,
        timeout: 30_000,
        reuseExistingServer: true,
      },
});

// Re-export the resolved URLs so test helpers can import them without
// duplicating the env-var logic.
export { API_BASE_URL, BASE_URL };
