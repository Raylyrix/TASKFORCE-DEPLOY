import { registerCampaignWorker } from "./campaignQueue";
import { registerFollowUpWorker } from "./followUpQueue";
import { registerTrackingWorker } from "./trackingQueue";
import { registerReminderWorker } from "./reminderQueue";
import { registerCalendarSyncWorker } from "./calendarSyncQueue";
import { registerScheduledEmailWorker } from "./scheduledEmailQueue";
import { registerSnoozeRestoreWorker } from "./snoozeQueue";

let initialized = false;

export const initializeQueues = () => {
  if (initialized) {
    return;
  }

  registerCampaignWorker();
  registerFollowUpWorker();
  registerTrackingWorker();
  registerReminderWorker();
  registerCalendarSyncWorker();
  registerScheduledEmailWorker();
  registerSnoozeRestoreWorker();

  initialized = true;
};


