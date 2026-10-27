# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\dashboard.spec.ts >> navigation is accessible on mobile viewport @responsive
- Location: tests\e2e\dashboard.spec.ts:114:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: /job discovery/i })
Expected: visible
Error: strict mode violation: getByRole('button', { name: /job discovery/i }) resolved to 2 elements:
    1) <button class="nav-link " data-testid="nav-jobs">…</button> aka getByTestId('nav-jobs')
    2) <button class="quick-card">…</button> aka getByRole('button', { name: 'Explore jobs Search stored AI' })

Call log:
  - Expect "toBeVisible" getByRole('button', { name: /job discovery/i }) with timeout 10000ms
  - waiting for getByRole('button', { name: /job discovery/i })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e10]:
        - strong [ref=e11]: JOB ASSISTANT
        - generic [ref=e12]: RESUME SKILL MATCH
      - button "Close navigation" [ref=e13] [cursor=pointer]
    - generic [ref=e17]: WORKSPACE
    - navigation "Main navigation" [ref=e18]:
      - button [ref=e19] [cursor=pointer]
      - button [ref=e25] [cursor=pointer]
      - button [ref=e30] [cursor=pointer]
      - button "Saved jobs 0" [ref=e35] [cursor=pointer]:
        - text: Saved jobs
        - generic [ref=e40]: "0"
      - button [ref=e41] [cursor=pointer]
    - generic [ref=e46]:
      - text: Connected to Resume RAG API
      - generic [ref=e48]: Evidence grounded in your resume
  - button "Close navigation" [ref=e49] [cursor=pointer]
  - main [ref=e50]:
    - generic [ref=e51]:
      - button "Open navigation" [active] [ref=e52] [cursor=pointer]
      - generic [ref=e54]:
        - text: Workspace
        - strong [ref=e57]: Overview
      - generic [ref=e58]: REST API
    - generic [ref=e60]:
      - generic [ref=e66]:
        - strong [ref=e67]: Your job search, grounded in real resume evidence
        - paragraph [ref=e68]: Discover roles, review requirements against your Resume RAG profile, and prepare application drafts for your review.
      - generic [ref=e70]:
        - generic [ref=e71]: YOUR WORKSPACE
        - heading "Good day. Ready to find your next role?" [level=1] [ref=e72]
        - paragraph [ref=e73]: Search current job records or add a public job listing to get started.
      - generic [ref=e74]:
        - button "Explore jobs Search stored AI engineering roles and compare them with resume evidence. Open job discovery" [ref=e75] [cursor=pointer]:
          - generic [ref=e80]: Explore jobs
          - generic [ref=e84]: Search stored AI engineering roles and compare them with resume evidence.
          - generic [ref=e85]: Open job discovery
        - button "Add a job Ingest a public job URL into the backend for details and matching. Add a listing" [ref=e88] [cursor=pointer]:
          - generic [ref=e95]: Add a job
          - generic [ref=e99]: Ingest a public job URL into the backend for details and matching.
          - generic [ref=e100]: Add a listing
      - generic [ref=e103]:
        - generic [ref=e104]:
          - generic [ref=e105]:
            - generic [ref=e106]: SYSTEM CONNECTION
            - heading "Job search defaults" [level=2] [ref=e107]
          - generic [ref=e108]: BACKEND CONFIG
        - generic [ref=e110]:
          - generic [ref=e111]:
            - generic [ref=e112]: Configured search roles
            - generic [ref=e113]:
              - generic [ref=e114]: Junior AI Engineer
              - generic [ref=e115]: AI Engineer
              - generic [ref=e116]: Generative AI Engineer
          - generic [ref=e117]:
            - generic [ref=e118]: Default location
            - strong [ref=e119]: South Africa
          - generic [ref=e120]:
            - generic [ref=e121]: Remote filter
            - strong [ref=e122]: Any workplace
      - paragraph [ref=e127]: Counts and activity history are not shown here because the backend does not currently expose job statistics or history endpoints.
