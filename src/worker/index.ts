import "dotenv/config";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { redisUrl, assertProductionConfig } from "../server/config";
import { scanPending } from "../server/documents";
import { db } from "../server/db";
import { writeFile } from "node:fs/promises";
assertProductionConfig();
const connection = new Redis(redisUrl(), {
  maxRetriesPerRequest: null,
});
// Stage 1 has no business jobs. Unknown jobs fail rather than silently completing.
const worker = new Worker(
  "infrastructure",
  async (job) => {
    if (job.name !== "probe") throw new Error("Unsupported Stage 1 job");
    return { ok: true };
  },
  { connection },
);
worker.on("failed", () => console.error("Infrastructure job failed"));
let scanning = false;
const timer = setInterval(async () => {
  if (scanning) return;
  scanning = true;
  try {
    await db.$queryRaw`SELECT 1`;
    await connection.ping();
    await writeFile("/tmp/worker-heartbeat", String(Date.now()));
    await scanPending();
  } catch {
    /* Fail closed; quarantine rows remain retryable. Heartbeat expires on DB/Redis outage. */
  } finally {
    scanning = false;
  }
}, 5000);
async function stop() {
  clearInterval(timer);
  await worker.close();
  await connection.quit();
  await db.$disconnect();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
