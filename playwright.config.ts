import { defineConfig } from "@playwright/test";

const appUrl = process.env.APP_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --webpack",
    url: appUrl,
    timeout: 120_000,
    reuseExistingServer: process.env.CI !== "true",
    env: {
      APP_URL: appUrl,
      CI: "true",
      POPCORN_PROVIDER_MODE: "fixtures",
    },
  },
  projects: [
    {
      name: "chromium-extension",
      testMatch: /(?:extension\/.*|demo-acceptance)\.spec\.ts/,
      use: { baseURL: appUrl },
    },
    {
      name: "chromium-web",
      testMatch: /(saved-learning-loop|returning-learner)\.spec\.ts/,
      use: { baseURL: appUrl },
    },
  ],
});
