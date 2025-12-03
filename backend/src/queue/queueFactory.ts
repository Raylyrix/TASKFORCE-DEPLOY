import { Queue, Worker, type Job } from "bullmq";

import { AppConfig } from "../config/env";
import { getRedisForBullMQ } from "../lib/redis";
import { logger } from "../lib/logger";

export const createQueue = <TPayload>(name: string) =>
  new Queue<TPayload>(name, {
    connection: getRedisForBullMQ(),
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });

export const registerWorker = <TPayload>(
  name: string,
  processor: (job: Job<TPayload>) => Promise<void>,
  options?: { concurrency?: number },
) => {
  // Default to 3 concurrent jobs to prevent server overload
  // Campaign/follow-up can have slightly more since they're throttled
  const concurrency = options?.concurrency || 3;
  
  const worker = new Worker<TPayload>(name, processor, {
    connection: getRedisForBullMQ(),
    concurrency: AppConfig.nodeEnv === "production" ? concurrency : 2,
    limiter: {
      max: concurrency * 10, // Max jobs per duration
      duration: 1000, // Per second
    },
  });

  worker.on("completed", (job) => {
    logger.debug({ queue: name, jobId: job.id }, "Queue job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ queue: name, jobId: job?.id, error }, "Queue job failed");
  });

  return worker;
};

