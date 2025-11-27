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

// Run migrations before starting the server
runMigrations().then(() => {
  // Initialize query logger for slow query monitoring
  initializeQueryLogger();

  // Initialize background job queues
  initializeQueues();

  // Clear old rate limit keys on startup (optional, helps with stale keys)
  if (process.env.CLEAR_RATE_LIMITS_ON_STARTUP === "true") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getRedis } = require("./lib/redis");
    const redis = getRedis();
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

  const app = createApp();
  const server = app.listen(AppConfig.port, () => {
    logger.info(
      { port: AppConfig.port, env: AppConfig.nodeEnv },
      "Backend service listening",
    );
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down server");
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}).catch((error) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});

