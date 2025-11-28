import type { RequestHandler } from "express";

import { logger } from "../lib/logger";
import { getRedis } from "../lib/redis";

const RATE_LIMIT_WINDOW = 60; // 1 minute in seconds
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

/**
 * Redis-based rate limiting middleware
 * Limits requests per IP address
 */
export const rateLimit: RequestHandler = async (req, res, next) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `rate_limit:${ip}`;
    const redis = getRedis();

    // Get current count
    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      logger.warn({ ip, count }, "Rate limit exceeded");
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute.`,
        retryAfter: RATE_LIMIT_WINDOW,
      });
    }

    // Increment counter
    if (count === 0) {
      // First request in window, set with expiration
      await redis.setex(key, RATE_LIMIT_WINDOW, "1");
    } else {
      // Increment existing counter
      await redis.incr(key);
    }

    // Add rate limit headers
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - count - 1);
    res.setHeader("X-RateLimit-Limit", RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());
    res.setHeader("X-RateLimit-Reset", (Date.now() + RATE_LIMIT_WINDOW * 1000).toString());

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
 */
export const userRateLimit: RequestHandler = async (req, res, next) => {
  try {
    if (!req.currentUser) {
      return next();
    }

    const userId = req.currentUser.id;
    const key = `rate_limit:user:${userId}`;
    const redis = getRedis();
    const USER_RATE_LIMIT = 200; // Higher limit for authenticated users

    const current = await redis.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= USER_RATE_LIMIT) {
      logger.warn({ userId, count }, "User rate limit exceeded");
      return res.status(429).json({
        error: "Too many requests",
        message: `Rate limit exceeded. Maximum ${USER_RATE_LIMIT} requests per minute.`,
        retryAfter: RATE_LIMIT_WINDOW,
      });
    }

    if (count === 0) {
      await redis.setex(key, RATE_LIMIT_WINDOW, "1");
    } else {
      await redis.incr(key);
    }

    const remaining = Math.max(0, USER_RATE_LIMIT - count - 1);
    res.setHeader("X-RateLimit-Limit", USER_RATE_LIMIT.toString());
    res.setHeader("X-RateLimit-Remaining", remaining.toString());

    next();
  } catch (error) {
    logger.error({ error }, "User rate limit error, allowing request");
    next();
  }
};

