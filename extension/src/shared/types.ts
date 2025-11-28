export type UserProfile = {
  id: string;
  email: string;
  displayName?: string | null;
  pictureUrl?: string | null;
};

export type CampaignRecipientSummary = {
  id: string;
  status: "PENDING" | "SENT" | "FAILED" | "SUPPRESSED";
};

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  recipients: {
    total: number;
    sent: number;
  };
};

export type CampaignMetrics = {
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  opens: number;
  clicks: number;
};

export type FollowUpStepDraft = {
  delayMs?: number; // Relative delay in milliseconds (hours * 3600000)
  scheduledAt?: string; // Absolute scheduled date/time (ISO 8601)
  useDateTime?: boolean; // true = use date/time, false = use hours delay
  subject: string;
  html: string;
  sendAsReply?: boolean;
  parentStepId?: string;
  isNested?: boolean;
};

export type FollowUpSequenceDraft = {
  name: string;
  steps: FollowUpStepDraft[];
};

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
  color?: string | null;
  messageListVisibility?: "show" | "hide" | null;
  labelListVisibility?: "labelShow" | "labelHide" | null;
};

export type CalendarProvider = "google" | "microsoft" | "other";

export type CalendarConnectionSummary = {
  id: string;
  provider: CalendarProvider;
  accountEmail: string;
  timeZone?: string | null;
  defaultCalendarId?: string | null;
  connectedAt?: string;
  lastSyncedAt?: string | null;
  syncStatus?: "ok" | "never" | "error";
  syncCadenceMinutes?: number | null;
  selectedCalendars: string[];
};

export type CalendarListEntry = {
  id: string;
  summary: string;
  description?: string | null;
  timeZone?: string | null;
  color?: string | null;
  primary: boolean;
  selected: boolean;
};

export type MeetingLocationKind = "googleMeet" | "phone" | "inPerson" | "customUrl";

export type MeetingTypeBookingStats = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  declined: number;
  lastBookedAt?: string | null;
};

export type BookingLinkSummary = {
  id: string;
  name?: string | null;
  token: string;
  isPublic: boolean;
  createdAt: string;
};

export type MeetingTypeSummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  maxBookingsPerDay?: number | null;
  meetingLocationType: MeetingLocationKind;
  meetingLocationValue?: string | null;
  isActive: boolean;
  calendarConnectionId?: string | null;
  updatedAt?: string;
  availabilityRules?: unknown;
  formSchema?: unknown;
  bookingLinks: BookingLinkSummary[];
  bookingStats: MeetingTypeBookingStats;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  status: "busy" | "free" | "held";
  source?: "calendar" | "buffer" | "booking";
  meetingTypeId?: string;
};

export type AvailabilityDay = {
  date: string;
  slots: AvailabilitySlot[];
  isFullyBooked?: boolean;
};

export type FollowUpConditionField = "noReplySince" | "hasLabel" | "threadStatus" | "manualTag";
export type FollowUpConditionOperator = "gt" | "lt" | "includes" | "excludes" | "equals";

export type FollowUpCondition = {
  id: string;
  field: FollowUpConditionField;
  operator: FollowUpConditionOperator;
  value: string;
  unit?: "hours" | "days";
};

export type FollowUpActionType = "sendEmail" | "applyLabel" | "stopSequence";

export type FollowUpAction = {
  id: string;
  type: FollowUpActionType;
  subject?: string;
  bodyHtml?: string;
  labelId?: string;
};

export type FollowUpSchedule =
  | {
      mode: "relative";
      sendAfterHours?: number;
      sendAfterDays?: number;
      timezone: string;
    }
  | {
      mode: "absolute";
      sendAt: string;
      timezone: string;
    }
  | {
      mode: "weekly";
      daysOfWeek: Array<"monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday">;
      sendTime: string;
      timezone: string;
    };

export type FollowUpStopConditions = {
  onReply: boolean;
  onOpen: boolean;
  onClick: boolean;
};

export type FollowUpAutomationRule = {
  id: string;
  name: string;
  schedule: FollowUpSchedule;
  conditions: FollowUpCondition[];
  actions: FollowUpAction[];
  stopConditions: FollowUpStopConditions;
  maxFollowUps?: number | null;
  isActive: boolean;
};

export type FollowUpAutomationTarget =
  | { type: "label"; labelIds: string[] }
  | { type: "query"; query: string }
  | { type: "folder"; folderId: string };

export type FollowUpAutomation = {
  id: string;
  target: FollowUpAutomationTarget;
  rules: FollowUpAutomationRule[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
};

export type FollowUpAutomationPayload = {
  target: FollowUpAutomationTarget;
  timezone: string;
  rules: Array<
    Omit<FollowUpAutomationRule, "id" | "actions" | "conditions"> & {
    conditions: Array<Omit<FollowUpCondition, "id">>;
    actions: Array<Omit<FollowUpAction, "id">>;
    }
  >;
};

export type SheetImportResult = {
  sheetSource: {
    id: string;
    title: string;
    spreadsheetId: string;
    worksheetId: string | null;
    columns: Array<{ name: string; index: number }>;
  };
  headers: string[];
  records: Record<string, string>[];
  importedAt: string;
};


