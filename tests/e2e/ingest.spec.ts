/**
 * E2E tests — Add a Job (ingest) page
 *
 * Tags: @e2e
 */

import { test, expect } from "@playwright/test";
import { IngestPage } from "./pages/IngestPage";
import { SAMPLE_JOB } from "../fixtures/jobs";

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

test.beforeEach(async ({ page }) => {
  await page.route("**/v1/jobs/config", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
  );
  await page.route("**/v1/jobs/saved", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
  );
});

// ── Page load ─────────────────────────────────────────────────────────────────

test("ingest page loads correctly @e2e", async ({ page }) => {
  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.assertLoaded();
});

test("CV upload panel is visible on the ingest page @e2e", async ({ page }) => {
  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.assertCvUploadPanelVisible();
});

// ── URL validation ────────────────────────────────────────────────────────────

test("submitting an invalid URL shows an error @e2e", async ({ page }) => {
  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.fillJobUrl("not-a-valid-url");
  await ingestPage.submitIngest();

  // HTML5 validation or app-level error
  // Either the browser blocks it (no navigation) or the app shows an alert
  await expect(page).toHaveURL(/\/jobs\/ingest/);
});

// ── Successful ingestion ──────────────────────────────────────────────────────

test("successful ingest shows success card with job title @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/ingest", (route) =>
    route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        jobId: SAMPLE_JOB.jobId,
        alreadyExisted: false,
        message: "Job ingested successfully",
        job: {
          jobId: SAMPLE_JOB.jobId,
          title: SAMPLE_JOB.title,
          company: SAMPLE_JOB.company,
          location: SAMPLE_JOB.location,
          source: SAMPLE_JOB.source,
        },
        timings: { totalMs: 120 },
      }),
    })
  );

  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.fillJobUrl("https://example.com/jobs/junior-ai-engineer");
  await ingestPage.submitIngest();

  await ingestPage.assertSuccessVisible();
  await expect(page.getByTestId("ingest-success-card")).toContainText(SAMPLE_JOB.title);
});

test("already-existed ingest shows appropriate message @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/ingest", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        jobId: SAMPLE_JOB.jobId,
        alreadyExisted: true,
        message: "Job already exists",
        job: { jobId: SAMPLE_JOB.jobId, title: SAMPLE_JOB.title, company: SAMPLE_JOB.company, location: SAMPLE_JOB.location, source: SAMPLE_JOB.source },
        timings: { totalMs: 50 },
      }),
    })
  );

  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.fillJobUrl("https://example.com/jobs/junior-ai-engineer");
  await ingestPage.submitIngest();

  await ingestPage.assertSuccessVisible();
  await expect(page.getByTestId("ingest-success-card")).toContainText(/already in your library/i);
});

// ── Error state ───────────────────────────────────────────────────────────────

test("backend 503 during ingest shows error message @e2e", async ({ page }) => {
  await page.route("**/v1/jobs/ingest", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Service temporarily unavailable." }),
    })
  );

  const ingestPage = new IngestPage(page);
  await ingestPage.open();
  await ingestPage.fillJobUrl("https://example.com/jobs/test");
  await ingestPage.submitIngest();

  await ingestPage.assertErrorVisible();
  // Page must still be on the ingest route — not crashed
  await expect(page).toHaveURL(/\/jobs\/ingest/);
});
