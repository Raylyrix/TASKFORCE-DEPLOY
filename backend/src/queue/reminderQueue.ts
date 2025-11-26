import type { Job } from "bullmq";

import { QueueName, type MeetingReminderJob } from "./types";
import { createQueue, registerWorker } from "./queueFactory";
import { meetingRemindersService } from "../services/meetingReminders";

export const reminderQueue = createQueue<MeetingReminderJob>(QueueName.MeetingReminderDispatch);

export const registerReminderWorker = () =>
  registerWorker<MeetingReminderJob>(
    QueueName.MeetingReminderDispatch,
    async (job: Job<MeetingReminderJob>) => {
      await meetingRemindersService.processReminderDispatch(job.data);
    },
  );










