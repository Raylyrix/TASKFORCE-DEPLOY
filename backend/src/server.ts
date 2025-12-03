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

// Track running tasks to prevent overlapping executions (prevent server overload)
let isRunningPeriodicSync = false;
let isRunningScheduledEmails = false;
let isRunningSnoozedEmails = false;

// Schedule periodic calendar syncs every 15 minutes
setInterval(async () => {
  if (isRunningPeriodicSync) {
    logger.warn("Periodic sync already running, skipping this cycle");
    return;
  }
  
  isRunningPeriodicSync = true;
  try {
    await schedulePeriodicSyncs();
  } catch (error) {
    logger.error({ error }, "Error scheduling periodic syncs");
  } finally {
    isRunningPeriodicSync = false;
  }
}, 15 * 60 * 1000); // 15 minutes

// Run initial sync check on startup
schedulePeriodicSyncs().catch((error) => {
  logger.error({ error }, "Error running initial sync check");
});

// Process scheduled emails every minute
setInterval(async () => {
  if (isRunningScheduledEmails) {
    logger.warn("Scheduled emails processing already running, skipping this cycle");
    return;
  }
  
  isRunningScheduledEmails = true;
  try {
    await processScheduledEmails();
  } catch (error) {
    logger.error({ error }, "Error processing scheduled emails");
  } finally {
    isRunningScheduledEmails = false;
  }
}, 60 * 1000); // 1 minute

// Run initial scheduled emails check on startup
processScheduledEmails().catch((error) => {
  logger.error({ error }, "Error running initial scheduled emails check");
});

// Process snoozed emails every minute
setInterval(async () => {
  if (isRunningSnoozedEmails) {
    logger.warn("Snoozed emails processing already running, skipping this cycle");
    return;
  }
  
  isRunningSnoozedEmails = true;
  try {
    await processSnoozedEmails();
  } catch (error) {
    logger.error({ error }, "Error processing snoozed emails");
  } finally {
    isRunningSnoozedEmails = false;
  }
}, 60 * 1000); // 1 minute

// Run initial snoozed emails check on startup
processSnoozedEmails().catch((error) => {
  logger.error({ error }, "Error running initial snoozed emails check");
});

// Memory monitoring - log every 5 minutes to track for leaks
setInterval(() => {
  const usage = process.memoryUsage();
  const memoryMB = {
    rss: Math.round(usage.rss / 1024 / 1024), // Resident Set Size
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // Heap actually used
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Total heap allocated
    external: Math.round(usage.external / 1024 / 1024), // External memory (buffers, etc)
  };
  
  logger.info({ memory: memoryMB }, "Memory usage check");
  
  // Warn if memory usage is high (> 400MB heap used)
  if (memoryMB.heapUsed > 400) {
    logger.warn(
      { memory: memoryMB },
      "High memory usage detected - potential memory leak or high load",
    );
  }
}, 5 * 60 * 1000); // Every 5 minutes

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
