import { type Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DeepEvalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/evaluation");
  }

  async assertLoaded() {
    await expect(this.page.getByTestId("deepeval-heading")).toBeVisible();
  }

  async assertKpiCardsVisible() {
    const cards = this.page.getByTestId("deepeval-kpi-card");
    await expect(cards.first()).toBeVisible();
  }

  async assertRunButtonVisible() {
    await expect(this.page.getByTestId("deepeval-run-button")).toBeVisible();
  }

  async assertRunButtonEnabled() {
    await expect(this.page.getByTestId("deepeval-run-button")).toBeEnabled();
  }

  async assertRunButtonDisabled() {
    await expect(this.page.getByTestId("deepeval-run-button")).toBeDisabled();
  }

  async fillEvaluationQuery(query: string) {
    await this.page.getByTestId("deepeval-query-input").fill(query);
  }

  async clickRunEvaluation() {
    await this.page.getByTestId("deepeval-run-button").click();
  }

  async assertLoadingState() {
    await expect(
      this.page.getByTestId("deepeval-run-button")
    ).toContainText(/evaluating/i);
  }

  async assertErrorVisible() {
    await expect(
      this.page.getByRole("alert").filter({ hasText: /.+/ })
    ).toBeVisible();
  }

  async assertResultsTableVisible() {
    await expect(this.page.getByTestId("deepeval-results-table")).toBeVisible();
  }

  async assertEmptyHistoryState() {
    await expect(this.page.getByTestId("deepeval-empty-state")).toBeVisible();
  }

  async selectMetricFilter(metric: string) {
    await this.page.getByTestId("deepeval-metric-filter").selectOption(metric);
  }

  async selectPassFilter(value: "passed" | "failed" | "") {
    await this.page.getByTestId("deepeval-pass-filter").selectOption(value);
  }

  async assertScoreCell(text: string) {
    await expect(
      this.page.getByTestId("deepeval-results-table").getByText(text)
    ).toBeVisible();
  }
}
