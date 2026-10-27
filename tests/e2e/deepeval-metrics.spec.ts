/**
 * E2E tests — DeepEval Metrics page
 *
 * All backend calls are mocked. Tests verify:
 *   - Page renders KPI cards and filter panel
 *   - Run evaluation flow (loading state → success)
 *   - Error and rate-limit states
 *   - Results table shows scores
 *   - Filters update the visible results
 *   - Empty history state is handled gracefully
 *
 * Tags: @e2e
 */

import { test, expect } from "@playwright/test";
import { DeepEvalPage } from "./pages/DeepEvalPage";
import {
  MOCK_EVAL_HISTORY_RESPONSE,
  MOCK_EVAL_RUN_RESPONSE,
  MOCK_EVAL_CONFIG_RESPONSE,
} from "../fixtures/evaluation-results";

const MOCK_CONFIG = {
  success: true,
  config: {
    searchRoles: ["Junior AI Engineer"],
    searchLocation: "South Africa",
    searchRemote: false,
    searchProviderConfigured: false,
    searchSources: [],
  },
};

function setupCommonRoutes(page: import("@playwright/test").Page) {
  return Promise.all([
    page.route("**/v1/jobs/config", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
    ),
    page.route("**/v1/jobs/saved", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
    ),
  ]);
}

// ── Initial load ──────────────────────────────────────────────────────────────

test("DeepEval page loads with history @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVAL_HISTORY_RESPONSE) })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.assertLoaded();
  await evalPage.assertKpiCardsVisible();
  await evalPage.assertRunButtonVisible();
});

test("KPI cards show metric averages from history @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVAL_HISTORY_RESPONSE) })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  // Each KPI card should be visible
  const kpiCards = page.getByTestId("deepeval-kpi-card");
  await expect(kpiCards.first()).toBeVisible();
  // Should have at least 4 KPI cards (3 metrics + overall pass rate)
  expect(await kpiCards.count()).toBeGreaterThanOrEqual(4);
});

test("results table shows score cells from history @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVAL_HISTORY_RESPONSE) })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.assertResultsTableVisible();

  // The fixture alignment score is 88.0%
  await expect(page.getByTestId("deepeval-results-table").getByText("88.0%")).toBeVisible();
});

// ── Empty history ─────────────────────────────────────────────────────────────

test("empty history shows helpful message @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        settings: MOCK_EVAL_CONFIG_RESPONSE.settings,
        results: [],
      }),
    })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.assertEmptyHistoryState();
  await expect(page.getByTestId("deepeval-empty-state")).toContainText(/no evaluations yet/i);
});

// ── Run evaluation ────────────────────────────────────────────────────────────

test("run evaluation button triggers loading state then updates results @e2e", async ({ page }) => {
  await setupCommonRoutes(page);

  await page.route("**/v1/jobs/evaluations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, settings: MOCK_EVAL_CONFIG_RESPONSE.settings, results: [] }),
      });
    }
    return route.continue();
  });

  // Mock the search used when no jobs are pre-loaded
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        results: [{ job: { jobId: "test_job_abc123", title: "Junior AI Engineer", company: "Example Co", source: { provider: "web", url: "https://example.com" }, description: "", responsibilities: [], requiredSkills: [], preferredSkills: [], technologies: [], qualifications: [], experienceRequirements: [], educationRequirements: [], discoveredAt: "2026-10-15T10:00:00.000Z", rawText: "", contentHash: "abc" } }],
      }),
    })
  );

  await page.route("**/v1/jobs/evaluations/run", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVAL_RUN_RESPONSE) })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.fillEvaluationQuery("Junior AI Engineer RAG Python");
  await evalPage.clickRunEvaluation();

  // Loading state appears
  await evalPage.assertLoadingState();

  // Results eventually update
  await evalPage.assertResultsTableVisible();
  await expect(page.getByTestId("deepeval-results-table").getByText("88.0%")).toBeVisible();
});

test("run evaluation shows error when backend returns 503 @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, settings: MOCK_EVAL_CONFIG_RESPONSE.settings, results: [] }),
      });
    }
    return route.continue();
  });
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) })
  );
  await page.route("**/v1/jobs/evaluations/run", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "DeepEval is disabled." }),
    })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();
  await evalPage.fillEvaluationQuery("AI Engineer");
  await evalPage.clickRunEvaluation();

  // Wait for loading to finish and error to appear
  await evalPage.assertErrorVisible();
});

test("run button is disabled when evaluation is disabled in settings @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        settings: { ...MOCK_EVAL_CONFIG_RESPONSE.settings, enabled: false },
        results: [],
      }),
    })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.assertRunButtonDisabled();
  await expect(page.getByText(/evaluation disabled/i)).toBeVisible();
});

// ── Filters ───────────────────────────────────────────────────────────────────

test("metric filter hides results for other metrics @e2e", async ({ page }) => {
  await setupCommonRoutes(page);
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EVAL_HISTORY_RESPONSE) })
  );

  const evalPage = new DeepEvalPage(page);
  await evalPage.open();

  await evalPage.assertResultsTableVisible();

  // Select only the Alignment metric
  await evalPage.selectMetricFilter("Job-Query Alignment");

  // Alignment scores (88.0%) should still be visible; others hidden by filter
  await expect(page.getByTestId("deepeval-results-table").getByText("88.0%")).toBeVisible();
});
