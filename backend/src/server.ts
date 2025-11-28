import { createApp } from "./app";
import { AppConfig } from "./config/env";
import { logger } from "./lib/logger";
import { initializeQueryLogger } from "./middleware/queryLogger";
import { initializeQueues, getWorkers, closeQueues } from "./queue";
import { schedulePeriodicSyncs } from "./queue/calendarSyncQueue";
import { processScheduledEmails } from "./queue/scheduledEmailQueue";
import { processSnoozedEmails } from "./queue/snoozeQueue";

// Initialize query logger for slow query monitoring
initializeQueryLogger();

// Initialize background job queues
initializeQueues();

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

const shutdown = async (signal: string) => {
  logger.info({ signal }, "Shutting down server gracefully");
  
  // Stop accepting new HTTP requests
  server.close(() => {
    logger.info("HTTP server closed");
  });
  
  // Wait for queue workers to finish current jobs (max 30 seconds)
  try {
    const workers = getWorkers();
    logger.info({ workerCount: workers.length }, "Closing queue workers");
    
    await Promise.all(
      workers.map((worker) => 
        worker.close().catch((error) => {
          logger.warn({ error }, "Error closing worker");
        })
      )
    );
    
    // Close queue connections
    await closeQueues();
    
    logger.info("All queue workers closed");
  } catch (error) {
    logger.error({ error }, "Error during graceful shutdown");
  }
  
  // Give a small buffer for cleanup, then exit
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 2000);
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
