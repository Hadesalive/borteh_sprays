import { test, expect } from "@playwright/test";

test("card chrome is unchanged", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("card-default")).toHaveScreenshot("card.png");
});

test("primary button bevel is unchanged", async ({ page }) => {
  await page.goto("/__visual");
  await expect(page.getByTestId("button-primary")).toHaveScreenshot("button.png");
});
