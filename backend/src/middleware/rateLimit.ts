import type { RequestHandler } from "express";

import { logger } from "../lib/logger";
import { getRedis } from "../lib/redis";

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
// Development: much higher limits, production: normal limits
const RATE_LIMIT_MAX_REQUESTS = process.env.NODE_ENV === "development" ? 10000 : 100; // Max requests per window
const USER_RATE_LIMIT = process.env.NODE_ENV === "development" ? 20000 : 200; // Higher limit for authenticated users
const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === "true"; // Completely disable rate limiting if needed

// Paths that should be excluded from rate limiting
const EXCLUDED_PATHS = [
  "/health",
  "/ready",
  "/live",
  "/api/health",
];

/**
 * Redis-based rate limiting middleware
 * Limits requests per IP address
 * Uses a sliding window approach with proper key expiration
 */
export const rateLimit: RequestHandler = async (req, res, next) => {
  // Skip rate limiting if disabled
  if (DISABLE_RATE_LIMIT) {
    return next();
  }

  // Skip rate limiting for health check endpoints
  if (EXCLUDED_PATHS.includes(req.path)) {
    return next();
  }

  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    
    // Use a more specific key with timestamp to prevent stale keys
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW);
    const key = `rate_limit:${ip}:${windowStart}`;
    
    let redis;
    try {
      redis = getRedis();
    } catch (error) {
      // If Redis is not available, allow request (fail open)
      logger.warn({ error }, "Redis not available for rate limiting, allowing request");
      return next();
    }

    // Use INCR which returns the new value, and set expiration on first increment
    const count = await redis.incr(key);
    
    // Set expiration only on first request in this window
    if (count === 1) {
      // Set expiration to slightly longer than window to handle edge cases
      await redis.expire(key, RATE_LIMIT_WINDOW + 10);
    }

    // Check limit AFTER incrementing (count is now the new value)
    if (count > RATE_LIMIT_MAX_REQUESTS) {
      logger.warn({ ip, count, windowStart }, "Rate limit exceeded");
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute.`,
        retryAfter: RATE_LIMIT_WINDOW,
      });
    }

    // Add rate limit headers
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count);
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", ((windowStart + 1) * RATE_LIMIT_WINDOW * 1000).toString());

    next();
  } catch (error) {
    // If Redis fails, allow request (fail open)
    if (error instanceof Error) {
      logger.warn({ error: error.message, ip: req.ip }, "Rate limit error, allowing request");
    } else {
      logger.warn({ error: String(error), ip: req.ip }, "Rate limit error, allowing request");
    }
    next();
  }
};

/**
 * Per-user rate limiting (stricter for authenticated users)
 * Uses sliding window approach
 */
export const userRateLimit: RequestHandler = async (req, res, next) => {
  // Skip rate limiting if disabled
  if (DISABLE_RATE_LIMIT) {
    return next();
  }

  try {
    if (!req.currentUser) {
      return next();
    }

    const userId = req.currentUser.id;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW);
    const key = `rate_limit:user:${userId}:${windowStart}`;
    const redis = getRedis();

    // Use INCR which returns the new value
    const count = await redis.incr(key);
    
    // Set expiration only on first request in this window
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW + 10);
    }

    // Check limit AFTER incrementing
    if (count > USER_RATE_LIMIT) {
      logger.warn({ userId, count, windowStart }, "User rate limit exceeded");
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Maximum ${USER_RATE_LIMIT} requests per minute.`,
        retryAfter: RATE_LIMIT_WINDOW,
      });
    }

    const remaining = Math.max(0, USER_RATE_LIMIT - count);
    res.setHeader("X-RateLimit-Limit", USER_RATE_LIMIT.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());

    next();
  } catch (error) {
    logger.error({ error }, "User rate limit error, allowing request");
    next();
  }
};

