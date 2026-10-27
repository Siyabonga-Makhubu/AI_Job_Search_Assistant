import { type Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class JobSearchPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/jobs");
  }

  // ── Form interactions ────────────────────────────────────────────────────

  async fillSearchQuery(query: string) {
    await this.page.getByTestId("job-search-input").fill(query);
  }

  async selectRole(role: string) {
    await this.page.getByTestId("job-role-select").selectOption(role);
  }

  async fillLocation(location: string) {
    await this.page.getByTestId("job-location-input").fill(location);
  }

  async selectRemote(value: "any" | "yes" | "no") {
    await this.page.getByTestId("job-remote-select").selectOption(value);
  }

  async submitSearch() {
    await this.page.getByTestId("job-search-button").click();
  }

  async searchFor(query: string) {
    await this.fillSearchQuery(query);
    await this.submitSearch();
  }

  // ── State assertions ─────────────────────────────────────────────────────

  async assertSearchFormVisible() {
    await expect(this.page.getByTestId("job-search-input")).toBeVisible();
    await expect(this.page.getByTestId("job-search-button")).toBeVisible();
  }

  async assertLoadingVisible() {
    // Button shows "Searching…" text while loading
    await expect(
      this.page.getByTestId("job-search-button")
    ).toContainText("Searching");
  }

  async assertResultsVisible() {
    await expect(this.page.getByTestId("job-results-grid")).toBeVisible();
  }

  async assertEmptyState() {
    await expect(this.page.getByTestId("job-empty-state")).toBeVisible();
  }

  async assertResultCount(count: number) {
    const cards = this.page.getByTestId("job-card");
    await expect(cards).toHaveCount(count);
  }

  async getFirstJobCard() {
    return this.page.getByTestId("job-card").first();
  }

  async clickFirstJobDetail() {
    // Click the arrow-up-right icon button to open job details
    await this.page.getByTestId("job-card").first()
      .getByRole("button", { name: /view/i })
      .click();
  }

  async clickAnalyseOnFirstCard() {
    await this.page.getByTestId("job-card").first()
      .getByRole("button", { name: /analyse match/i })
      .click();
  }
}
