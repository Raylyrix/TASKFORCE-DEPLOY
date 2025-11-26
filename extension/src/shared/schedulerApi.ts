import type {
  AvailabilityDay,
  CalendarConnectionSummary,
  CalendarListEntry,
  MeetingTypeSummary,
} from "./types";
import { apiClient } from "./apiClient";

type ConnectionsResponse = {
  connections: Array<{
    id: string;
    provider: "GOOGLE" | "MICROSOFT" | "OTHER";
    accountEmail: string;
    externalAccountId: string;
    defaultCalendarId?: string | null;
    timeZone?: string | null;
    connectedAt: string;
    metadata?: Record<string, unknown> | null;
    lastSyncedAt?: string | null;
    syncCadenceMinutes?: number | null;
    selectedCalendars?: string[];
  }>;
};

type MeetingTypesResponse = {
  meetingTypes: Array<{
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    durationMinutes: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    maxBookingsPerDay?: number | null;
    meetingLocationType: string;
    meetingLocationValue?: string | null;
    isActive: boolean;
    calendarConnectionId?: string | null;
    updatedAt: string;
    availabilityRules?: unknown;
    formSchema?: unknown | null;
    bookingLinks: Array<{
      id: string;
      name?: string | null;
      token: string;
      isPublic: boolean;
      createdAt: string;
    }>;
    bookingStats: {
      total: number;
      confirmed: number;
      pending: number;
      cancelled: number;
      declined: number;
      lastBookedAt?: string | null;
    };
  }>;
};

type AvailabilityResponse = {
  availability: AvailabilityDay[];
  metadata: {
    cachesEvaluated: number;
    rangeStart: string;
    rangeEnd: string;
    meetingTypeId: string | null;
  };
};

const providerMap: Record<string, "google" | "microsoft" | "other"> = {
  GOOGLE: "google",
  MICROSOFT: "microsoft",
  OTHER: "other",
};

const meetingLocationMap: Record<string, MeetingTypeSummary["meetingLocationType"]> = {
  GOOGLE_MEET: "googleMeet",
  PHONE: "phone",
  IN_PERSON: "inPerson",
  CUSTOM_URL: "customUrl",
};

