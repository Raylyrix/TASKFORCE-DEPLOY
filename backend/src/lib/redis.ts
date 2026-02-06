import IORedis from "ioredis";

import { AppConfig } from "../config/env";
import { logger } from "./logger";

let redisInstance: IORedis | null = null;
let redisBullMQInstance: IORedis | null = null;
let lastRedisErrorLogAt = 0;
let lastRedisReconnectLogAt = 0;

const shouldLog = (lastAt: number, intervalMs: number) => {
  const now = Date.now();
  if (now - lastAt >= intervalMs) return true;
  return false;
};

const jitter = (baseMs: number) => {
  const delta = Math.floor(baseMs * 0.2);
  return baseMs - delta + Math.floor(Math.random() * (delta * 2 + 1));
};

const retryStrategy = (times: number) => {
  const capped = Math.min(times, 20);
  const delay = Math.min(5000, Math.pow(2, capped) * 50);
  return jitter(delay);
};

/**
 * Get Redis connection for general use (caching, rate limiting, etc.)
 */
export const getRedis = () => {
  if (!redisInstance) {
    redisInstance = new IORedis(AppConfig.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      // Connection pool settings for 100 concurrent users
      retryStrategy,
      // Enable keep-alive
      keepAlive: 30000,
    });

    redisInstance.on("error", (error) => {
      if (shouldLog(lastRedisErrorLogAt, 30000)) {
        lastRedisErrorLogAt = Date.now();
        logger.error({ error }, "Redis connection error");
      }
    });

    redisInstance.on("connect", () => {
      logger.info("Redis connected");
    });

    redisInstance.on("reconnecting", (time) => {
      if (shouldLog(lastRedisReconnectLogAt, 15000)) {
        lastRedisReconnectLogAt = Date.now();
        logger.warn({ delayMs: time }, "Redis reconnecting");
      }
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
      retryStrategy,
      keepAlive: 30000,
    });

    redisBullMQInstance.on("error", (error) => {
      if (shouldLog(lastRedisErrorLogAt, 30000)) {
        lastRedisErrorLogAt = Date.now();
        logger.error({ error }, "Redis BullMQ connection error");
      }
    });

    redisBullMQInstance.on("connect", () => {
      logger.info("Redis BullMQ connected");
    });

    redisBullMQInstance.on("reconnecting", (time) => {
      if (shouldLog(lastRedisReconnectLogAt, 15000)) {
        lastRedisReconnectLogAt = Date.now();
        logger.warn({ delayMs: time }, "Redis BullMQ reconnecting");
      }
    });
  }

  return redisBullMQInstance;
};
