import { expect, test } from "@playwright/test";

test("demo path: feed → incident → report → policy gaps", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /The public record of/ }),
  ).toBeVisible();

  // Step 2: incident feed with seeded incidents
  await page.goto("/incidents");
  const rows = page.locator("[data-testid='incident-row']");
  await expect(rows.first()).toBeVisible();

  // Step 3: click one → see verdict + clause citations + evidence hash
  await rows.first().locator("a").first().click();
  await expect(page.getByTestId("verdict-badge")).toBeVisible();
  await expect(page.getByTestId("verdict-summary")).toBeVisible();

  // Step 4: Report incident
  await page.goto("/report");
  await expect(
    page.getByRole("heading", { name: "Report an incident" }),
  ).toBeVisible();

  // Step 7: Policy Gaps
  await page.goto("/policy-gaps");
  await expect(
    page.getByRole("heading", { name: /Policy gaps/ }),
  ).toBeVisible();
});

test("home renders trust boundary link", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByText("Trust boundary", { exact: false }).first(),
  ).toBeVisible();
});

test("404 page", async ({ page }) => {
  await page.goto("/this-does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});
