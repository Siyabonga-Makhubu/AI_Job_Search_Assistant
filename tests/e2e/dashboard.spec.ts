/**
 * E2E tests — Dashboard page
 *
 * The frontend is started by playwright.config.ts webServer block.
 * All backend API calls are intercepted with page.route() so these
 * tests never depend on a live MongoDB or LLM provider.
 *
 * Tags: @smoke @e2e
 */

import { test, expect } from "@playwright/test";
import { DashboardPage } from "./pages/DashboardPage";

// ── Mock the backend config call made on every page load ─────────────────────
const MOCK_CONFIG = {
  success: true,
  config: {
    searchRoles: ["Junior AI Engineer", "AI Engineer", "Generative AI Engineer"],
    searchLocation: "South Africa",
    searchRemote: false,
    searchProviderConfigured: false,
    searchSources: [{ name: "manual", label: "Manual / URL ingestion" }],
  },
};

const MOCK_OVERVIEW = {
  success: true,
  stats: { totalJobs: 12, savedJobs: 5, applications: 3, interviews: 2, offers: 1 },
  activity: [{
    type: "application_submitted",
    jobId: "job_abc123",
    title: "Junior AI Engineer",
    company: "Example Co",
    occurredAt: "2026-10-15T10:00:00.000Z",
  }],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/jobs/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
  );
  await page.route("**/v1/jobs/saved", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
  );
  await page.route("**/v1/jobs/overview", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_OVERVIEW) })
  );
});

// ── Smoke test ────────────────────────────────────────────────────────────────

test("dashboard loads and shows heading @smoke @e2e", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await dashboard.assertLoaded();
});

// ── Navigation ────────────────────────────────────────────────────────────────

test("all five navigation links are visible @smoke @e2e", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await dashboard.assertNavigationVisible();
});

test("clicking Job discovery navigates to /jobs", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await dashboard.navigateToJobDiscovery();
  await expect(page).toHaveURL(/\/jobs/);
  await expect(
    page.getByRole("heading", { name: /find your next/i })
  ).toBeVisible();
});

test("clicking Add a job navigates to /jobs/ingest", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();
  await dashboard.navigateToIngest();
  await expect(page).toHaveURL(/\/jobs\/ingest/);
  await expect(
    page.getByRole("heading", { name: /add a job/i })
  ).toBeVisible();
});

test("clicking DeepEval Metrics navigates to /evaluation", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();

  // Mock the evaluations endpoints before navigating
  await page.route("**/v1/jobs/evaluations**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        settings: {
          enabled: true,
          judgeModel: "openai/gpt-oss-120b",
          alignmentThreshold: 0.7,
          relevancyThreshold: 0.7,
          faithfulnessThreshold: 0.7,
          maxJobs: 10,
        },
        results: [],
      }),
    })
  );

  await dashboard.navigateToDeepEval();
  await expect(page).toHaveURL(/\/evaluation/);
  await expect(page.getByTestId("deepeval-heading")).toBeVisible();
});

// ── Config panel ──────────────────────────────────────────────────────────────

test("backend config panel shows configured search roles", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();

  // Wait for the config to load (replaces the Loading spinner)
  await expect(page.getByTestId("dashboard-config-panel")).toBeVisible();
  await expect(page.getByText("Junior AI Engineer")).toBeVisible();
  await expect(page.getByText("South Africa")).toBeVisible();
});

test("dashboard shows database-backed statistics and recent activity @e2e", async ({ page }) => {
  const dashboard = new DashboardPage(page);
  await dashboard.open();

  await expect(page.getByTestId("dashboard-stats")).toBeVisible();
  await expect(page.getByTestId("dashboard-stat-totalJobs")).toContainText("12");
  await expect(page.getByTestId("dashboard-stat-savedJobs")).toContainText("5");
  await expect(page.getByTestId("dashboard-stat-applications")).toContainText("3");
  await expect(page.getByTestId("dashboard-stat-interviews")).toContainText("2");
  await expect(page.getByTestId("dashboard-stat-offers")).toContainText("1");
  await expect(page.getByTestId("dashboard-activity")).toContainText("Application submitted");
  await expect(page.getByTestId("dashboard-activity")).toContainText("Junior AI Engineer");
});

// ── Responsive ────────────────────────────────────────────────────────────────

test("navigation is accessible on mobile viewport @responsive", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.route("**/v1/jobs/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
  );
  await page.route("**/v1/jobs/saved", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
  );

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Mobile: open the hamburger menu
  const menuButton = page.getByRole("button", { name: /open navigation/i });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  // Nav links should now be visible — scope strictly to the navigation element
  await expect(
    page.getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: /job discovery/i })
  ).toBeVisible();
});
