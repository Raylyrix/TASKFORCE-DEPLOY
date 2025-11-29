import { create } from "zustand";

import type {
  CampaignSummary,
  CampaignMetrics,
  UserProfile,
  SheetImportResult,
  FollowUpSequenceDraft,
  CalendarConnectionSummary,
  MeetingTypeSummary,
  AvailabilityDay,
} from "./types";

type SelectedTab = "composer" | "followUps" | "campaigns";

type ComposerDraft = {
  campaignName: string;
  sheetUrl: string;
  headerRowIndex: number;
  importResult: SheetImportResult | null;
  emailField: string;
  subjectTemplate: string;
  bodyTemplate: string;
  startAt: string;
  delayMsBetweenEmails: number;
  trackOpens: boolean;
  trackClicks: boolean;
  followUpSequence: FollowUpSequenceDraft | null;
  lastSavedAt?: string;
  autocompleteEnabled: boolean;
};

type FollowUpOverlayState = {
  isOpen: boolean;
  draft: FollowUpSequenceDraft | null;
};

type SchedulerState = {
  isLoading: boolean;
  calendarConnections: CalendarConnectionSummary[];
  meetingTypes: MeetingTypeSummary[];
  availability: AvailabilityDay[];
  availabilityMetadata?: {
    rangeStart: string;
    rangeEnd: string;
    meetingTypeId: string | null;
    cachesEvaluated: number;
  };
  availabilityIsLoading: boolean;
  availabilityError?: string | null;
  selectedMeetingTypeId?: string;
  selectedBookingLinkId?: string;
  selectedDate?: string;
  lastSyncedAt?: string;
  error?: string | null;
  syncState: {
    isSyncing: boolean;
    lastSyncedAt?: string;
    error?: string | null;
  };
};

type ExtensionState = {
  user: UserProfile | null;
  backendUrl: string;
  campaigns: CampaignSummary[];
  campaignMetrics: Record<string, CampaignMetrics>;
  selectedTab: SelectedTab;
  composerDraft: ComposerDraft;
  followUpOverlay: FollowUpOverlayState;
  scheduler: SchedulerState;
  setUser: (user: UserProfile | null) => void;
  setBackendUrl: (backendUrl: string) => void;
  setCampaigns: (campaigns: CampaignSummary[]) => void;
  setCampaignMetrics: (campaignId: string, metrics: CampaignMetrics) => void;
  setSelectedTab: (tab: SelectedTab) => void;
  updateComposerDraft: (partial: Partial<ComposerDraft>) => void;
  resetComposerDraft: () => void;
  openFollowUpOverlay: (sequence?: FollowUpSequenceDraft | null) => void;
  closeFollowUpOverlay: () => void;
  updateFollowUpDraft: (sequence: FollowUpSequenceDraft | null) => void;
  setSchedulerState: (partial: Partial<SchedulerState>) => void;
  resetSchedulerState: () => void;
  upsertMeetingTypes: (meetingTypes: MeetingTypeSummary[]) => void;
  upsertCalendarConnections: (connections: CalendarConnectionSummary[]) => void;
  setSelectedMeetingType: (meetingTypeId: string | undefined) => void;
  setSelectedBookingLink: (bookingLinkId: string | undefined) => void;
  setAvailabilityData: (payload: {
    availability: AvailabilityDay[];
    metadata?: SchedulerState["availabilityMetadata"];
  }) => void;
  setAvailabilityLoading: (isLoading: boolean, error?: string | null) => void;
  startCalendarSync: () => void;
  completeCalendarSync: (error?: string | null) => void;
};

const COMPOSER_STORAGE_KEY = "taskforce-composer-draft";
const FRESH_INSTANCE_KEY = "taskforce-fresh-instance-flag";

const cloneFollowUpSequence = (sequence: FollowUpSequenceDraft): FollowUpSequenceDraft => ({
  name: sequence.name,
  steps: sequence.steps.map((step) => ({ ...step })),
});

