import type { Job } from "bullmq";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { googleAuthService } from "../services/googleAuth";
import { QueueName, type SnoozeRestoreJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { google } from "googleapis";

export const snoozeQueue = createQueue<SnoozeRestoreJob>(QueueName.SnoozeRestore);

export const registerSnoozeRestoreWorker = () =>
  registerWorker<SnoozeRestoreJob>(QueueName.SnoozeRestore, async (job: Job<SnoozeRestoreJob>) => {
    const { snoozeId, messageId, userId } = job.data;

    logger.info({ snoozeId, messageId, userId }, "Processing snooze restore job");

    try {
      const snooze = await prisma.emailSnooze.findUnique({
        where: { id: snoozeId },
      });

      if (!snooze) {
        logger.warn({ snoozeId }, "Snooze record not found");
        return;
      }

      // Check if it's time to restore
      const now = new Date();
      const snoozeUntil = new Date(snooze.snoozeUntil);

      if (snoozeUntil > now) {
        // Reschedule for later
        const delay = snoozeUntil.getTime() - now.getTime();
        logger.info({ snoozeId, delay }, "Snooze not ready, will reschedule");
        throw new Error(`Snooze not ready yet. Rescheduling in ${delay}ms`);
      }

      // Get Gmail client
      const client = await googleAuthService.getAuthorizedClientForUser(userId);
      const gmail = google.gmail({ version: "v1", auth: client });

      // Restore to INBOX and restore labels
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["INBOX", ...snooze.labelIds],
          removeLabelIds: [],
        },
      });

      // Delete snooze record
      try {
        await prisma.emailSnooze.delete({
          where: { id: snoozeId },
        });
      } catch (deleteError) {
        logger.error({ error: deleteError, snoozeId }, "Failed to delete snooze record after restore");
        // Continue even if delete fails - the email was restored successfully
      }

      logger.info({ snoozeId, messageId }, "Snooze restored successfully");
    } catch (error) {
      logger.error({ error, snoozeId }, "Snooze restore job failed");

      // If it's a temporary error (not ready yet), don't delete the snooze
      if (error instanceof Error && error.message.includes("not ready yet")) {
        throw error;
      }

      // For other errors, we might want to keep the snooze record
      // or handle it differently based on requirements
      throw error;
    }
  });

/**
 * Check for snoozed emails that are ready to restore and queue them
 */
export const processSnoozedEmails = async () => {
  const now = new Date();

  const readySnoozes = await prisma.emailSnooze.findMany({
    where: {
      snoozeUntil: {
        lte: now,
      },
    },
    take: 100, // Process in batches
  });

  logger.info({ count: readySnoozes.length }, "Found snoozed emails ready to restore");

  for (const snooze of readySnoozes) {
    try {
      await snoozeQueue.add(
        `snooze-restore-${snooze.id}`,
        {
          snoozeId: snooze.id,
          messageId: snooze.messageId,
          userId: snooze.userId,
        },
        {
          jobId: `snooze-restore-${snooze.id}`,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          // Delay to the exact snooze time
          delay: Math.max(0, new Date(snooze.snoozeUntil).getTime() - now.getTime()),
        },
      );
    } catch (error) {
      logger.error({ error, snoozeId: snooze.id }, "Failed to queue snooze restore");
    }
  }

  return readySnoozes.length;
};

