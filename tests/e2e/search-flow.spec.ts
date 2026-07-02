import { expect, test, type Page } from "@playwright/test";

/**
 * Critical journeys, all in demo mode (mock providers, in-memory store).
 * No external API credits are spent.
 */

async function runSearch(page: Page, query: string): Promise<void> {
  await page.goto("/");
  await page.getByTestId("search-input").fill(query);
  await page.getByTestId("search-submit").click();
  // The URL is rewritten to the real thread id once the stream starts.
  await page.waitForURL(/\/thread\//);
  // Wait for the answer to complete: follow-up composer appears when done.
  await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 45_000 });
}

test.describe("anonymous search flow", () => {
  test("demo search streams an answer with sources and demo badge", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("demo-badge")).toBeVisible();

    await page
      .getByTestId("search-input")
      .fill("How close are solid state batteries to powering EVs?");
    await page.getByTestId("search-submit").click();

    // Streaming: sources render before the answer completes.
    await expect(page.getByTestId("source-count")).toBeVisible({ timeout: 30_000 });
    const sourceCount = Number(await page.getByTestId("source-count").innerText());
    expect(sourceCount).toBeGreaterThanOrEqual(4);

    await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 45_000 });
    // Answer text contains citation chips that map to real cards.
    await expect(page.getByTestId("citation-chip-1").first()).toBeVisible();
    await expect(page.getByTestId("source-card-1")).toBeVisible();
  });

  test("citation click highlights the matching source card", async ({ page }) => {
    await runSearch(page, "How close are solid state batteries to powering EVs?");
    const chip = page.getByTestId("citation-chip-1").first();
    await chip.click();
    const card = page.getByTestId("source-card-1");
    await expect(card).toHaveClass(/df-source-highlight/);
    await expect(card).toBeInViewport();
  });

  test("follow-up question adds a new turn with context", async ({ page }) => {
    await runSearch(page, "How close are solid state batteries to powering EVs?");
    await page
      .getByTestId("followup-input")
      .fill("What are the manufacturing obstacles?");
    await page.getByTestId("followup-submit").click();

    await expect(
      page.getByRole("heading", { name: "What are the manufacturing obstacles?" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 45_000 });
    // Two answered turns now exist.
    const answers = page.locator(".df-answer");
    await expect(answers).toHaveCount(2);
    await expect(answers.nth(1)).toContainText("Building on the earlier discussion");
  });

  test("thread persists after refresh", async ({ page }) => {
    await runSearch(page, "What is the current state of coral reef bleaching?");
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(
      page.getByRole("heading", {
        name: "What is the current state of coral reef bleaching?",
      }),
    ).toBeVisible();
    await expect(page.getByTestId("source-card-1")).toBeVisible();
  });

  test("research mode shows the activity panel with progress stages", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByTestId("search-input")
      .fill("What does sleep research say about memory consolidation?");
    await page.getByTestId("mode-research").click();
    await page.getByTestId("search-submit").click();

    await expect(page.getByTestId("activity-toggle")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 60_000 });
    // Expand the collapsible activity log and check stages were recorded.
    await page.getByTestId("activity-toggle").click();
    await expect(page.getByText("Planning", { exact: true })).toBeVisible();
    await expect(page.getByText("Writing", { exact: true })).toBeVisible();
    // Structured report sections rendered as markdown headings.
    await expect(page.getByRole("heading", { name: "Executive summary" })).toBeVisible();
  });
});

test.describe("account, library and workspaces", () => {
  test("sign in, persistent history, save + rename, workspace move", async ({ page }) => {
    // Long journey covering several features back to back.
    test.setTimeout(120_000);
    // Sign in with the demo account.
    await page.goto("/auth/login");
    await page.getByTestId("demo-sign-in").click();
    await page.waitForURL("**/");
    await expect(page.getByTestId("account-menu")).toBeVisible();

    // Run a search while signed in.
    await runSearch(page, "Why are teams adopting strict TypeScript?");

    // Recent history shows on the landing page.
    await page.goto("/");
    await expect(page.getByTestId("recent-thread").first()).toContainText(
      "strict TypeScript",
    );

    // Open the thread from history; save and rename it.
    await page.getByTestId("recent-thread").first().click();
    await page.waitForURL(/\/thread\//);
    await page.getByTestId("save-thread").click();
    await expect(page.getByTestId("save-thread")).toContainText("Saved");

    await page.getByTestId("thread-menu").click();
    await page.getByTestId("rename-thread").click();
    await page.getByTestId("rename-input").fill("TS migration notes");
    await page.getByTestId("rename-save").click();
    await expect(page.getByTestId("thread-title")).toContainText("TS migration notes");

    // Create a workspace and move the thread into it from the library.
    await page.goto("/spaces");
    await page.getByTestId("create-space").click();
    await page.getByTestId("space-name-input").fill("Language research");
    await page.getByTestId("space-create-confirm").click();
    await expect(page.getByTestId("space-card")).toContainText("Language research");

    await page.goto("/library");
    const row = page
      .getByTestId("library-thread")
      .filter({ hasText: "TS migration notes" });
    await expect(row).toBeVisible();
    await row.getByTestId("library-thread-menu").click();
    await page.getByRole("menuitem", { name: /Move to “Language research”/ }).click();
    await expect(row.getByText("Language research")).toBeVisible();

    // The workspace page lists the thread.
    await page.goto("/spaces");
    await page.getByTestId("space-card").click();
    await expect(page.getByTestId("space-thread")).toContainText("TS migration notes");
  });

  test("saved filter in library works", async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByTestId("demo-sign-in").click();
    await page.waitForURL("**/");

    await runSearch(page, "How close are solid state batteries to powering EVs?");
    await page.getByTestId("save-thread").click();
    await expect(page.getByTestId("save-thread")).toContainText("Saved");

    await page.goto("/library");
    await page.getByTestId("filter-saved").click();
    await expect(page.getByTestId("library-thread").first()).toContainText("batteries");
  });
});

