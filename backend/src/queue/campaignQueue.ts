import type { Job } from "bullmq";

import { QueueName, type CampaignDispatchJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { campaignEngine } from "../services/campaignEngine";

export const campaignQueue = createQueue<CampaignDispatchJob>(QueueName.CampaignDispatch);

export const registerCampaignWorker = () =>
  registerWorker<CampaignDispatchJob>(
    QueueName.CampaignDispatch, 
    async (job: Job<CampaignDispatchJob>) => {
      await campaignEngine.processCampaignDispatch(job.data);
    },
    { concurrency: 5 } // Allow 5 concurrent email sends
  );


