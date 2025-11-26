import IORedis from "ioredis";

import { AppConfig } from "../config/env";
import { logger } from "./logger";

let redisInstance: IORedis | null = null;
let redisBullMQInstance: IORedis | null = null;

/**
 * Get Redis connection for general use (caching, rate limiting, etc.)
 */
export const getRedis = () => {
  if (!redisInstance) {
    redisInstance = new IORedis(AppConfig.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
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
  }

  return redisInstance;
};

/**
 * Get Redis connection for BullMQ
 * BullMQ requires maxRetriesPerRequest to be null for blocking operations
 */
export const getRedisForBullMQ = () => {
  if (!redisBullMQInstance) {
    redisBullMQInstance = new IORedis(AppConfig.redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ for blocking operations
      enableReadyCheck: true,
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
  }

  return redisBullMQInstance;
};
