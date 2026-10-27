import { type Page, expect } from "@playwright/test";
import { BasePage } from "./BasePage";

export class DashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async open() {
    await this.goto("/");
  }

  async assertLoaded() {
    await expect(
      this.page.getByTestId("dashboard-heading"),
      "Dashboard heading must be visible"
    ).toBeVisible();
  }

  async assertNavigationVisible() {
    const nav = this.page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole("button", { name: /overview/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: /job discovery/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: /add a job/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: /saved jobs/i })).toBeVisible();
    await expect(nav.getByRole("button", { name: /deepeval/i })).toBeVisible();
  }

  async assertConfigPanelVisible() {
    // The config panel either shows roles or a loading state
    const panel = this.page.getByTestId("dashboard-config-panel");
    await expect(panel).toBeVisible();
  }

  async navigateToJobDiscovery() {
    await this.page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: /job discovery/i })
      .click();
  }

  async navigateToIngest() {
    await this.page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: /add a job/i })
      .click();
  }

  async navigateToDeepEval() {
    await this.page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: /deepeval/i })
      .click();
  }
}
