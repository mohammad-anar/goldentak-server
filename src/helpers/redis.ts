import { createClient } from "redis";

let isRedisConnected = false;
const memoryStore = new Map<string, { value: string; expiry: number }>();

const rawClient = createClient({
  // Use the environment variable, fallback to 'redis' (the service name)
  url: process.env.REDIS_URL || "redis://redis:6379",
});

let loggedError = false;
rawClient.on("error", (err) => {
  isRedisConnected = false;
  if (!loggedError) {
    console.warn("[Redis] Client error (will use in-memory fallback):", err.message);
    loggedError = true;
  }
});

rawClient.on("connect", () => {
  isRedisConnected = true;
  loggedError = false;
  console.log("[Redis] Connected successfully.");
});

// Start connection in the background so it doesn't block startup
rawClient.connect().catch(() => {
  // Silently handle startup connection failures since rawClient.on("error") captures it
});

const redisClientWrapper: any = new Proxy(rawClient, {
  get(target, prop, receiver) {
    // Override setEx
    if (prop === "setEx" || prop === "setex") {
      return async (key: string, seconds: number, value: string) => {
        if (isRedisConnected) {
          try {
            return await rawClient.setEx(key, seconds, value);
          } catch (err) {
            // fall through
          }
        }
        const expiry = Date.now() + seconds * 1000;
        memoryStore.set(key, { value, expiry });
        return "OK";
      };
    }

    // Override get
    if (prop === "get") {
      return async (key: string) => {
        if (isRedisConnected) {
          try {
            return await rawClient.get(key);
          } catch (err) {
            // fall through
          }
        }
        const item = memoryStore.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
          memoryStore.delete(key);
          return null;
        }
        return item.value;
      };
    }

    // Override del
    if (prop === "del") {
      return async (key: string) => {
        if (isRedisConnected) {
          try {
            return await rawClient.del(key);
          } catch (err) {
            // fall through
          }
        }
        const existed = memoryStore.has(key);
        memoryStore.delete(key);
        return existed ? 1 : 0;
      };
    }

    // Default: forward to raw client
    return Reflect.get(target, prop, receiver);
  }
});

export default redisClientWrapper;