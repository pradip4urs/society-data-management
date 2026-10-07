import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/production",
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  use: {
    baseURL: process.env.REHEARSAL_URL ?? "https://localhost:8443",
    ignoreHTTPSErrors: true,
    trace: "off",
  },
  projects: [
    { name: "production", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
