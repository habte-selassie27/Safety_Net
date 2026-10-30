import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:5173",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath:
        "/home/izzy/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
    },
  },
  webServer: {
    command: "pnpm --filter web dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