export const schedulerApi = {
  async fetchConnections(): Promise<CalendarConnectionSummary[]> {
    const response = await apiClient.request<ConnectionsResponse>("/api/calendar/connections");
    return response.connections.map((connection) => {
      const metadata = connection.metadata as Record<string, unknown> | null;
      const selectedCalendars = Array.isArray(connection.selectedCalendars)
        ? connection.selectedCalendars
        : Array.isArray(metadata?.calendars)
          ? (metadata.calendars as unknown[])
              .filter((value): value is string => typeof value === "string")
          : [];
      const syncPreferences = (metadata?.syncPreferences as { cadenceMinutes?: unknown } | undefined) ?? {};
      const syncCadence =
        typeof connection.syncCadenceMinutes === "number"
          ? connection.syncCadenceMinutes
          : typeof syncPreferences.cadenceMinutes === "number"
            ? syncPreferences.cadenceMinutes
            : null;
      const lastSynced =
        connection.lastSyncedAt ??
        (metadata && typeof metadata.lastSyncedAt === "string" ? (metadata.lastSyncedAt as string) : null);

      return {
        id: connection.id,
        provider: providerMap[connection.provider] ?? "other",
        accountEmail: connection.accountEmail,
        defaultCalendarId: connection.defaultCalendarId ?? null,
        timeZone: connection.timeZone ?? null,
        connectedAt: connection.connectedAt,
        lastSyncedAt: lastSynced,
        syncCadenceMinutes: syncCadence,
        selectedCalendars,
      };
    });
  },

  async createMeetingType(payload: {
    name: string;
    description?: string;
    durationMinutes: number;
    meetingLocationType: "GOOGLE_MEET" | "PHONE" | "IN_PERSON" | "CUSTOM_URL";
    meetingLocationValue?: string;
    calendarConnectionId?: string | null;
    createDefaultBookingLink?: boolean;
  }) {
    return apiClient.request<{ meetingType: MeetingTypeSummary }>("/api/calendar/meeting-types", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateMeetingType(meetingTypeId: string, payload: Partial<{
    name: string;
    description?: string | null;
    durationMinutes: number;
    meetingLocationType: "GOOGLE_MEET" | "PHONE" | "IN_PERSON" | "CUSTOM_URL";
    meetingLocationValue?: string | null;
    bufferBeforeMinutes?: number;
    bufferAfterMinutes?: number;
    isActive?: boolean;
    createBookingLink?: boolean;
    bookingLinkName?: string;
  }>) {
    return apiClient.request<{ meetingType: MeetingTypeSummary }>(`/api/calendar/meeting-types/${meetingTypeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async syncConnection(connectionId: string) {
    const now = new Date();
    return apiClient.request(`/api/calendar/${connectionId}/sync`, {
      method: "POST",
      body: JSON.stringify({
        start: now.toISOString(),
        end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
  },

  async updateConnectionPreferences(
    connectionId: string,
    payload: { syncCadenceMinutes?: number | null; calendars?: string[] },
  ): Promise<CalendarConnectionSummary> {
    const response = await apiClient.request<{ connection: CalendarConnectionSummary }>(
      `/api/calendar/connections/${connectionId}/preferences`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    const connection = response.connection;
    return {
      ...connection,
      selectedCalendars: connection.selectedCalendars ?? [],
      syncCadenceMinutes:
        typeof connection.syncCadenceMinutes === "number" ? connection.syncCadenceMinutes : null,
    };
  },

  async fetchConnectionCalendars(connectionId: string): Promise<CalendarListEntry[]> {
    const response = await apiClient.request<{ calendars: CalendarListEntry[] }>(
      `/api/calendar/connections/${connectionId}/calendars`,
    );
    return response.calendars;
  },


  async fetchMeetingTypes(): Promise<MeetingTypeSummary[]> {
    const response = await apiClient.request<MeetingTypesResponse>("/api/calendar/meeting-types");
    return response.meetingTypes.map((meetingType) => ({
      id: meetingType.id,
      name: meetingType.name,
      slug: meetingType.slug,
      description: meetingType.description ?? null,
      durationMinutes: meetingType.durationMinutes,
      bufferBeforeMinutes: meetingType.bufferBeforeMinutes,
      bufferAfterMinutes: meetingType.bufferAfterMinutes,
      maxBookingsPerDay: meetingType.maxBookingsPerDay ?? null,
      meetingLocationType:
        meetingLocationMap[meetingType.meetingLocationType] ?? "googleMeet",
      meetingLocationValue: meetingType.meetingLocationValue ?? null,
      isActive: meetingType.isActive,
      calendarConnectionId: meetingType.calendarConnectionId ?? null,
      updatedAt: meetingType.updatedAt,
      availabilityRules: meetingType.availabilityRules ?? null,
      formSchema: meetingType.formSchema ?? null,
      bookingLinks: meetingType.bookingLinks.map((link) => ({
        id: link.id,
        name: link.name ?? null,
        token: link.token,
        isPublic: link.isPublic,
        createdAt: link.createdAt,
      })),
      bookingStats: {
        total: meetingType.bookingStats.total,
        confirmed: meetingType.bookingStats.confirmed,
        pending: meetingType.bookingStats.pending,
        cancelled: meetingType.bookingStats.cancelled,
        declined: meetingType.bookingStats.declined,
        lastBookedAt: meetingType.bookingStats.lastBookedAt ?? null,
      },
    }));
  },

  async fetchAvailability(params: { start: string; end: string; meetingTypeId?: string }): Promise<AvailabilityResponse> {
    const search = new URLSearchParams({
      start: params.start,
      end: params.end,
      ...(params.meetingTypeId ? { meetingTypeId: params.meetingTypeId } : {}),
    }).toString();
    return apiClient.request<AvailabilityResponse>(`/api/calendar/availability?${search}`);
  },
};


