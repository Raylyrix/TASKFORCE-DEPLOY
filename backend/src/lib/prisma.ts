import { PrismaClient } from "@prisma/client";

import { AppConfig } from "../config/env";

const prismaGlobal = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createClient = () => {
  // For production with thousands of users:
  // Configure connection pool in DATABASE_URL:
  // Format: postgresql://user:pass@host:port/db?connection_limit=100&pool_timeout=20&connect_timeout=10
  // 
  // Recommended settings for 1000+ concurrent users:
  // - connection_limit: 100-200 (depends on database server capacity)
  // - pool_timeout: 20 seconds
  // - connect_timeout: 10 seconds
  //
  // For horizontal scaling, each instance should have its own connection pool
  return new PrismaClient({
    datasources: {
      db: {
        url: AppConfig.databaseUrl,
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
