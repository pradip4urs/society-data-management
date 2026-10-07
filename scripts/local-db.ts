import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { resolve } from "node:path";
if (process.env.NODE_ENV === "production")
  throw new Error("Embedded database is development-only");
const pg = new EmbeddedPostgres({
  databaseDir: resolve(".local/postgres"),
  port: 5432,
  user: "society",
  password: "society_local_only",
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
await pg.initialise();
await pg.start();
const client = pg.getPgClient();
await client.connect();
if (
  !(await client.query("SELECT 1 FROM pg_database WHERE datname='society'"))
    .rowCount
)
  await pg.createDatabase("society");
await client.end();
console.log(
  "Local PostgreSQL ready on 127.0.0.1:5432. Keep this terminal open.",
);
async function stop() {
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