test.describe("sharing and authorization", () => {
  test("shared thread opens in a fresh private context; private thread does not", async ({
    page,
    browser,
  }) => {
    await runSearch(page, "What is the current state of coral reef bleaching?");
    const threadUrl = page.url();

    await page.getByTestId("share-thread").click();
    const shareUrl = await page.getByTestId("share-url").inputValue();
    expect(shareUrl).toMatch(/\/share\/[A-Za-z0-9_-]{20,}/);

    // Open in an unauthenticated private context.
    const privateContext = await browser.newContext();
    const privatePage = await privateContext.newPage();
    await privatePage.goto(shareUrl);
    await expect(
      privatePage.getByRole("heading", {
        name: "What is the current state of coral reef bleaching?",
      }),
    ).toBeVisible();
    await expect(privatePage.getByText("Shared thread — read only")).toBeVisible();

    // The private (non-shared) thread URL must NOT be readable there.
    await privatePage.goto(threadUrl);
    await expect(privatePage.getByText("Thread unavailable")).toBeVisible();

    // Unshare invalidates the link.
    await page.getByTestId("unshare").click();
    await privatePage.goto(shareUrl);
    await expect(
      privatePage.getByRole("heading", { name: "Nothing surfaced here" }),
    ).toBeVisible();
    await privateContext.close();
  });

  test("another user cannot edit someone else's thread via the API", async ({
    page,
    browser,
  }) => {
    await runSearch(page, "Why are teams adopting strict TypeScript?");
    const threadId = page.url().split("/thread/")[1]!;

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await otherPage.goto("/");
    const status = await otherPage.evaluate(async (id) => {
      const response = await fetch(`/api/threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "hijacked" }),
      });
      return response.status;
    }, threadId);
    expect(status).toBe(404);

    const deleteStatus = await otherPage.evaluate(async (id) => {
      const response = await fetch(`/api/threads/${id}`, { method: "DELETE" });
      return response.status;
    }, threadId);
    expect(deleteStatus).toBe(404);
    await otherContext.close();

    // Original owner still sees the intact thread.
    await page.reload();
    await expect(page.getByTestId("thread-title")).not.toContainText("hijacked");
  });

  test("thread deletion works and removes access", async ({ page }) => {
    await runSearch(page, "How close are solid state batteries to powering EVs?");
    const threadUrl = page.url();
    await page.getByTestId("thread-menu").click();
    await page.getByTestId("delete-thread").click();
    await page.getByTestId("confirm-delete").click();
    await page.waitForURL("**/");
    await page.goto(threadUrl);
    await expect(page.getByText("Thread unavailable")).toBeVisible();
  });
});

test.describe("mobile", () => {
  test("mobile search flow works end to end @mobile", async ({ page }) => {
    await page.goto("/");
    // Mobile nav toggle present and working.
    await page.getByTestId("mobile-menu-toggle").click();
    await expect(page.locator("#mobile-nav")).toBeVisible();
    await page.getByTestId("mobile-menu-toggle").click();

    await page
      .getByTestId("search-input")
      .fill("What does sleep research say about memory consolidation?");
    await page.getByTestId("search-submit").click();
    await expect(page.getByTestId("source-count")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("followup-input")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("citation-chip-1").first()).toBeVisible();

    // Citation interaction on touch viewport.
    await page.getByTestId("citation-chip-1").first().click();
    await expect(page.getByTestId("source-card-1")).toBeInViewport();
  });
});
