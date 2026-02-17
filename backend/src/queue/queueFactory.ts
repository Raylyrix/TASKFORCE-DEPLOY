import { Queue, Worker, type ConnectionOptions, type Job } from "bullmq";

import { AppConfig } from "../config/env";
import { logger } from "../lib/logger";

/**
 * IMPORTANT (build fix):
 * - Do NOT pass an instantiated ioredis client to BullMQ here.
 *   BullMQ vendors its own ioredis types; passing our app's ioredis instance
 *   can cause TypeScript type mismatches in CI/Docker builds.
 * - Instead, pass plain ConnectionOptions derived from REDIS_URL.
 */
const buildBullMqConnection = (): ConnectionOptions => {
  const url = new URL(AppConfig.redisUrl);

  const port = url.port ? Number(url.port) : 6379;
  const pathname = (url.pathname || "/").trim();
  const dbRaw = pathname !== "/" ? Number(pathname.replace(/^\//, "")) : NaN;
  const db = Number.isFinite(dbRaw) ? dbRaw : undefined;

  const username = url.username ? decodeURIComponent(url.username) : undefined;
  const password = url.password ? decodeURIComponent(url.password) : undefined;

  return {
    host: url.hostname,
    port: Number.isFinite(port) ? port : 6379,
    db,
    username,
    password,
    // BullMQ requires this to be null for blocking operations
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 50, 2000),
    keepAlive: 30_000,
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
  };
};

const bullMqConnection = buildBullMqConnection();

export const createQueue = <TPayload>(name: string) =>
  new Queue<TPayload, void, string>(name, {
    connection: bullMqConnection,
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
  
  const worker = new Worker<TPayload, void, string>(name, processor, {
    connection: bullMqConnection,
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

