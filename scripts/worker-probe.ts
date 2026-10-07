import "dotenv/config";
import { Queue, QueueEvents } from "bullmq";
import Redis from "ioredis";
const connection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});
const queue = new Queue("infrastructure", { connection });
const events = new QueueEvents("infrastructure", { connection });
try {
  const job = await queue.add(
    "probe",
    {},
    { removeOnComplete: true, removeOnFail: 20 },
  );
  await job.waitUntilFinished(events, 10000);
  console.log("Separate worker probe succeeded.");
} finally {
  await queue.close();
  await events.close();
  await connection.quit();
}
