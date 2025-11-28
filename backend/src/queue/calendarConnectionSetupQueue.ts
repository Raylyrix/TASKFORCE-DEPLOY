import type { Job } from "bullmq";

import { logger } from "../lib/logger";
import { upsertGoogleCalendarConnection } from "../services/googleAuth";
import { QueueName, type CalendarConnectionSetupJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";

export const calendarConnectionSetupQueue = createQueue<CalendarConnectionSetupJob>(
  QueueName.CalendarConnectionSetup
);

export const registerCalendarConnectionSetupWorker = () =>
  registerWorker<CalendarConnectionSetupJob>(
    QueueName.CalendarConnectionSetup,
    async (job: Job<CalendarConnectionSetupJob>) => {
      const { userId, profile, accessToken, refreshToken, scope, tokenType, expiryDate } = job.data;

      logger.info({ userId, email: profile.email }, "Processing calendar connection setup job");

      try {
        await upsertGoogleCalendarConnection({
          userId,
          profile,
          accessToken,
          refreshToken,
          scope,
          tokenType,
          expiryDate: new Date(expiryDate),
        });

        logger.info({ userId, email: profile.email }, "Calendar connection setup completed successfully");
      } catch (error) {
        logger.error(
          { error, userId, email: profile.email },
          "Calendar connection setup job failed"
        );
        // Don't throw - we'll retry automatically (up to 3 attempts)
        throw error;
      }
    }
  );

