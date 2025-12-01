/**
 * Data Retention Queue
 * Scheduled job to run data retention cleanup automatically
 */

import type { Job } from "bullmq";
import { createQueue, registerWorker } from "./queueFactory";
import { QueueName, type DataRetentionJob } from "./types";
import { dataRetentionService } from "../services/dataRetentionService";
import { logger } from "../lib/logger";

export const dataRetentionQueue = createQueue<DataRetentionJob>(
  QueueName.DataRetention
);

export const registerDataRetentionWorker = () =>
  registerWorker<DataRetentionJob>(
    QueueName.DataRetention,
    async (job: Job<DataRetentionJob>) => {
      const { config, limitMB } = job.data;

      logger.info({ config, limitMB }, "Running scheduled data retention cleanup");

      try {
        // Check current size
        const sizeCheck = await dataRetentionService.checkDatabaseSize(limitMB || 500);

        // Only run cleanup if approaching limit
        if (sizeCheck.needsCleanup) {
          logger.info(
            { 
              currentSize: sizeCheck.currentSizeMB, 
              limit: sizeCheck.limitMB,
              percentage: sizeCheck.percentageUsed 
            },
            "Database size approaching limit, running cleanup"
          );

          const result = await dataRetentionService.runDataRetentionCleanup(config);

          logger.info(
            {
              deleted: result.totalDeleted,
              sizeBefore: result.sizeBefore,
              sizeAfter: result.sizeAfter,
              saved: result.sizeBefore - result.sizeAfter,
            },
            "Data retention cleanup completed"
          );
        } else {
          logger.info(
            { 
              currentSize: sizeCheck.currentSizeMB, 
              limit: sizeCheck.limitMB,
              percentage: sizeCheck.percentageUsed 
            },
            "Database size within limits, skipping cleanup"
          );
        }
      } catch (error) {
        logger.error({ error }, "Data retention cleanup job failed");
        throw error;
      }
    }
  );

/**
 * Schedule daily data retention cleanup
 */
export async function scheduleDailyCleanup() {
  // Schedule to run daily at 2 AM
  await dataRetentionQueue.add(
    "daily-cleanup",
    {
      config: dataRetentionService.DEFAULT_RETENTION_CONFIG,
      limitMB: 500,
    },
    {
      repeat: {
        pattern: "0 2 * * *", // Daily at 2 AM
      },
    }
  );

  logger.info("Scheduled daily data retention cleanup");
}

