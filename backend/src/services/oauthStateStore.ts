import { randomUUID } from "node:crypto";

import { getRedis } from "../lib/redis";
import { logger } from "../lib/logger";

const STATE_TTL_SECONDS = 15 * 60; // 15 minutes (increased from 5 minutes)
const STATE_TTL_MS = STATE_TTL_SECONDS * 1000;

type OAuthStatePayload = {
  redirectUri?: string;
};

type OAuthStateEntry = OAuthStatePayload & {
  createdAt: number;
  expiresAt: number;
};

export const oauthStateStore = {
  async create(payload: OAuthStatePayload = {}): Promise<{ state: string; expiresAt: number }> {
    const state = randomUUID();
    const createdAt = Date.now();
    const expiresAt = createdAt + STATE_TTL_MS;
    
    const entry: OAuthStateEntry = {
      ...payload,
      createdAt,
      expiresAt,
    };

    try {
      const redis = getRedis();
      if (!redis) {
        throw new Error("Redis not available");
      }
      const key = `oauth_state:${state}`;
      // Store in Redis with expiration
      await redis.setex(key, STATE_TTL_SECONDS, JSON.stringify(entry));
      logger.debug({ state, expiresAt }, "OAuth state created");
      return { state, expiresAt };
    } catch (error) {
      logger.error({ error, state }, "Failed to store OAuth state in Redis");
      // Fallback: throw error instead of silently failing
      throw new Error("Failed to create OAuth state. Please try again.");
    }
  },
  
  async consume(state: string): Promise<OAuthStateEntry | null> {
    try {
      const redis = getRedis();
      if (!redis) {
        logger.error({ state }, "Redis not available for OAuth state consumption");
        return null;
      }
      const key = `oauth_state:${state}`;
      const stored = await redis.get(key);
      
      if (!stored) {
        logger.warn({ state }, "OAuth state not found or expired");
        return null;
      }

      // Delete the state after consuming (one-time use)
      await redis.del(key);
      
      const entry = JSON.parse(stored) as OAuthStateEntry;
      logger.debug({ state }, "OAuth state consumed");
      return entry;
    } catch (error) {
      logger.error({ error, state }, "Failed to consume OAuth state from Redis");
      return null;
    }
  },
  
  ttlMs: STATE_TTL_MS,
};


