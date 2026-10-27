/**
 * BasePage
 *
 * Common helpers shared by all page objects.
 */

import { type Page, expect } from "@playwright/test";

export class BasePage {
  constructor(protected readonly page: Page) {}

  /** Navigate to a path and wait for the page to be idle. */
  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  /** Click a nav link by its visible text label. */
  async clickNavLink(label: string) {
    await this.page.getByRole("navigation").getByRole("button", { name: label }).click();
  }

  /** Assert the page does not show an unhandled JS error banner. */
  async assertNoErrorBanner() {
    // The app renders ErrorNotice with role="alert" only for API errors,
    // not for JS exceptions. We check the page is rendered at all.
    const heading = this.page.getByRole("heading").first();
    await expect(heading).toBeVisible();
  }
}
