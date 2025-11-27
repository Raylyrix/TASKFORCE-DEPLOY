import { Queue, Worker, type Job } from "bullmq";

import { AppConfig } from "../config/env";
import { getRedisForBullMQ } from "../lib/redis";
import { logger } from "../lib/logger";

// Create a mock queue that does nothing when Redis is not available
const createMockQueue = <TPayload>(name: string): Queue<TPayload> => {
  return {
    add: async () => {
      logger.warn({ queue: name }, "Queue operation skipped - Redis not available");
      return {} as any;
    },
    getJobs: async () => [],
    clean: async () => ({ cleaned: 0 }),
    close: async () => {},
    getWaitingCount: async () => 0,
    getActiveCount: async () => 0,
    getCompletedCount: async () => 0,
    getFailedCount: async () => 0,
    getDelayedCount: async () => 0,
  } as unknown as Queue<TPayload>;
};

export const createQueue = <TPayload>(name: string): Queue<TPayload> => {
  const redis = getRedisForBullMQ();
  if (!redis) {
    logger.warn({ queue: name }, "Redis not available, using mock queue (operations will be no-ops)");
    return createMockQueue<TPayload>(name);
  }
  return new Queue<TPayload>(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      removeOnComplete: true,
      removeOnFail: false,
    },
  });
};

export const registerWorker = <TPayload>(
  name: string,
  processor: (job: Job<TPayload>) => Promise<void>,
): Worker<TPayload> | null => {
  const redis = getRedisForBullMQ();
  if (!redis) {
    logger.warn({ queue: name }, "Redis not available, worker will not be registered");
    return null; // Workers can't work without Redis, so return null
  }
  
  const worker = new Worker<TPayload>(name, processor, {
    connection: redis,
    concurrency: AppConfig.nodeEnv === "production" ? 10 : 2,
  });

  worker.on("completed", (job) => {
    logger.debug({ queue: name, jobId: job.id }, "Queue job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error({ queue: name, jobId: job?.id, error }, "Queue job failed");
  });

  return worker;
};

