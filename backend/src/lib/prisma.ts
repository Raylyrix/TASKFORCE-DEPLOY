import { PrismaClient } from "@prisma/client";

import { AppConfig } from "../config/env";
import { logger } from "./logger";

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

/**
 * Configure database URL with connection pool parameters
 * Railway Pro plan allows ~100-200 connections total
 * With 2 instances, each should use ~40-50 connections max
 */
const configureDatabaseUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    
    // Check if connection pool params already exist
    if (urlObj.searchParams.has("connection_limit")) {
      return url; // Already configured
    }

    // Add connection pool parameters
    // Railway Pro: ~100-200 max connections
    // With 2 instances: 40 connections per instance = 80 total (safe margin)
    urlObj.searchParams.set("connection_limit", "40");
    urlObj.searchParams.set("pool_timeout", "20"); // 20 seconds to get connection from pool
    urlObj.searchParams.set("connect_timeout", "10"); // 10 seconds to establish connection
    urlObj.searchParams.set("statement_cache_size", "0"); // Disable statement cache to reduce memory
    
    const configuredUrl = urlObj.toString();
    logger.info(
      {
        connection_limit: 40,
        pool_timeout: 20,
        connect_timeout: 10,
      },
      "Database connection pool configured"
    );
    
    return configuredUrl;
  } catch (error) {
    logger.error({ error }, "Failed to configure database URL, using original");
    return url;
  }
};

const createClient = () => {
  const databaseUrl = configureDatabaseUrl(AppConfig.databaseUrl);
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log:
      AppConfig.nodeEnv === "development"
        ? ["query", "error", "warn"]
        : AppConfig.nodeEnv === "production"
          ? ["error"]
          : ["error", "warn"],
    // Enable query logging in production only for slow queries
    // Use Prisma middleware for query performance monitoring
  });
};

export const prisma = prismaGlobal.prisma ?? createClient();

if (AppConfig.nodeEnv !== "production") {
  prismaGlobal.prisma = prisma;
}
