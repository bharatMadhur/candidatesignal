import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3301";
const useExternalServer = Boolean(process.env.E2E_BASE_URL || process.env.SMOKE_BASE_URL);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command: "npm run start -- -p 3301",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
