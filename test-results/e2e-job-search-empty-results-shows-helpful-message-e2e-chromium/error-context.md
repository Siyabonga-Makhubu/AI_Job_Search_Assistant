# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\job-search.spec.ts >> empty results shows helpful message @e2e
- Location: tests\e2e\job-search.spec.ts:111:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('job-empty-state')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('job-empty-state') with timeout 10000ms
  - waiting for getByTestId('job-empty-state')

```

```yaml
- complementary:
  - strong: JOB ASSISTANT
  - text: RESUME SKILL MATCH WORKSPACE
  - navigation "Main navigation":
    - button "Overview"
    - button "Job discovery"
    - button "Add a job"
    - button "Saved jobs 0"
    - button "DeepEval Metrics"
  - text: Connected to Resume RAG API Evidence grounded in your resume
- main:
  - text: Workspace
  - strong: Job discovery
  - text: REST API DISCOVER OPPORTUNITIES
  - heading "Find your next AI engineering role" [level=1]
  - paragraph: Search job records from the backend and explore how each role aligns with documented candidate evidence.
  - text: Search jobs
  - textbox "Search jobs":
    - /placeholder: e.g. Junior AI Engineer, RAG, Python, LLM
    - text: zzznonexistentrole
  - button "Search jobs"
  - text: Role
  - combobox "Role":
    - option "Any role" [selected]
    - option "Junior AI Engineer"
    - option "AI Engineer"
    - option "Generative AI Engineer"
  - text: Location
  - textbox "Location":
    - /placeholder: Any location
    - text: South Africa
  - text: Remote
  - combobox "Remote":
    - option "Any" [selected]
    - option "Remote"
    - option "On-site / hybrid"
  - text: Source
  - combobox "Source":
    - option "All supported sources" [selected]
  - text: SEARCH RESULTS
  - heading "0 roles found" [level=2]
  - text: 0 returned by backend
  - strong: No jobs found
  - paragraph: Try another job title, broader search terms, or a different location.
```

# Test source

```ts
  1  | import { type Page, expect } from "@playwright/test";
  2  | import { BasePage } from "./BasePage";
  3  | 
  4  | export class JobSearchPage extends BasePage {
  5  |   constructor(page: Page) {
  6  |     super(page);
  7  |   }
  8  | 
  9  |   async open() {
  10 |     await this.goto("/jobs");
  11 |   }
  12 | 
  13 |   // ── Form interactions ────────────────────────────────────────────────────
  14 | 
  15 |   async fillSearchQuery(query: string) {
  16 |     await this.page.getByTestId("job-search-input").fill(query);
  17 |   }
  18 | 
  19 |   async selectRole(role: string) {
  20 |     await this.page.getByTestId("job-role-select").selectOption(role);
  21 |   }
  22 | 
  23 |   async fillLocation(location: string) {
  24 |     await this.page.getByTestId("job-location-input").fill(location);
  25 |   }
  26 | 
  27 |   async selectRemote(value: "any" | "yes" | "no") {
  28 |     await this.page.getByTestId("job-remote-select").selectOption(value);
  29 |   }
  30 | 
  31 |   async submitSearch() {
  32 |     await this.page.getByTestId("job-search-button").click();
  33 |   }
  34 | 
  35 |   async searchFor(query: string) {
  36 |     await this.fillSearchQuery(query);
  37 |     await this.submitSearch();
  38 |   }
  39 | 
  40 |   // ── State assertions ─────────────────────────────────────────────────────
  41 | 
  42 |   async assertSearchFormVisible() {
  43 |     await expect(this.page.getByTestId("job-search-input")).toBeVisible();
  44 |     await expect(this.page.getByTestId("job-search-button")).toBeVisible();
  45 |   }
  46 | 
  47 |   async assertLoadingVisible() {
  48 |     // Button shows "Searching…" text while loading
  49 |     await expect(
  50 |       this.page.getByTestId("job-search-button")
  51 |     ).toContainText("Searching");
  52 |   }
  53 | 
  54 |   async assertResultsVisible() {
  55 |     await expect(this.page.getByTestId("job-results-grid")).toBeVisible();
  56 |   }
  57 | 
  58 |   async assertEmptyState() {
> 59 |     await expect(this.page.getByTestId("job-empty-state")).toBeVisible();
     |                                                            ^ Error: expect(locator).toBeVisible() failed
  60 |   }
  61 | 
  62 |   async assertResultCount(count: number) {
  63 |     const cards = this.page.getByTestId("job-card");
  64 |     await expect(cards).toHaveCount(count);
  65 |   }
  66 | 
  67 |   async getFirstJobCard() {
  68 |     return this.page.getByTestId("job-card").first();
  69 |   }
  70 | 
  71 |   async clickFirstJobDetail() {
  72 |     // Click the arrow-up-right icon button to open job details
  73 |     await this.page.getByTestId("job-card").first()
  74 |       .getByRole("button", { name: /view/i })
  75 |       .click();
  76 |   }
  77 | 
  78 |   async clickAnalyseOnFirstCard() {
  79 |     await this.page.getByTestId("job-card").first()
  80 |       .getByRole("button", { name: /analyse match/i })
  81 |       .click();
  82 |   }
  83 | }
  84 | 
```