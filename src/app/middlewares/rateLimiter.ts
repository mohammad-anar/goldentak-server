import { RateLimiterRedis, RateLimiterMemory } from "rate-limiter-flexible";
import { Request, Response, NextFunction } from "express";
import redisClient from "../../helpers/redis.js";

/**
 * Sliding window rate limiter — 100 requests per IP per 60-second rolling window.
 *
 * Backed by Redis for distributed accuracy.
 * Falls back to in-process memory (insuranceLimiter) if Redis is unavailable,
 * ensuring the API stays up even during Redis outages.
 *
 * Headers set on every response:
 *   X-RateLimit-Limit     — max requests per window
 *   X-RateLimit-Remaining — requests left this window
 *   X-RateLimit-Reset     — Unix timestamp when the window resets
 *   Retry-After           — seconds to wait (only on 429)
 */

// Memory fallback used when Redis is down
const memoryFallback = new RateLimiterMemory({
  keyPrefix: "rl:ip:mem",
  points:    100,
  duration:  60,
});

// Primary limiter backed by Redis
const limiter = new RateLimiterRedis({
  storeClient:      redisClient,
  keyPrefix:        "rl:ip",
  points:           100,   // 100 requests
  duration:         60,    // per 60-second sliding window
  blockDuration:    0,     // no hard block; just return 429
  insuranceLimiter: memoryFallback,
});

const rateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const key = req.ip ?? req.socket.remoteAddress ?? "unknown";

  try {
    const result = await limiter.consume(key);

    res.setHeader("X-RateLimit-Limit", 100);
    res.setHeader("X-RateLimit-Remaining", result.remainingPoints);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(Date.now() / 1000) + Math.ceil(result.msBeforeNext / 1000)
    );

    next();
  } catch (err: any) {
    // err is a RateLimiterRes when the limit is exceeded
    const retryAfter = Math.ceil((err?.msBeforeNext ?? 60_000) / 1000);

    res.setHeader("Retry-After", retryAfter);
    res.setHeader("X-RateLimit-Limit", 100);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader(
      "X-RateLimit-Reset",
      Math.ceil(Date.now() / 1000) + retryAfter
    );

    res.status(429).json({
      success:    false,
      statusCode: 429,
      message:    `Too many requests. Try again in ${retryAfter}s.`,
    });
  }
};

export default rateLimiter;
