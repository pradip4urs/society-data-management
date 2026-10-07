import { test, expect } from "@playwright/test";
test("admin creates a synthetic person through validated form", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("button", { name: "Manage records", exact: true })
    .click();
  const section = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Add person", exact: true }),
  });
  await section
    .getByLabel("Full name", { exact: true })
    .fill(`Synthetic UI ${testInfo.project.name}`);
  await section.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Owner", exact: true }),
  ).toContainText(`Synthetic UI ${testInfo.project.name}`);
  await expect(
    page.getByText("Loading authorized records…", { exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/admin-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
