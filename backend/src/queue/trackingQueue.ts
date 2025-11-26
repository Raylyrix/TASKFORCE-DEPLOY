import type { Job } from "bullmq";

import { QueueName, type TrackingEventJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { campaignEngine } from "../services/campaignEngine";

export const trackingQueue = createQueue<TrackingEventJob>(QueueName.Tracking);

export const registerTrackingWorker = () =>
  registerWorker<TrackingEventJob>(QueueName.Tracking, async (job: Job<TrackingEventJob>) => {
    await campaignEngine.processTrackingEvent(job.data);
  });


