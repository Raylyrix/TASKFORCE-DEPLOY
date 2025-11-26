import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

// Log slow queries (queries taking more than 1 second)
const SLOW_QUERY_THRESHOLD = 1000; // milliseconds

/**
 * Initialize query logger middleware
 * Uses Prisma's $use method if available, otherwise uses event-based logging
 */
export const initializeQueryLogger = () => {
  try {
    // Check if $use is available (Prisma 4.x+)
    if (typeof (prisma as any).$use === "function") {
      (prisma as any).$use(async (params: any, next: (params: any) => Promise<any>) => {
        const before = Date.now();

        const result = await next(params);

        const after = Date.now();
        const duration = after - before;

        // Log slow queries
        if (duration > SLOW_QUERY_THRESHOLD) {
          logger.warn(
            {
              model: params.model,
              action: params.action,
              duration,
              args: params.args,
            },
            "Slow query detected",
          );
        }

        // Log all queries in development
        if (process.env.NODE_ENV === "development") {
          logger.debug(
            {
              model: params.model,
              action: params.action,
              duration,
            },
            "Database query",
          );
        }

        return result;
      });
      logger.info("Query logger middleware initialized");
    } else {
      // Fallback: Use Prisma's built-in logging
      logger.info("Query logger: Using Prisma built-in logging (middleware not available)");
    }
  } catch (error) {
    logger.warn({ error }, "Failed to initialize query logger middleware, using fallback");
  }
};

// Export a no-op for backward compatibility
export const queryLogger = null;

