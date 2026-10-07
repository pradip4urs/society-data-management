import { afterEach, expect, it } from "vitest";
import { assertProductionConfig } from "@/server/config";
const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});
it("refuses missing secrets, mock payments, MFA bypass and noncanonical production origins", () => {
  Object.assign(process.env, {
    NODE_ENV: "production",
    BETTER_AUTH_SECRET: "synthetic-test-secret-longer-than-32",
    DATABASE_URL: "postgresql://test:test@postgres/society",
    REDIS_URL: "redis://test@redis",
    DOCUMENT_ROOT: "/documents",
    BETTER_AUTH_URL: "https://society.example.test",
    DEV_MFA_BYPASS: "false",
  });
  expect(() => assertProductionConfig()).not.toThrow();
  process.env.ENABLE_MOCK_PAYMENTS = "true";
  expect(() => assertProductionConfig()).toThrow("forbidden");
  delete process.env.ENABLE_MOCK_PAYMENTS;
  process.env.DEV_MFA_BYPASS = "true";
  expect(() => assertProductionConfig()).toThrow("forbidden");
  process.env.DEV_MFA_BYPASS = "false";
  process.env.BETTER_AUTH_URL = "http://society.example.test";
  expect(() => assertProductionConfig()).toThrow("HTTPS");
  process.env.BETTER_AUTH_URL = "https://society.example.test";
  process.env.BETTER_AUTH_SECRET =
    "build-only-placeholder-never-a-runtime-secret";
  expect(() => assertProductionConfig()).toThrow("secrets");
});
