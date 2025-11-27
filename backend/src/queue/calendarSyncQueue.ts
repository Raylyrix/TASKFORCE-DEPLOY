import type { Job } from "bullmq";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { googleCalendarService } from "../services/googleCalendar";
import { QueueName, type CalendarSyncJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";

export const calendarSyncQueue = createQueue<CalendarSyncJob>(QueueName.CalendarSync);

export const registerCalendarSyncWorker = () =>
  registerWorker<CalendarSyncJob>(QueueName.CalendarSync, async (job: Job<CalendarSyncJob>) => {
    const { userId, connectionId, start, end, calendars } = job.data;

    logger.info({ userId, connectionId, start, end }, "Processing calendar sync job");

    try {
      const result = await googleCalendarService.syncBusyBlocks({
        userId,
        calendarConnectionId: connectionId,
        start,
        end,
        calendars,
      });

      logger.info(
        { userId, connectionId, cachedBlocks: result.cachedBlocks },
        "Calendar sync job completed successfully",
      );
    } catch (error) {
      logger.error({ error, userId, connectionId }, "Calendar sync job failed");
      throw error;
    }
  });

/**
 * Queue calendar sync jobs for all connections that need syncing based on their cadence
 */
export const schedulePeriodicSyncs = async () => {
  // Skip if database is not configured
  if (!process.env.DATABASE_URL) {
    logger.debug("DATABASE_URL not set, skipping calendar sync scheduling");
    return 0;
  }

  try {
    const now = new Date();
    const connections = await prisma.calendarConnection.findMany({
      where: {
        // Only sync active connections with valid OAuth credentials
        user: {
          oauthCredential: {
            isNot: null,
          },
        },
      },
      include: {
        user: true,
      },
    });

  const jobsToQueue: Array<{
    connectionId: string;
    userId: string;
    start: string;
    end: string;
    calendars?: string[];
  }> = [];

  for (const connection of connections) {
    const metadata = (connection.metadata as Record<string, unknown> | null) ?? null;
    const syncPreferences =
      typeof metadata?.syncPreferences === "object" && metadata.syncPreferences !== null
        ? (metadata.syncPreferences as Record<string, unknown>)
        : {};
    const cadenceMinutes =
      typeof syncPreferences.cadenceMinutes === "number" ? syncPreferences.cadenceMinutes : null;

    // Skip if no cadence is set (manual only)
    if (!cadenceMinutes || cadenceMinutes <= 0) {
      continue;
    }

    const lastSyncedAtStr =
      typeof metadata?.lastSyncedAt === "string" ? (metadata.lastSyncedAt as string) : null;
    const lastSyncedAt = lastSyncedAtStr ? new Date(lastSyncedAtStr) : null;

    // Check if sync is needed
    const needsSync =
      !lastSyncedAt ||
      now.getTime() - lastSyncedAt.getTime() >= cadenceMinutes * 60 * 1000;

    if (needsSync) {
      const start = now.toISOString();
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ahead
      const calendars = Array.isArray(metadata?.calendars)
        ? (metadata.calendars as unknown[]).filter((c): c is string => typeof c === "string")
        : undefined;

      jobsToQueue.push({
        connectionId: connection.id,
        userId: connection.userId,
        start,
        end,
        calendars,
      });
    }
  }

    // Queue all sync jobs
    for (const jobData of jobsToQueue) {
      await calendarSyncQueue.add("sync-calendar", jobData, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      });
    }

    logger.info({ queuedJobs: jobsToQueue.length }, "Scheduled periodic calendar syncs");

    return jobsToQueue.length;
  } catch (error) {
    logger.error({ error }, "Error scheduling periodic syncs - database may not be available");
    return 0;
  }
};