const createDefaultFollowUpSequence = (): FollowUpSequenceDraft => {
  const defaultDelay = 48 * 60 * 60 * 1000; // 48 hours
  const defaultScheduledAt = new Date(Date.now() + defaultDelay).toISOString();
  return {
    name: "Follow-up Sequence",
    steps: [
      {
        delayMs: defaultDelay,
        scheduledAt: defaultScheduledAt,
        useDateTime: false,
        subject: "Circling back on {{company}}",
        html: `<p>Hi {{firstName}},</p>
<p>Just checking whether you had a chance to review my earlier note.</p>
<p>Thanks!<br/>{{senderName}}</p>`,
        sendAsReply: false,
        isNested: false,
      },
    ],
  };
};

const createDefaultDraft = (): ComposerDraft => ({
  campaignName: "New Gmail Campaign",
  sheetUrl: "",
  headerRowIndex: 0,
  importResult: null,
  emailField: "",
  subjectTemplate: "{{firstName}} \u2014 quick follow up",
  bodyTemplate: `<p>Hi {{firstName}},</p>
<p>Just wanted to follow up on {{company}} and see if you're still interested.</p>
<p>Best,<br/>{{senderName}}</p>`,
  startAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  delayMsBetweenEmails: 45_000,
  trackOpens: true,
  trackClicks: false,
  followUpSequence: null,
  lastSavedAt: undefined,
  autocompleteEnabled: true,
});

const loadComposerDraft = (): ComposerDraft => {
  if (typeof window === "undefined") {
    return createDefaultDraft();
  }
  
  // Check if this is a fresh instance - if so, don't load from storage
  const isFreshInstance = window.sessionStorage.getItem(FRESH_INSTANCE_KEY) === "true";
  if (isFreshInstance) {
    // Clear the flag so it only applies once
    window.sessionStorage.removeItem(FRESH_INSTANCE_KEY);
    const freshDraft = createDefaultDraft();
    // Don't persist fresh draft to localStorage
    return freshDraft;
  }
  
  try {
    const raw = window.localStorage.getItem(COMPOSER_STORAGE_KEY);
    if (!raw) {
      const fallback = createDefaultDraft();
      window.localStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<ComposerDraft>;
    return {
      ...createDefaultDraft(),
      ...parsed,
      importResult: parsed.importResult ?? null,
      followUpSequence: parsed.followUpSequence ?? null,
      autocompleteEnabled: parsed.autocompleteEnabled ?? true,
    };
  } catch (error) {
    console.warn("Failed to load composer draft from storage", error);
    const fallback = createDefaultDraft();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify(fallback));
    }
    return fallback;
  }
};

const persistComposerDraft = (draft: ComposerDraft) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(COMPOSER_STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn("Failed to persist composer draft", error);
  }
};

