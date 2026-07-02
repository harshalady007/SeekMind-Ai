import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.x A/AA audit of the primary pages using axe-core.
 * Serious and critical violations fail the build.
 */

async function auditPage(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} node(s)`);
}

test.describe("accessibility audit", () => {
  test("landing page has no serious violations", async ({ page }) => {
    await page.goto("/");
    expect(await auditPage(page)).toEqual([]);
  });

  test("login page has no serious violations", async ({ page }) => {
    await page.goto("/auth/login");
    expect(await auditPage(page)).toEqual([]);
  });

  test("library page has no serious violations", async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    expect(await auditPage(page)).toEqual([]);
  });

  test("spaces page has no serious violations", async ({ page }) => {
    await page.goto("/spaces");
    await page.waitForLoadState("networkidle");
    expect(await auditPage(page)).toEqual([]);
  });

  test("completed thread page has no serious violations", async ({ page }) => {
    await page.goto("/");
    await page
      .getByTestId("search-input")
      .fill("How close are solid state batteries to powering EVs?");
    await page.getByTestId("search-submit").click();
    await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 45_000 });
    expect(await auditPage(page)).toEqual([]);
  });

  test("core controls are keyboard reachable", async ({ page }) => {
    await page.goto("/");
    // Tab from the top: wordmark link → nav → search area must be reachable.
    let reachedComposer = false;
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const testId = await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") ?? "",
      );
      if (testId === "search-input") {
        reachedComposer = true;
        break;
      }
    }
    expect(reachedComposer).toBe(true);
  });
});
