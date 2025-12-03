import type { Job } from "bullmq";

import { QueueName, type FollowUpDispatchJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { campaignEngine } from "../services/campaignEngine";

export const followUpQueue = createQueue<FollowUpDispatchJob>(QueueName.FollowUpDispatch);

export const registerFollowUpWorker = () =>
  registerWorker<FollowUpDispatchJob>(
    QueueName.FollowUpDispatch, 
    async (job: Job<FollowUpDispatchJob>) => {
      await campaignEngine.processFollowUpDispatch(job.data);
    },
    { concurrency: 5 } // Allow 5 concurrent follow-up sends
  );


