import type { Worker } from "bullmq";

import { registerCampaignWorker } from "./campaignQueue";
import { registerFollowUpWorker } from "./followUpQueue";
import { registerTrackingWorker } from "./trackingQueue";
import { registerReminderWorker } from "./reminderQueue";
import { registerCalendarSyncWorker } from "./calendarSyncQueue";
import { registerScheduledEmailWorker } from "./scheduledEmailQueue";
import { registerSnoozeRestoreWorker } from "./snoozeQueue";
import { registerCalendarConnectionSetupWorker } from "./calendarConnectionSetupQueue";
import { campaignQueue } from "./campaignQueue";
import { followUpQueue } from "./followUpQueue";
import { trackingQueue } from "./trackingQueue";
import { reminderQueue } from "./reminderQueue";
import { calendarSyncQueue } from "./calendarSyncQueue";
import { scheduledEmailQueue } from "./scheduledEmailQueue";
import { snoozeQueue } from "./snoozeQueue";
import { calendarConnectionSetupQueue } from "./calendarConnectionSetupQueue";

let initialized = false;
const workers: Worker[] = [];

export const initializeQueues = () => {
  if (initialized) {
    return;
  }

  workers.push(registerCampaignWorker());
  workers.push(registerFollowUpWorker());
  workers.push(registerTrackingWorker());
  workers.push(registerReminderWorker());
  workers.push(registerCalendarSyncWorker());
  workers.push(registerScheduledEmailWorker());
  workers.push(registerSnoozeRestoreWorker());
  workers.push(registerCalendarConnectionSetupWorker());

  initialized = true;
};

export const getWorkers = (): Worker[] => {
  return [...workers];
};

export const closeQueues = async () => {
  await Promise.all([
    campaignQueue.close(),
    followUpQueue.close(),
    trackingQueue.close(),
    reminderQueue.close(),
    calendarSyncQueue.close(),
    scheduledEmailQueue.close(),
    snoozeQueue.close(),
    calendarConnectionSetupQueue.close(),
  ]);
};


