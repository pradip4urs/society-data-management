import Redis from "ioredis";
import { createHash } from "node:crypto";
import { DomainError } from "./errors";
import type { BetterAuthRateLimitStorage } from "better-auth";
const redis = new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
redis.on("error", () => {
  /* Never log connection URLs/credentials. */
});
export const authRateStorage: BetterAuthRateLimitStorage = {
  async consume(identity, rule) {
    const key =
      "auth-limit:" + createHash("sha256").update(identity).digest("hex");
    try {
      if (redis.status === "wait") await redis.connect();
      const [allowed, ttl] = (await redis.eval(
        "local n=tonumber(redis.call('GET',KEYS[1]) or '0'); if n>=tonumber(ARGV[1]) then return {0,redis.call('TTL',KEYS[1])} end; n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[2]) end; return {1,redis.call('TTL',KEYS[1])}",
        1,
        key,
        rule.max,
        rule.window,
      )) as number[];
      return {
        allowed: allowed === 1,
        retryAfter: allowed === 1 ? null : Math.max(1, ttl),
      };
    } catch {
      return { allowed: false, retryAfter: 60 };
    }
  },
};
export async function rateLimit(identity: string, limit = 30) {
  const key =
    "limit:" +
    createHash("sha256").update(identity).digest("hex") +
    ":" +
    Math.floor(Date.now() / 60000);
  let count: number;
  try {
    if (redis.status === "wait") await redis.connect();
    count = Number(
      await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
        1,
        key,
      ),
    );
  } catch {
    throw new DomainError(
      503,
      "Request protection is unavailable. Retry shortly.",
    );
  }
  if (count > limit)
    throw new DomainError(429, "Too many requests. Retry in a minute.");
}
