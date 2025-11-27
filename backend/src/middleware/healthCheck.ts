import type { RequestHandler } from "express";

import { prisma } from "../lib/prisma";
import { getRedis } from "../lib/redis";
import { logger } from "../lib/logger";

/**
 * Health check endpoint handler
 * Checks database, Redis, and overall system health
 * Returns 200 even if services are degraded (for Railway health checks)
 */
export const healthCheck: RequestHandler = async (req, res) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      redis: "unknown",
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = "ok";
  } catch (error) {
    health.services.database = "error";
    health.status = "degraded";
    logger.warn({ error }, "Database health check failed");
  }

  try {
    // Check Redis
    const redis = getRedis();
    await redis.ping();
    health.services.redis = "ok";
  } catch (error) {
    health.services.redis = "error";
    health.status = "degraded";
    logger.warn({ error }, "Redis health check failed");
  }

  // Always return 200 for Railway health checks - they just need to know the server is responding
  res.status(200).json(health);
};

/**
 * Readiness check (for Kubernetes/Docker)
 * Returns 200 only if all services are healthy
 */
export const readinessCheck: RequestHandler = async (req, res) => {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    // Check Redis
    const redis = getRedis();
    await redis.ping();

    res.status(200).json({ status: "ready" });
  } catch (error) {
    logger.error({ error }, "Readiness check failed");
    res.status(503).json({ status: "not ready", error: "Service unavailable" });
  }
};

/**
 * Liveness check (for Kubernetes/Docker)
 * Returns 200 if the process is alive
 */
export const livenessCheck: RequestHandler = (req, res) => {
  res.status(200).json({ status: "alive" });
};


