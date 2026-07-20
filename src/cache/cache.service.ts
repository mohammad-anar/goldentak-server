import redisClient from "../helpers/redis.js";

// ─── TTL Constants (seconds) ──────────────────────────────────────────────────
export const TTL = {
  TODAY_RACES: 300,        // 5 min
  RACE_LIST: 300,          // 5 min
  RACE_DETAIL: 300,        // 5 min
  RACE_STATS: 300,         // 5 min
  RACE_LOCATIONS: 300,     // 5 min
  PREDICTION: 300,         // 5 min
  LEADERBOARD: 120,        // 2 min
  TODAY_PREDICTIONS: 300,  // 5 min
  HORSE_DETAIL: 86400,     // 24 h
  HORSE_SEARCH: 1800,      // 30 min
  AUTOCOMPLETE: 900,       // 15 min
  LIVE_ODDS: 30,           // 30 sec
  JOCKEY_STATS: 3600,      // 1 h
  TRAINER_STATS: 3600,     // 1 h
  ALGO_SETTINGS: 300,      // 5 min (invalidated on admin change)
  OTP: 300,                // 5 min
} as const;

// ─── Cache Key Namespace Map ──────────────────────────────────────────────────
export const CacheKey = {
  // Races
  todaysRaces:    (date: string)   => `races:today:${date}`,
  raceList:       (hash: string)   => `races:list:${hash}`,
  raceById:       (id: string)     => `races:id:${id}`,
  raceStats:      (id: string)     => `races:stats:${id}`,
  raceLocations:  (hash: string)   => `races:locations:${hash}`,
  raceDates:      (month: string)  => `races:dates:${month}`,

  // Predictions
  prediction:     (raceId: string) => `predictions:race:${raceId}`,
  leaderboard:    (raceId: string) => `leaderboard:race:${raceId}`,
  todayPreds:     (date: string)   => `predictions:today:${date}`,

  // Horses
  horseById:      (id: string)     => `horse:id:${id}`,
  horseSearch:    (q: string)      => `horse:search:${q}`,
  autocomplete:   (q: string)      => `autocomplete:horse:${q}`,

  // Odds
  liveOdds:       (raceId: string) => `odds:live:${raceId}`,

  // Stats
  jockeyStats:    (id: string)     => `jockey:stats:${id}`,
  trainerStats:   (id: string)     => `trainer:stats:${id}`,

  // Algorithm
  algoSettings:   ()               => `algorithm:settings:all`,

  // Auth
  otp:            (email: string)  => `otp:${email}`,
  refreshToken:   (token: string)  => `rt:${token}`,
} as const;

// ─── Cache Service ────────────────────────────────────────────────────────────
export class CacheService {
  static async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await redisClient.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err: any) {
      console.error(`[Cache] SET failed for key "${key}":`, err.message);
    }
  }

  static async del(...keys: string[]): Promise<void> {
    try {
      if (keys.length > 0) await redisClient.del(...keys);
    } catch (err: any) {
      console.error(`[Cache] DEL failed:`, err.message);
    }
  }

  static async delByPattern(pattern: string): Promise<void> {
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(...keys);
    } catch (err: any) {
      console.error(`[Cache] DEL pattern "${pattern}" failed:`, err.message);
    }
  }

  // ── Convenience wrappers ────────────────────────────────────────────────────

  static async invalidateRace(raceId?: string): Promise<void> {
    const patterns = ["races:today:*", "races:list:*", "races:locations:*", "predictions:today:*"];
    for (const p of patterns) await CacheService.delByPattern(p);
    if (raceId) {
      await CacheService.del(
        CacheKey.raceById(raceId),
        CacheKey.raceStats(raceId),
        CacheKey.prediction(raceId),
        CacheKey.leaderboard(raceId)
      );
    }
  }

  static async invalidateAlgorithmSettings(): Promise<void> {
    await CacheService.del(CacheKey.algoSettings());
  }

  static async invalidateHorse(horseId: string): Promise<void> {
    await CacheService.del(CacheKey.horseById(horseId));
    await CacheService.delByPattern("horse:search:*");
    await CacheService.delByPattern("autocomplete:horse:*");
  }

  /**
   * Cache-aside helper: returns cached value or calls loader, then caches result.
   */
  static async getOrSet<T>(
    key: string,
    ttl: number,
    loader: () => Promise<T>
  ): Promise<T> {
    const cached = await CacheService.get<T>(key);
    if (cached !== null) return cached;

    const value = await loader();
    await CacheService.set(key, value, ttl);
    return value;
  }
}
