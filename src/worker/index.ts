import "dotenv/config";
import { Worker } from "bullmq";
import Redis from "ioredis";
const connection = new Redis(process.env.REDIS_URL!, {
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
async function stop() {
  await worker.close();
  await connection.quit();
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
