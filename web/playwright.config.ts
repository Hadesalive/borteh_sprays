import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/__visual",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  expect: { toHaveScreenshot: { maxDiffPixels: 0 } },
});
