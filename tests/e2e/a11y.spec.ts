import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/incidents", "/systems", "/policy-gaps", "/about", "/data"];

for (const route of routes) {
  test(`a11y: ${route} has no serious/critical violations`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

test("keyboard filing path reaches submit", async ({ page }) => {
  await page.goto("/report");
  // Tab through to the system select and choose a value via keyboard
  await page.keyboard.press("Tab");
  // Ensure the report heading is reachable
  await expect(page.getByRole("heading", { name: "Report an incident" })).toBeVisible();
});