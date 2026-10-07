import "dotenv/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { access } from "node:fs/promises";
import { Client } from "pg";
if (process.env.NODE_ENV === "production")
  throw new Error("This script is a local synthetic restore drill only");
const source = new URL(process.env.DATABASE_URL!);
if (source.hostname !== "127.0.0.1" || source.pathname !== "/society")
  throw new Error("Drill requires the explicitly named local society database");
const client = new Client({ connectionString: source.toString() });
await client.connect();
if (
  (
    await client.query(
      "SELECT count(*)::int AS count FROM \"Society\" WHERE id NOT IN ('demo-society','other-society')",
    )
  ).rows[0].count
)
  throw new Error("Drill requires synthetic seed societies only");
const native = process.env.PG_TOOLS_DIR ?? "";
if (!native)
  throw new Error(
    "Set PG_TOOLS_DIR to PostgreSQL 18's bin directory. Embedded server binaries do not include pg_dump/pg_restore.",
  );
await access(resolve(native, "pg_dump.exe"));
await access(resolve(native, "pg_restore.exe"));
await mkdir(".local/backups", { recursive: true });
const backup = resolve(".local/backups/society.dump");
async function run(command: string, args: string[]) {
  await new Promise<void>((done, reject) => {
    const child = spawn(resolve(native, command + ".exe"), args, {
      stdio: "inherit",
      env: { ...process.env, PGPASSWORD: source.password },
    });
    child.on("exit", (code) =>
      code === 0
        ? done()
        : reject(new Error(`Restore command failed: ${command}`)),
    );
    child.on("error", reject);
  });
}
const common = [
  "-h",
  source.hostname,
  "-p",
  source.port || "5432",
  "-U",
  source.username,
];
const target = "society_restore_drill_" + Date.now();
try {
  // No DROP or overwrite: repeat runs require a newly named reviewed drill database.
  await client.query(`CREATE DATABASE "${target}"`);
  await run("pg_dump", [...common, "-d", "society", "-Fc", "-f", backup]);
  await run("pg_restore", [
    ...common,
    "-d",
    target,
    "--no-owner",
    "--exit-on-error",
    backup,
  ]);
  const restoredUrl = new URL(source);
  restoredUrl.pathname = "/" + target;
  const restored = new Client({ connectionString: restoredUrl.toString() });
  await restored.connect();
  try {
    for (const table of [
      "Society",
      "Flat",
      "Person",
      "Ownership",
      "Occupancy",
      "ResidentAccessGrant",
      "ParkingAllocation",
      "AuditEvent",
    ]) {
      const original = (
        await client.query(`SELECT count(*)::int AS count FROM "${table}"`)
      ).rows[0].count;
      const copy = (
        await restored.query(`SELECT count(*)::int AS count FROM "${table}"`)
      ).rows[0].count;
      if (original !== copy) throw new Error("Restored row count mismatch");
      console.log(table, copy, "matched");
    }
    const exclusion = await restored.query(
      "SELECT 1 FROM pg_constraint WHERE conname='no_exclusive_parking_overlap'",
    );
    if (!exclusion.rowCount)
      throw new Error("Parking exclusion missing after restore");
    let blocked = false;
    try {
      await restored.query("UPDATE \"AuditEvent\" SET action='TAMPER'");
    } catch {
      blocked = true;
    }
    if (!blocked) throw new Error("Audit immutability missing after restore");
    console.log(
      "Synthetic restore drill passed; target database retained for inspection.",
    );
  } finally {
    await restored.end();
  }
} finally {
  await client.end();
}
