import { createClient } from "redis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

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

    // Override flushAll / flushall
    if (prop === "flushAll" || prop === "flushall") {
      return async () => {
        memoryStore.clear();
        if (isRedisConnected) {
          try {
            return await rawClient.flushAll();
          } catch (err) {
            // fall through
          }
        }
        return "OK";
      };
    }

    // Default: forward to raw client
    return Reflect.get(target, prop, receiver);
  }
});

export const clearRaceCache = async (raceId?: string) => {
  // 1. Clear in-memory fallback
  for (const key of memoryStore.keys()) {
    if (key.startsWith("races:") || (raceId && key.includes(raceId))) {
      memoryStore.delete(key);
    }
  }

  // 2. Clear Redis
  if (isRedisConnected) {
    try {
      let keys = await rawClient.keys("races:*");
      if (raceId) {
        keys = keys.filter(k => k.startsWith("races:list:") || k.includes(raceId));
      }
      if (keys.length > 0) {
        await rawClient.del(keys);
      }
      console.log(`[Redis] Cleared ${keys.length} race cache keys.`);
    } catch (err: any) {
      console.warn("[Redis] Failed to clear race cache:", err.message);
    }
  }
};

export default redisClientWrapper;