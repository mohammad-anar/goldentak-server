import { createClient } from "redis";

const redisClient = createClient({
  // Use the environment variable, fallback to 'redis' (the service name)
  url: process.env.REDIS_URL || "redis://redis:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

// Top-level await is fine in modern Node/TS environments
await redisClient.connect();

export default redisClient;