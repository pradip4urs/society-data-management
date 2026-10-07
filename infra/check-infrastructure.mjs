import { readFileSync } from "node:fs";
import pg from "pg";
import Redis from "ioredis";

function secret(name) {
  return readFileSync(`/run/secrets/${name}`, "utf8").trim();
}

async function checkDatabase(user, file) {
  let client;
  try {
    client = new pg.Client({
      host: process.env.DB_HOST ?? "postgres",
      database: process.env.DB_NAME ?? "society",
      user,
      password: secret(file),
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    await client.connect();
    await client.query("SELECT 1");
  } catch {
    console.error(
      `Deployment preflight failed: ${user} cannot authenticate using ${file}. Restore the secret matching this PostgreSQL volume; changing a secret file does not reset an existing database password. No database or volume has been deleted.`,
    );
    process.exitCode = 1;
    return false;
  } finally {
    await client?.end().catch(() => {});
  }
  return true;
}

async function checkRedis() {
  let connection;
  try {
    connection = new Redis({
      host: process.env.REDIS_HOST ?? "redis",
      password: secret("redis_password"),
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 5000,
      retryStrategy: () => null,
      maxRetriesPerRequest: 0,
    });
    connection.on("error", () => {});
    await connection.connect();
    await connection.ping();
  } catch {
    console.error(
      "Deployment preflight failed: Redis authentication unavailable. Check redis_password and the selected SECRETS_DIR; app traffic has not been stopped by deployment.",
    );
    process.exitCode = 1;
    return false;
  } finally {
    connection?.disconnect();
  }
  return true;
}

// TCP authentication matches migration/runtime behavior; pg_isready and a local
// trusted PostgreSQL socket cannot establish that the mounted passwords match.
if (
  (await checkDatabase("society_owner", "db_owner_password")) &&
  (await checkDatabase("society_app", "db_app_password")) &&
  (await checkRedis())
) {
  console.log("Database owner/runtime and Redis credentials verified.");
}
