import { defineConfig } from "@playwright/test";
const base = process.env.PUBLIC_BASE_PATH || "/";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:3000${base}`,
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm preview",
    url: `http://127.0.0.1:3000${base}`,
    reuseExistingServer: !process.env.CI,
  },
});