```

# Test source

```ts
  33  | });
  34  | 
  35  | // ── Smoke test ────────────────────────────────────────────────────────────────
  36  | 
  37  | test("dashboard loads and shows heading @smoke @e2e", async ({ page }) => {
  38  |   const dashboard = new DashboardPage(page);
  39  |   await dashboard.open();
  40  |   await dashboard.assertLoaded();
  41  | });
  42  | 
  43  | // ── Navigation ────────────────────────────────────────────────────────────────
  44  | 
  45  | test("all five navigation links are visible @smoke @e2e", async ({ page }) => {
  46  |   const dashboard = new DashboardPage(page);
  47  |   await dashboard.open();
  48  |   await dashboard.assertNavigationVisible();
  49  | });
  50  | 
  51  | test("clicking Job discovery navigates to /jobs", async ({ page }) => {
  52  |   const dashboard = new DashboardPage(page);
  53  |   await dashboard.open();
  54  |   await dashboard.navigateToJobDiscovery();
  55  |   await expect(page).toHaveURL(/\/jobs/);
  56  |   await expect(
  57  |     page.getByRole("heading", { name: /find your next/i })
  58  |   ).toBeVisible();
  59  | });
  60  | 
  61  | test("clicking Add a job navigates to /jobs/ingest", async ({ page }) => {
  62  |   const dashboard = new DashboardPage(page);
  63  |   await dashboard.open();
  64  |   await dashboard.navigateToIngest();
  65  |   await expect(page).toHaveURL(/\/jobs\/ingest/);
  66  |   await expect(
  67  |     page.getByRole("heading", { name: /add a job/i })
  68  |   ).toBeVisible();
  69  | });
  70  | 
  71  | test("clicking DeepEval Metrics navigates to /evaluation", async ({ page }) => {
  72  |   const dashboard = new DashboardPage(page);
  73  |   await dashboard.open();
  74  | 
  75  |   // Mock the evaluations endpoints before navigating
  76  |   await page.route("**/v1/jobs/evaluations**", (route) =>
  77  |     route.fulfill({
  78  |       status: 200,
  79  |       contentType: "application/json",
  80  |       body: JSON.stringify({
  81  |         success: true,
  82  |         settings: {
  83  |           enabled: true,
  84  |           judgeModel: "openai/gpt-oss-120b",
  85  |           alignmentThreshold: 0.7,
  86  |           relevancyThreshold: 0.7,
  87  |           faithfulnessThreshold: 0.7,
  88  |           maxJobs: 10,
  89  |         },
  90  |         results: [],
  91  |       }),
  92  |     })
  93  |   );
  94  | 
  95  |   await dashboard.navigateToDeepEval();
  96  |   await expect(page).toHaveURL(/\/evaluation/);
  97  |   await expect(page.getByTestId("deepeval-heading")).toBeVisible();
  98  | });
  99  | 
  100 | // ── Config panel ──────────────────────────────────────────────────────────────
  101 | 
  102 | test("backend config panel shows configured search roles", async ({ page }) => {
  103 |   const dashboard = new DashboardPage(page);
  104 |   await dashboard.open();
  105 | 
  106 |   // Wait for the config to load (replaces the Loading spinner)
  107 |   await expect(page.getByTestId("dashboard-config-panel")).toBeVisible();
  108 |   await expect(page.getByText("Junior AI Engineer")).toBeVisible();
  109 |   await expect(page.getByText("South Africa")).toBeVisible();
  110 | });
  111 | 
  112 | // ── Responsive ────────────────────────────────────────────────────────────────
  113 | 
  114 | test("navigation is accessible on mobile viewport @responsive", async ({ page }) => {
  115 |   await page.setViewportSize({ width: 390, height: 844 });
  116 | 
  117 |   await page.route("**/v1/jobs/config", (route) =>
  118 |     route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONFIG) })
  119 |   );
  120 |   await page.route("**/v1/jobs/saved", (route) =>
  121 |     route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, jobs: [] }) })
  122 |   );
  123 | 
  124 |   await page.goto("/");
  125 |   await page.waitForLoadState("networkidle");
  126 | 
  127 |   // Mobile: open the hamburger menu
  128 |   const menuButton = page.getByRole("button", { name: /open navigation/i });
  129 |   await expect(menuButton).toBeVisible();
  130 |   await menuButton.click();
  131 | 
  132 |   // Nav links should now be visible
> 133 |   await expect(page.getByRole("button", { name: /job discovery/i })).toBeVisible();
      |                                                                      ^ Error: expect(locator).toBeVisible() failed
  134 | });
  135 | 
```