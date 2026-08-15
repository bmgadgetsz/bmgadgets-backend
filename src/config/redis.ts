import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

// Initialize Redis client using REDIS_URL env var (Aiven Valkey in production, localhost in dev)
const redis = redisUrl
  ? new Redis(redisUrl, {
      tls: redisUrl.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        return Math.min(times * 2000, 15000);
      },
    })
  : new Redis({
      maxRetriesPerRequest: null,
      enableOfflineQueue: false,
      retryStrategy(times) {
        return Math.min(times * 2000, 15000);
      },
    });

// Catch unhandled error events gracefully to prevent server log spam when Valkey is off or connecting
redis.on("error", (err) => {
  if (err.message.includes("ENOTFOUND")) {
    // Quiet warning for DNS resolution issues
    return;
  }
  console.warn("[Redis Warning]", err.message);
});

export default redis;
