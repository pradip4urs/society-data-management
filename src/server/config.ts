import { readFileSync } from "node:fs";
function secret(name: string): string | undefined {
  const file = process.env[`${name}_FILE`];
  return file ? readFileSync(file, "utf8").trim() : process.env[name];
}
export function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const password = secret("DB_PASSWORD");
  if (!password) return undefined;
  return `postgresql://${process.env.DB_USER ?? "society_app"}:${encodeURIComponent(password)}@${process.env.DB_HOST ?? "postgres"}:5432/${process.env.DB_NAME ?? "society"}`;
}
export function redisUrl() {
  const password = secret("REDIS_PASSWORD");
  return (
    process.env.REDIS_URL ??
    `redis://${password ? ":" + encodeURIComponent(password) + "@" : ""}${process.env.REDIS_HOST ?? "redis"}:6379`
  );
}
export const authSecret = () => secret("BETTER_AUTH_SECRET");
export function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") return;
  if (
    process.env.DEV_MFA_BYPASS === "true" ||
    process.env.PAYMENT_PROVIDER === "mock" ||
    process.env.ENABLE_MOCK_PAYMENTS === "true"
  )
    throw new Error(
      "Development bypass/mock configuration is forbidden in production",
    );
  if (
    !authSecret() ||
    authSecret()!.length < 32 ||
    authSecret() === "build-only-placeholder-never-a-runtime-secret" ||
    !databaseUrl() ||
    (!process.env.REDIS_URL && !secret("REDIS_PASSWORD"))
  )
    throw new Error("Production secrets are missing");
  const url = new URL(process.env.BETTER_AUTH_URL ?? "http://invalid");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Production authentication requires a canonical HTTPS origin",
    );
  if (!process.env.DOCUMENT_ROOT?.startsWith("/"))
    throw new Error("Production private document root must be absolute");
}
