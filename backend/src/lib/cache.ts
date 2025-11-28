import IORedis from "ioredis";

import { AppConfig } from "../config/env";
import { logger } from "./logger";
import { getRedis } from "./redis";

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  USER: 300, // 5 minutes
  CALENDAR_EVENTS: 300, // 5 minutes
  EMAIL_LABELS: 600, // 10 minutes
  MEETING_TYPES: 3600, // 1 hour
  CAMPAIGNS: 60, // 1 minute
  CALENDAR_CONNECTION: 300, // 5 minutes
} as const;

class CacheService {
  private redis: IORedis;

  constructor() {
    this.redis = getRedis();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      // If Redis is not connected, fail silently and return null (cache miss)
      if (error instanceof Error) {
        logger.warn({ error: error.message, key }, "Cache get error, returning null");
      }
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      // If Redis is not connected, fail silently (cache write failure is non-critical)
      if (error instanceof Error) {
        logger.warn({ error: error.message, key }, "Cache set error, continuing without cache");
      }
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      // If Redis is not connected, fail silently
      if (error instanceof Error) {
        logger.warn({ error: error.message, key }, "Cache delete error, continuing");
      }
    }
  }

  /**
   * Delete multiple keys matching pattern
   */
  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      // If Redis is not connected, fail silently
      if (error instanceof Error) {
        logger.warn({ error: error.message, pattern }, "Cache delete pattern error, continuing");
      }
    }
  }

  /**
   * Invalidate cache for a user
   */
  async invalidateUser(userId: string): Promise<void> {
    await Promise.all([
      this.deletePattern(`user:${userId}:*`),
      this.deletePattern(`calendar:${userId}:*`),
      this.deletePattern(`campaign:${userId}:*`),
      this.deletePattern(`meeting:${userId}:*`),
    ]);
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 300,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }
}

export const cache = new CacheService();

// Cache key generators
export const cacheKeys = {
  user: (userId: string) => `user:${userId}`,
  calendarEvents: (userId: string, start: string, end: string) =>
    `calendar:events:${userId}:${start}:${end}`,
  emailLabels: (userId: string) => `email:labels:${userId}`,
  meetingTypes: (userId: string) => `meeting:types:${userId}`,
  campaigns: (userId: string) => `campaigns:${userId}`,
  calendarConnection: (userId: string) => `calendar:connection:${userId}`,
};

