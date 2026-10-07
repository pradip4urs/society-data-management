import { test, expect } from "@playwright/test";
test("resident login, authorized flat and profile work at supported widths", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("resident-a@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  const navigate = async (name: string) => {
    const menu = page.getByRole("button", { name: "Open navigation" });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  await navigate("My flats");
  await expect(
    page.getByText("1 authorized flats", { exact: false }),
  ).toBeVisible();
  const view = page.getByRole("button", { name: "View flat", exact: true });
  if (await view.isVisible()) await view.click();
  else await page.getByRole("button", { name: "A / 101", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Ownership history"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await navigate("My profile");
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Fictional Resident Alpha",
  );
  await expect(page.getByLabel("Private phone", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const cacheUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys.map(async (key) =>
          (await (await caches.open(key)).keys()).map(
            (r) => new URL(r.url).pathname,
          ),
        ),
      )
    ).flat();
  });
  expect(
    cacheUrls.every((path) =>
      ["/offline.html", "/icon.svg", "/icon-192.png", "/icon-512.png"].includes(
        path,
      ),
    ),
  ).toBe(true);
});
