export enum QueueName {
  CampaignDispatch = "campaign-dispatch",
  FollowUpDispatch = "follow-up-dispatch",
  Tracking = "tracking-events",
  MeetingReminderDispatch = "meeting-reminder-dispatch",
  CalendarSync = "calendar-sync",
  ScheduledEmail = "scheduled-email",
  SnoozeRestore = "snooze-restore",
  CalendarConnectionSetup = "calendar-connection-setup",
}

export type CampaignDispatchJob = {
  campaignId: string;
  recipientId: string;
  attempt: number;
};

export type FollowUpDispatchJob = {
  followUpSequenceId: string;
  followUpStepId: string;
  recipientId: string;
  scheduledAt: string;
  attempt: number;
  condition?: "always" | "if_not_opened" | "if_not_replied" | "if_not_clicked";
  stopOnReply?: boolean;
  stopOnOpen?: boolean;
};

export type TrackingEventJob = {
  messageLogId: string;
  eventType: "OPEN" | "CLICK" | "REPLY" | "BOUNCE" | "UNSUBSCRIBE";
  meta?: Record<string, unknown>;
  occurredAt: string;
};

export type MeetingReminderJob = {
  reminderId: string;
  attempt: number;
};

export type CalendarSyncJob = {
  userId: string;
  connectionId: string;
  start: string;
  end: string;
  calendars?: string[];
};

export type ScheduledEmailJob = {
  scheduledEmailId: string;
  userId: string;
};

export type SnoozeRestoreJob = {
  snoozeId: string;
  messageId: string;
  userId: string;
};

export type CalendarConnectionSetupJob = {
  userId: string;
  profile: {
    email?: string | null;
    id?: string | null;
    name?: string | null;
    picture?: string | null;
  };
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  expiryDate: string; // ISO string
};

