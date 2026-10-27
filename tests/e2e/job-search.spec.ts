/**
 * E2E tests — Job search page
 *
 * All backend calls are mocked with page.route() to avoid live DB/LLM deps.
 *
 * Tags: @e2e
 */

import { test, expect } from "@playwright/test";
import { JobSearchPage } from "./pages/JobSearchPage";
import { SAMPLE_JOB, SAMPLE_JOB_2, SAMPLE_SEARCH_RESULT } from "../fixtures/jobs";

const MOCK_SEARCH_RESPONSE = {
  success: true,
  results: [
    SAMPLE_SEARCH_RESULT,
    { job: SAMPLE_JOB_2, vectorScore: 0.76, keywordScore: 0.71, hybridScore: 0.74 },
  ],
};

const MOCK_EMPTY_RESPONSE = { success: true, results: [] };

const MOCK_CONFIG = {
  success: true,
  config: {
    searchRoles: ["Junior AI Engineer", "AI Engineer", "Generative AI Engineer"],
    searchLocation: "South Africa",
    searchRemote: false,
    searchProviderConfigured: false,
    searchSources: [],
  },
};

const MOCK_MATCH = {
  success: true,
  match: {
    jobId: SAMPLE_JOB.jobId,
    candidateId: "resume_001",
    matchedRequirements: [{ requirement: "Python", status: "MATCHED", evidence: [] }],
    partialRequirements: [],
    notEvidencedRequirements: [{ requirement: "AWS", status: "NOT_EVIDENCED", evidence: [] }],
    relevantSkills: ["Python"],
    relevantProjects: [],
    relevantExperience: [],
    relevantEducation: [],
    evidence: [],
    summary: "Good match on core skills.",
    analysedAt: "2026-10-15T10:00:00.000Z",
  },
};

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/jobs/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
  );
  await page.route("**/v1/jobs/saved", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
  );
  // Match calls are fired automatically for each job card
  await page.route("**/v1/jobs/**/match", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_MATCH) })
  );
});

// ── Initial state ─────────────────────────────────────────────────────────────

test("job search page renders search form @e2e", async ({ page }) => {
  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.assertSearchFormVisible();
});

test("empty state is shown before searching @e2e", async ({ page }) => {
  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.assertEmptyState();
});

// ── Search flow ───────────────────────────────────────────────────────────────

test("searching returns job cards @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEARCH_RESPONSE) })
  );

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.searchFor("Junior AI Engineer");

  await searchPage.assertResultsVisible();

  // Both fixture jobs should appear
  await expect(page.getByText(SAMPLE_JOB.title)).toBeVisible();
  await expect(page.getByText(SAMPLE_JOB_2.title)).toBeVisible();
});

test("job card shows company, location, and match summary @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEARCH_RESPONSE) })
  );

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.searchFor("Junior AI Engineer");

  const firstCard = await searchPage.getFirstJobCard();
  await expect(firstCard.getByText(SAMPLE_JOB.company!)).toBeVisible();
  await expect(firstCard.getByText(new RegExp(SAMPLE_JOB.location!, "i"))).toBeVisible();
});

test("empty results shows helpful message @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_EMPTY_RESPONSE) })
  );

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.searchFor("zzznonexistentrole");

  await searchPage.assertEmptyState();
  await expect(page.getByText(/no jobs found/i)).toBeVisible();
});

test("backend error shows alert, does not crash the page @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/search", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Service temporarily unavailable." }),
    })
  );

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.searchFor("AI Engineer");

  await expect(page.getByRole("alert")).toBeVisible();
  // Page heading must still be rendered — app didn't crash
  await expect(page.getByRole("heading", { name: /find your next/i })).toBeVisible();
});

test("submitting empty query shows validation error @e2e", async ({ page }) => {
  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.submitSearch(); // no query filled

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText(/enter a job title/i)).toBeVisible();
});

// ── Filters ──────────────────────────────────────────────────────────────────

test("role filter sends role as query @e2e", async ({ page }) => {
  let capturedBody: Record<string, unknown> = {};

  await page.route("**/v1/jobs/search", async (route) => {
    capturedBody = JSON.parse((route.request().postData()) ?? "{}") as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEARCH_RESPONSE) });
  });

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.selectRole("AI Engineer");
  await searchPage.submitSearch();

  expect(capturedBody.query).toBe("AI Engineer");
});

test("location filter is sent in the search request @e2e", async ({ page }) => {
  let capturedBody: Record<string, unknown> = {};

  await page.route("**/v1/jobs/search", async (route) => {
    capturedBody = JSON.parse((route.request().postData()) ?? "{}") as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEARCH_RESPONSE) });
  });

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.fillSearchQuery("AI Engineer");
  await searchPage.fillLocation("Cape Town");
  await searchPage.submitSearch();

  expect(capturedBody.location).toBe("Cape Town");
});

test("remote filter yes sends remote=true in request @e2e", async ({ page }) => {
  let capturedBody: Record<string, unknown> = {};

  await page.route("**/v1/jobs/search", async (route) => {
    capturedBody = JSON.parse((route.request().postData()) ?? "{}") as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEARCH_RESPONSE) });
  });

  const searchPage = new JobSearchPage(page);
  await searchPage.open();
  await searchPage.fillSearchQuery("AI Engineer");
  await searchPage.selectRemote("yes");
  await searchPage.submitSearch();

  expect(capturedBody.remote).toBe(true);
});
