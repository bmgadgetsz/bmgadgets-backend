import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;

// Initialize Redis client using REDIS_URL env var (Aiven Valkey in production, localhost in dev)
const redis = redisUrl
  ? new Redis(redisUrl, {
      tls: redisUrl.startsWith("rediss://") ? {} : undefined,
      maxRetriesPerRequest: null,
    })
  : new Redis();

export default redis;
