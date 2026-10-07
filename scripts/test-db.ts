import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { mkdir } from "node:fs/promises";
await mkdir(".local", { recursive: true });
const directory = await mkdtemp(resolve(".local/test-postgres-"));
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  port: 55432,
  user: "test_society",
  password: "local_test_only",
  persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: () => {},
});
const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL:
    "postgresql://test_society:local_test_only@127.0.0.1:55432/society_test",
  NODE_ENV: "development",
  SEED_PASSWORD: "Synthetic-Test-Password-Only",
  DEV_MFA_BYPASS: "true",
  BETTER_AUTH_SECRET: "synthetic-test-auth-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3000",
};
function run(file: string, args: string[]) {
  return new Promise<void>((done, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      stdio: "inherit",
      env,
    });
    child.on("exit", (code) =>
      code === 0
        ? done()
        : reject(new Error(`Command failed (${code}): ${file}`)),
    );
    child.on("error", reject);
  });
}
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("society_test");
  await run("node_modules/prisma/build/index.js", ["migrate", "deploy"]);
  await run("node_modules/tsx/dist/cli.mjs", ["prisma/seed.ts"]);
  await run("node_modules/vitest/vitest.mjs", ["run", "tests/integration"]);
} finally {
  await pg.stop();
}
