/**
 * Script to clear all rate limit keys from Redis
 * Run this if you're experiencing rate limit issues from stale keys
 * Usage: npx ts-node src/scripts/clearRateLimits.ts
 */

import { getRedis } from "../lib/redis";
import { logger } from "../lib/logger";

async function clearRateLimits() {
  try {
    const redis = getRedis();
    
    // Find all rate limit keys
    const keys = await redis.keys("rate_limit:*");
    
    if (keys.length === 0) {
      logger.info("No rate limit keys found");
      return;
    }
    
    logger.info({ count: keys.length }, "Found rate limit keys, deleting...");
    
    // Delete all rate limit keys
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    logger.info({ deleted: keys.length }, "Rate limit keys cleared successfully");
    
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Failed to clear rate limit keys");
    process.exit(1);
  }
}

clearRateLimits();

