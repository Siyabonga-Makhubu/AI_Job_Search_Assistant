import { type Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class IngestPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/jobs/ingest");
  }

  async assertLoaded() {
    await expect(
      this.page.getByRole("heading", { name: /add a job/i })
    ).toBeVisible();
  }

  async fillJobUrl(url: string) {
    await this.page.getByTestId("ingest-url-input").fill(url);
  }

  async submitIngest() {
    await this.page.getByTestId("ingest-submit-button").click();
  }

  async assertLoadingState() {
    await expect(
      this.page.getByTestId("ingest-submit-button")
    ).toContainText(/ingesting/i);
  }

  async assertSuccessVisible() {
    await expect(this.page.getByTestId("ingest-success-card")).toBeVisible();
  }

  async assertErrorVisible() {
    await expect(
      this.page.getByRole("alert").filter({ hasText: /.+/ })
    ).toBeVisible();
  }

  async assertCvUploadPanelVisible() {
    await expect(
      this.page.getByRole("heading", { name: /ingest your cv/i })
    ).toBeVisible();
  }
}
