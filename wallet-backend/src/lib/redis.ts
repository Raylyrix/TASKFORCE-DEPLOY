import { createClient } from 'redis';
import { logger } from './logger';

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
  
  if (!redisUrl) {
    logger.warn('Redis URL not configured, caching disabled');
    return null;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err });
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Failed to connect to Redis', { error });
    return null;
  }
}

export async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// Cache helper functions
export async function getCache(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  
  try {
    return await client.get(key);
  } catch (error) {
    logger.error('Redis get error', { error, key });
    return null;
  }
}

export async function setCache(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  
  try {
    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, value);
    } else {
      await client.set(key, value);
    }
    return true;
  } catch (error) {
    logger.error('Redis set error', { error, key });
    return false;
  }
}

export async function deleteCache(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;
  
  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete error', { error, key });
    return false;
  }
}