export const useExtensionStore = create<ExtensionState>((set) => ({
  user: null,
  backendUrl: "",
  campaigns: [],
  campaignMetrics: {},
  selectedTab: "composer",
  composerDraft: loadComposerDraft(),
  followUpOverlay: {
    isOpen: false,
    draft: null,
  },
  scheduler: {
    isLoading: false,
    calendarConnections: [],
    meetingTypes: [],
    availability: [],
     availabilityMetadata: undefined,
    availabilityIsLoading: false,
    availabilityError: null,
    selectedMeetingTypeId: undefined,
    selectedBookingLinkId: undefined,
    selectedDate: undefined,
    lastSyncedAt: undefined,
    error: null,
    syncState: {
      isSyncing: false,
      lastSyncedAt: undefined,
      error: null,
    },
  },
  setUser: (user) => set({ user }),
  setBackendUrl: (backendUrl) => set({ backendUrl }),
  setCampaigns: (campaigns) => set({ campaigns }),
  setCampaignMetrics: (campaignId, metrics) =>
    set((state) => ({
      campaignMetrics: {
        ...state.campaignMetrics,
        [campaignId]: metrics,
      },
    })),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
  updateComposerDraft: (partial) =>
    set((state) => {
      const nextDraft: ComposerDraft = {
        ...state.composerDraft,
        ...partial,
      };
      if (partial.followUpSequence) {
        nextDraft.followUpSequence = cloneFollowUpSequence(partial.followUpSequence);
      }
      if (partial.lastSavedAt === undefined) {
        nextDraft.lastSavedAt = state.composerDraft.lastSavedAt;
      }
      persistComposerDraft(nextDraft);
      return { composerDraft: nextDraft };
    }),
  resetComposerDraft: () =>
    set(() => {
      const draft = createDefaultDraft();
      persistComposerDraft(draft);
      return { composerDraft: draft };
    }),
  openFollowUpOverlay: (sequence) =>
    set((state) => ({
      followUpOverlay: {
        isOpen: true,
        draft: sequence
          ? cloneFollowUpSequence(sequence)
          : cloneFollowUpSequence(state.composerDraft.followUpSequence ?? createDefaultFollowUpSequence()),
      },
    })),
  closeFollowUpOverlay: () =>
    set({
      followUpOverlay: {
        isOpen: false,
        draft: null,
      },
    }),
  updateFollowUpDraft: (sequence) =>
    set((state) => ({
      followUpOverlay: {
        ...state.followUpOverlay,
        draft: sequence ? cloneFollowUpSequence(sequence) : null,
      },
    })),
  setSchedulerState: (partial) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        ...partial,
      },
    })),
  resetSchedulerState: () =>
    set(() => ({
      scheduler: {
        isLoading: false,
        calendarConnections: [],
        meetingTypes: [],
        availability: [],
        availabilityMetadata: undefined,
        availabilityIsLoading: false,
        availabilityError: null,
        selectedMeetingTypeId: undefined,
        selectedBookingLinkId: undefined,
        selectedDate: undefined,
        lastSyncedAt: undefined,
        error: null,
        syncState: {
          isSyncing: false,
          lastSyncedAt: undefined,
          error: null,
        },
      },
    })),
  upsertMeetingTypes: (meetingTypes) =>
    set((state) => {
      const existing = new Map(state.scheduler.meetingTypes.map((item) => [item.id, item]));
      meetingTypes.forEach((item) => existing.set(item.id, item));
      return {
        scheduler: {
          ...state.scheduler,
          meetingTypes: Array.from(existing.values()).sort((a, b) => a.name.localeCompare(b.name)),
        },
      };
    }),
  upsertCalendarConnections: (connections) =>
    set((state) => {
      const existing = new Map(state.scheduler.calendarConnections.map((item) => [item.id, item]));
      connections.forEach((item) => existing.set(item.id, item));
      return {
        scheduler: {
          ...state.scheduler,
          calendarConnections: Array.from(existing.values()).sort((a, b) =>
            a.accountEmail.localeCompare(b.accountEmail),
          ),
        },
      };
    }),
  setSelectedMeetingType: (meetingTypeId) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        selectedMeetingTypeId: meetingTypeId,
        selectedBookingLinkId: undefined,
      },
    })),
  setSelectedBookingLink: (bookingLinkId) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        selectedBookingLinkId: bookingLinkId,
      },
    })),
  setAvailabilityData: ({ availability, metadata }) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        availability,
        availabilityMetadata: metadata,
        availabilityIsLoading: false,
        availabilityError: null,
      },
    })),
  setAvailabilityLoading: (isLoading, error) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        availabilityIsLoading: isLoading,
        availabilityError: error ?? null,
      },
    })),
  startCalendarSync: () =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        syncState: {
          isSyncing: true,
          lastSyncedAt: state.scheduler.syncState.lastSyncedAt,
          error: null,
        },
      },
    })),
  completeCalendarSync: (error) =>
    set((state) => ({
      scheduler: {
        ...state.scheduler,
        syncState: {
          isSyncing: false,
          lastSyncedAt: error ? state.scheduler.syncState.lastSyncedAt : new Date().toISOString(),
          error: error ?? null,
        },
      },
    })),
}));


