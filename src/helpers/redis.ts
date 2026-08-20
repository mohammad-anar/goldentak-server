import { createClient } from "redis";
import IORedis from "ioredis";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

function cleanRedisUrl(raw?: string): string {
  if (!raw) return "redis://localhost:6379";
  let url = raw.trim();
  if (url.includes("-u ")) {
    url = url.split("-u ").pop()!.trim();
  }
  url = url.replace(/^['"]|['"]$/g, "");
  if (url.includes("upstash.io") && url.startsWith("redis://")) {
    url = url.replace("redis://", "rediss://");
  }
  return url;
}

// ── IORedis client (used by BullMQ) ───────────────────────────────────────────
const redisUrl = cleanRedisUrl(process.env.REDIS_URL);

export const bullRedisConnection = new (IORedis as any)(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times: number) {
    if (times > 10) {
      console.warn("[BullMQ Redis] Exceeded maximum retry attempts. Throttling reconnection...");
      return 30000; // Retry every 30s instead of tight loop
    }
    return Math.min(times * 1000, 10000);
  },
  reconnectOnError(err: Error) {
    const msg = err.message || "";
    if (msg.includes("max requests limit exceeded") || msg.includes("READONLY")) {
      console.warn("[BullMQ Redis] Reconnect prevented due to Redis limit / status:", msg);
      return false;
    }
    return true;
  },
});

bullRedisConnection.on("connect", () => console.log("[BullMQ Redis] Connected"));
bullRedisConnection.on("error", (err: Error) => {
  if (err.message?.includes("max requests limit exceeded")) {
    console.warn("[BullMQ Redis] Upstash request limit reached. BullMQ operations will be throttled.");
  } else {
    console.warn("[BullMQ Redis] Warning:", err.message);
  }
});

// ── In-memory fallback (used when Redis is unavailable) ──────────────────────
const memoryStore = new Map<string, { value: string; expiry: number }>();

const memoryFallback = {
  async setEx(key: string, seconds: number, value: string) {
    memoryStore.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return "OK";
  },
  async get(key: string) {
    const item = memoryStore.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      memoryStore.delete(key);
      return null;
    }
    return item.value;
  },
  async del(...keys: string[]) {
    let count = 0;
    for (const k of keys) {
      if (memoryStore.delete(k)) count++;
    }
    return count;
  },
  async keys(pattern: string) {
    const prefix = pattern.replace(/\*/g, "");
    return [...memoryStore.keys()].filter((k) => k.startsWith(prefix));
  },
  async flushAll() {
    memoryStore.clear();
    return "OK";
  },
  async ping() {
    return "PONG";
  },
};

// ── Redis wrapper (gracefully falls back to in-memory) ───────────────────────
class RedisClient {
  private _client: any = null;
  private _usingMemory = false;
  private _connecting = false;

  private isQuotaError(err: any): boolean {
    const msg = err?.message || "";
    return msg.includes("max requests limit exceeded") || msg.includes("OOM") || msg.includes("quota");
  }

  private async connect() {
    if (this._connecting) return;
    this._connecting = true;

    const url = cleanRedisUrl(process.env.REDIS_URL);

    try {
      const client = createClient({
        url,
        password: process.env.REDIS_PASSWORD || undefined,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 5) {
              this._usingMemory = true;
              return false; // Stop reconnecting, stay in memory mode
            }
            return Math.min(retries * 500, 3000);
          },
        },
      });

      client.on("error", (err: any) => {
        if (this.isQuotaError(err)) {
          if (!this._usingMemory) {
            console.warn("[Redis] Upstash quota limit exceeded. Switching CacheService to In-Memory mode.");
          }
          this._usingMemory = true;
        } else {
          console.warn("[Redis] Client notice:", err.message);
        }
      });

      await client.connect();
      this._client = client;
      this._usingMemory = false;
      console.log("[Redis] Connected to Redis server");
    } catch (err: any) {
      console.warn(
        `[Redis] Could not connect (${err.message}). Using in-memory fallback.`
      );
      this._usingMemory = true;
    } finally {
      this._connecting = false;
    }
  }

  private get backend(): any {
    if (this._usingMemory || !this._client) return memoryFallback;
    return this._client;
  }

  async init() {
    await this.connect();
  }

  async setEx(key: string, seconds: number, value: string): Promise<string> {
    try {
      if (!this._usingMemory && this._client) {
        await this._client.setEx(key, seconds, value);
        return "OK";
      }
    } catch (err: any) {
      if (this.isQuotaError(err)) {
        this._usingMemory = true;
      }
      console.warn("[Redis] setEx fallback to memory:", err.message);
    }
    return memoryFallback.setEx(key, seconds, value);
  }

  async get(key: string): Promise<string | null> {
    try {
      if (!this._usingMemory && this._client) {
        return await this._client.get(key);
      }
    } catch (err: any) {
      if (this.isQuotaError(err)) {
        this._usingMemory = true;
      }
      console.warn("[Redis] get fallback to memory:", err.message);
    }
    return memoryFallback.get(key);
  }

  async del(...keys: string[]): Promise<number> {
    try {
      if (!this._usingMemory && this._client) {
        return await this._client.del(keys);
      }
    } catch (err: any) {
      if (this.isQuotaError(err)) {
        this._usingMemory = true;
      }
      console.warn("[Redis] del fallback to memory:", err.message);
    }
    return memoryFallback.del(...keys);
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this._usingMemory && this._client) {
        return await this._client.keys(pattern);
      }
    } catch (err: any) {
      if (this.isQuotaError(err)) {
        this._usingMemory = true;
      }
      console.warn("[Redis] keys fallback to memory:", err.message);
    }
    return memoryFallback.keys(pattern);
  }

  async flushAll(): Promise<string> {
    try {
      if (!this._usingMemory && this._client) {
        return await this._client.flushAll();
      }
    } catch (err: any) {
      if (this.isQuotaError(err)) {
        this._usingMemory = true;
      }
      console.warn("[Redis] flushAll fallback to memory:", err.message);
    }
    return memoryFallback.flushAll();
  }

  async ping(): Promise<string> {
    try {
      if (!this._usingMemory && this._client) {
        return await this._client.ping();
      }
    } catch {
      this._usingMemory = true;
    }
    return "PONG";
  }

  isUsingMemory() {
    return this._usingMemory;
  }
}

const redisClient = new RedisClient();

// Initialise connection (non-blocking — falls back if Redis not available)
redisClient.init().catch(() => {});

export const clearRaceCache = async (raceId?: string) => {
  const keys = await redisClient.keys("races:*");
  const predKeys = await redisClient.keys("predictions:*");
  const toDelete = [...keys, ...predKeys].filter((k) =>
    raceId ? k.includes(raceId) || k.includes("today") || k.includes("list") : true
  );
  if (toDelete.length > 0) {
    await redisClient.del(...toDelete);
    console.log(`[Cache] Cleared ${toDelete.length} race cache key(s).`);
  }
};

export default redisClient;