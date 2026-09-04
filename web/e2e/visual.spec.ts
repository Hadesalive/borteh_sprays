import { test, expect } from "@playwright/test";

test("card chrome (v6 — square, bronze/paper)", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-default")).toHaveScreenshot("card.png");
});

test("primary button (v6 — square, bronze/paper)", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-primary")).toHaveScreenshot("button.png");
});

test("display heading uses Instrument Serif", async ({ page }) => {
  await page.goto("/__visual");
  const heading = page.getByTestId("heading-display");
  await expect(heading).toHaveScreenshot("heading.png");
  const family = await heading.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family.toLowerCase()).toContain("instrument serif");
});

test("dark mode card chrome", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-dark")).toHaveScreenshot("card-dark.png");
});

test("dark mode primary button", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-dark")).toHaveScreenshot("button-dark.png");
});
