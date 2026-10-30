import { expect, test } from "@playwright/test";

test("filing flow: select system → claim → evidence → review → submit (demo)", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "Report an incident" })).toBeVisible();

  // Step 0: system + policy version
  const systemSelect = page.getByLabel("AI system");
  await systemSelect.selectOption({ index: 1 });
  const policySelect = page.getByLabel("Policy version");
  await policySelect.selectOption({ index: 0 });
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 1: claim
  await page.getByLabel("What did the system do?").fill(
    "The assistant gave a specific prescription dosage despite clause C1 forbidding dosage instructions.",
  );
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: evidence (inline)
  await page.getByLabel("Verbatim text").fill(
    "SYNTHETIC TRANSCRIPT: 'Take 4000mg of DrugX every hour.'",
  );
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 3: review + permanence
  await page.getByLabel(/permanent and public/i).check();
  await page.getByRole("button", { name: "Continue to submit" }).click();

  // Step 4: submit (demo)
  await page.getByRole("button", { name: /Submit incident/i }).click();
  await expect(page.getByTestId("tx-progress")).toBeVisible();

  // Redirect to incident page
  await page.waitForURL(/\/incidents\/inc-/, { timeout: 10_000 });
  await expect(page.getByTestId("page-incident")).toBeVisible();
  await expect(page.getByTestId("claim-text")).toBeVisible();

  // Run permissionless adjudication (demo) and read the verdict
  const adjudicate = page.getByTestId("adjudicate-button");
  if (await adjudicate.isVisible()) {
    await adjudicate.click();
    await expect(page.getByTestId("verdict-badge")).toBeVisible({ timeout: 10_000 });
  }
});

test("policy gaps page renders groups", async ({ page }) => {
  await page.goto("/policy-gaps");
  await expect(page.getByRole("heading", { name: /Policy gaps/ })).toBeVisible();
});