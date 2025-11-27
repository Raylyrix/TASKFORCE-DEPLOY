import IORedis from "ioredis";

import { AppConfig } from "../config/env";
import { logger } from "./logger";

let redisInstance: IORedis | null = null;
let redisBullMQInstance: IORedis | null = null;

/**
 * Get Redis connection for general use (caching, rate limiting, etc.)
 * Returns null if Redis is not configured (instead of throwing)
 */
export const getRedis = (): IORedis | null => {
  if (!AppConfig.redisUrl) {
    return null; // Return null instead of throwing
  }
  
  if (!redisInstance) {
    redisInstance = new IORedis(AppConfig.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true, // Don't connect immediately
      // Connection pool settings for 100 concurrent users
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Enable keep-alive
      keepAlive: 30000,
    });

    redisInstance.on("error", (error) => {
      logger.error({ error }, "Redis connection error");
    });

    redisInstance.on("connect", () => {
      logger.info("Redis connected");
    });
    
    // Attempt to connect, but don't block if it fails
    redisInstance.connect().catch((error) => {
      logger.warn({ error }, "Failed to connect to Redis, will retry on first use");
    });
  }

  return redisInstance;
};

/**
 * Get Redis connection for BullMQ
 * BullMQ requires maxRetriesPerRequest to be null for blocking operations
 * Returns null if Redis is not configured (instead of throwing)
 */
export const getRedisForBullMQ = (): IORedis | null => {
  if (!AppConfig.redisUrl) {
    return null; // Return null instead of throwing
  }
  
  if (!redisBullMQInstance) {
    redisBullMQInstance = new IORedis(AppConfig.redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      enableReadyCheck: true,
      lazyConnect: true, // Don't connect immediately
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      keepAlive: 30000,
    });

    redisBullMQInstance.on("error", (error) => {
      logger.error({ error }, "Redis BullMQ connection error");
    });

    redisBullMQInstance.on("connect", () => {
      logger.info("Redis BullMQ connected");
    });
    
    // Attempt to connect, but don't block if it fails
    redisBullMQInstance.connect().catch((error) => {
      logger.warn({ error }, "Failed to connect to Redis for BullMQ, will retry on first use");
    });
  }

  return redisBullMQInstance;
};
