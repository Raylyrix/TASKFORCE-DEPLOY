import type { Job } from "bullmq";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { googleAuthService } from "../services/googleAuth";
import { gmailDeliveryService } from "../services/gmailDelivery";
import { QueueName, type ScheduledEmailJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { google } from "googleapis";

export const scheduledEmailQueue = createQueue<ScheduledEmailJob>(QueueName.ScheduledEmail);

export const registerScheduledEmailWorker = () =>
  registerWorker<ScheduledEmailJob>(QueueName.ScheduledEmail, async (job: Job<ScheduledEmailJob>) => {
    const { scheduledEmailId, userId } = job.data;

    logger.info({ scheduledEmailId, userId }, "Processing scheduled email job");

    try {
      const scheduledEmail = await prisma.scheduledEmail.findUnique({
        where: { id: scheduledEmailId },
      });

      if (!scheduledEmail) {
        logger.warn({ scheduledEmailId }, "Scheduled email not found");
        return;
      }

      if (scheduledEmail.status !== "PENDING") {
        logger.info({ scheduledEmailId, status: scheduledEmail.status }, "Scheduled email already processed");
        return;
      }

      // Check if it's time to send
      const now = new Date();
      const scheduledAt = new Date(scheduledEmail.scheduledAt);

      if (scheduledAt > now) {
        // Reschedule for later
        const delay = scheduledAt.getTime() - now.getTime();
        logger.info({ scheduledEmailId, delay }, "Scheduled email not ready, will reschedule");
        throw new Error(`Scheduled email not ready yet. Rescheduling in ${delay}ms`);
      }

      // Check if we should send as reply
      const sendAsReply = scheduledEmail.sendAsReply ?? false;
      let threadId: string | null = scheduledEmail.threadId || scheduledEmail.replyToThreadId || null;
      let replyHeaders: Record<string, string> = {};

      if (sendAsReply) {
        // Get thread ID from replyToMessageId or use replyToThreadId
        if (scheduledEmail.replyToThreadId) {
          threadId = scheduledEmail.replyToThreadId;
        } else if (scheduledEmail.replyToMessageId) {
          try {
            const client = await googleAuthService.getAuthorizedClientForUser(userId);
            const gmail = google.gmail({ version: "v1", auth: client });
            const message = await gmail.users.messages.get({
              userId: "me",
              id: scheduledEmail.replyToMessageId,
              format: "metadata",
              metadataHeaders: ["Message-ID", "In-Reply-To", "References"],
            });
            threadId = message.data.threadId || null;
            
            // Set reply headers
            if (threadId && scheduledEmail.replyToMessageId) {
              replyHeaders = {
                "In-Reply-To": scheduledEmail.replyToMessageId,
                "References": scheduledEmail.replyToMessageId,
              };
            }
          } catch (error) {
            logger.error({ error, replyToMessageId: scheduledEmail.replyToMessageId }, "Failed to get thread ID for reply");
          }
        }
      }

      // Prepare subject - add "Re: " prefix for replies if not already present
      let emailSubject = scheduledEmail.subject;
      if (sendAsReply && !emailSubject.startsWith("Re:") && !emailSubject.startsWith("RE:")) {
        emailSubject = `Re: ${emailSubject}`;
      }

      // Use gmailDeliveryService for consistent email sending
      const result = await gmailDeliveryService.sendEmailViaGmail({
        userId,
        to: scheduledEmail.to,
        subject: emailSubject,
        bodyHtml: scheduledEmail.html || scheduledEmail.body.replace(/\n/g, "<br>"),
        cc: scheduledEmail.cc ? [scheduledEmail.cc] : undefined,
        bcc: scheduledEmail.bcc ? [scheduledEmail.bcc] : undefined,
        threadId: threadId,
        headers: Object.keys(replyHeaders).length > 0 ? replyHeaders : undefined,
      });

      // Update status
      try {
        await prisma.scheduledEmail.update({
          where: { id: scheduledEmailId },
          data: {
            status: "SENT",
            sentAt: new Date(),
          },
        });
      } catch (updateError) {
        logger.error({ error: updateError, scheduledEmailId }, "Failed to update scheduled email status to SENT");
        // Continue even if update fails - the email was sent successfully
      }

      logger.info(
        { scheduledEmailId, messageId: result.id },
        "Scheduled email sent successfully",
      );
    } catch (error) {
      logger.error({ error, scheduledEmailId }, "Scheduled email job failed");

      // Mark as failed if it's a permanent error
      if (error instanceof Error && !error.message.includes("not ready yet")) {
        try {
          await prisma.scheduledEmail.update({
            where: { id: scheduledEmailId },
            data: {
              status: "FAILED",
              error: error.message,
            },
          });
        } catch (updateError) {
          logger.error({ error: updateError, scheduledEmailId }, "Failed to update scheduled email status");
        }
      }

      throw error;
    }
  });

/**
 * Check for scheduled emails that are ready to send and queue them
 */
export const processScheduledEmails = async () => {
  // Skip if database is not configured
  if (!process.env.DATABASE_URL) {
    logger.debug("DATABASE_URL not set, skipping scheduled email processing");
    return 0;
  }

  try {
    const now = new Date();

    const readyEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: "PENDING",
        scheduledAt: {
          lte: now,
        },
      },
      take: 100, // Process in batches
    });

    logger.info({ count: readyEmails.length }, "Found scheduled emails ready to send");

    for (const email of readyEmails) {
      try {
        await scheduledEmailQueue.add(
          `scheduled-email-${email.id}`,
          {
            scheduledEmailId: email.id,
            userId: email.userId,
          },
          {
            jobId: `scheduled-email-${email.id}`,
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
          },
        );
      } catch (error) {
        logger.error({ error, scheduledEmailId: email.id }, "Failed to queue scheduled email");
      }
    }

    return readyEmails.length;
  } catch (error) {
    logger.error({ error }, "Error processing scheduled emails - database may not be available");
    return 0;
  }
};

