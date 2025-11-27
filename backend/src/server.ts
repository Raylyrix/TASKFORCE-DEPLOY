import { createApp } from "./app";
import { AppConfig } from "./config/env";
import { logger } from "./lib/logger";
import { initializeQueryLogger } from "./middleware/queryLogger";
import { initializeQueues } from "./queue";
import { schedulePeriodicSyncs } from "./queue/calendarSyncQueue";
import { processScheduledEmails } from "./queue/scheduledEmailQueue";
import { processSnoozedEmails } from "./queue/snoozeQueue";

// Run migrations on startup if DATABASE_URL is set
async function runMigrations() {
  if (process.env.DATABASE_URL) {
    try {
      const { execSync } = require("child_process");
      logger.info("Running database migrations...");
      
      // First, try to resolve any failed migrations
      try {
        execSync("npx prisma migrate resolve --rolled-back 20251112153000_meeting_reminders", { 
          stdio: "pipe",
          cwd: process.cwd()
        });
        logger.info("Resolved failed migration");
      } catch (resolveError) {
        // Ignore if migration doesn't exist or already resolved
        logger.debug("Migration resolve attempt (may already be resolved)");
      }
      
      // Now run migrations
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      logger.info("Database migrations completed");
    } catch (error) {
      logger.error({ error }, "Failed to run database migrations");
      // Don't exit - let the server start anyway
    }
  } else {
    logger.warn("DATABASE_URL not set, skipping migrations");
  }
}

// Start the server - prioritize getting it running over all initialization
async function startServer() {
  try {
    console.log("[STARTUP] Starting server initialization...");
    console.log(`[STARTUP] PORT: ${AppConfig.port}`);
    console.log(`[STARTUP] NODE_ENV: ${AppConfig.nodeEnv}`);

    // First, create and start the app - this is critical
    console.log("[STARTUP] Creating Express app...");
    const app = createApp();
    console.log("[STARTUP] Express app created successfully");

    // Start listening immediately - don't wait for migrations or other init
    console.log(`[STARTUP] Starting HTTP server on port ${AppConfig.port}...`);
    const server = app.listen(AppConfig.port, "0.0.0.0", () => {
      console.log(`[STARTUP] ✅ Server is listening on port ${AppConfig.port}`);
      logger.info(
        { port: AppConfig.port, env: AppConfig.nodeEnv },
        "Backend service listening",
      );
    });

    // Handle server errors
    server.on("error", (error: Error) => {
      console.error("[STARTUP] ❌ Server error:", error);
      logger.error({ error }, "Server error");
    });

    const shutdown = (signal: string) => {
      console.log(`[SHUTDOWN] Received ${signal}, shutting down...`);
      logger.info({ signal }, "Shutting down server");
      server.close(() => {
        console.log("[SHUTDOWN] HTTP server closed");
        logger.info("HTTP server closed");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    // Now run migrations and other initialization in the background
    console.log("[STARTUP] Running background initialization...");
    runMigrations()
      .then(() => {
        console.log("[STARTUP] Migrations completed (or skipped)");
        
        // Initialize query logger for slow query monitoring
        try {
          initializeQueryLogger();
          console.log("[STARTUP] Query logger initialized");
        } catch (error) {
          console.warn("[STARTUP] Failed to initialize query logger:", error);
          logger.warn({ error }, "Failed to initialize query logger, continuing");
        }

        // Initialize background job queues (non-blocking)
        try {
          initializeQueues();
          console.log("[STARTUP] Queues initialized");
        } catch (error) {
          console.warn("[STARTUP] Failed to initialize queues:", error);
          logger.warn({ error }, "Failed to initialize queues, continuing");
        }

        // Clear old rate limit keys on startup (optional, helps with stale keys)
        if (process.env.CLEAR_RATE_LIMITS_ON_STARTUP === "true") {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getRedis } = require("./lib/redis");
            const redis = getRedis();
            if (redis) {
              redis.keys("rate_limit:*").then((keys: string[]) => {
                if (keys.length > 0) {
                  logger.info({ count: keys.length }, "Clearing old rate limit keys on startup");
                  redis.del(...keys).catch((error: unknown) => {
                    logger.warn({ error }, "Failed to clear old rate limit keys");
                  });
                }
              }).catch((error: unknown) => {
                logger.warn({ error }, "Failed to check for old rate limit keys");
              });
            } else {
              logger.warn("Redis not available, skipping rate limit clearing");
            }
          } catch (error) {
            logger.warn({ error }, "Failed to initialize Redis for rate limit clearing");
          }
        }

        // Schedule periodic calendar syncs every 15 minutes
        setInterval(async () => {
          try {
            await schedulePeriodicSyncs();
          } catch (error) {
            logger.error({ error }, "Error scheduling periodic syncs");
          }
        }, 15 * 60 * 1000); // 15 minutes

        // Run initial sync check on startup
        schedulePeriodicSyncs().catch((error) => {
          logger.error({ error }, "Error running initial sync check");
        });

        // Process scheduled emails every minute
        setInterval(async () => {
          try {
            await processScheduledEmails();
          } catch (error) {
            logger.error({ error }, "Error processing scheduled emails");
          }
        }, 60 * 1000); // 1 minute

        // Run initial scheduled emails check on startup
        processScheduledEmails().catch((error) => {
          logger.error({ error }, "Error running initial scheduled emails check");
        });

        // Process snoozed emails every minute
        setInterval(async () => {
          try {
            await processSnoozedEmails();
          } catch (error) {
            logger.error({ error }, "Error processing snoozed emails");
          }
        }, 60 * 1000); // 1 minute

        // Run initial snoozed emails check on startup
        processSnoozedEmails().catch((error) => {
          logger.error({ error }, "Error running initial snoozed emails check");
        });

        console.log("[STARTUP] ✅ Background initialization completed");
      })
      .catch((error) => {
        console.error("[STARTUP] Background initialization failed:", error);
        logger.error({ error }, "Background initialization failed");
        // Don't exit - server is already running
      });
  } catch (error) {
    console.error("[STARTUP] ❌ CRITICAL: Failed to start server:", error);
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Start the server
startServer();

