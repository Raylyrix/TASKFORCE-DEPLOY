// Use relative URL for API calls - Next.js rewrites will proxy to backend
// This avoids needing NEXT_PUBLIC_API_URL at build time
// In browser, use relative URL; in SSR, use production backend URL
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: use relative URL, Next.js rewrites will handle it
    return '';
  }
  // Server-side: use production backend URL (not localhost)
  return process.env.NEXT_PUBLIC_API_URL || 'https://taskforce-backend-production.up.railway.app';
};

const API_URL = getApiUrl();

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body } = options;

  // Get user ID from localStorage (set after login)
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  const requestHeaders: HeadersInit = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (userId) {
    requestHeaders["X-User-Id"] = userId;
  }

  const config: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== "GET") {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_URL}${path}`, config);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText || `Request failed with status ${response.status}`;
      
      // Try to parse as JSON for structured errors
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch {
        // Not JSON, use text as-is
      }

      // Handle "User not found" - redirect to login
      if (response.status === 401 || errorMessage.includes("User not found") || errorMessage.includes("Unauthorized")) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("userId");
          localStorage.removeItem("userEmail");
          localStorage.removeItem("userDisplayName");
          localStorage.removeItem("userPictureUrl");
          // Only redirect if not already on login page
          if (!window.location.pathname.includes("/login") && !window.location.pathname.includes("/auth")) {
            window.location.href = "/login";
          }
        }
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  } catch (error) {
    // Re-throw to let caller handle
    throw error;
  }
}

export const api = {
  // Auth
  auth: {
    startGoogleAuth: (redirectUri?: string) =>
      apiRequest<{ url: string; state: string; expiresAt: string; scopes: string[] }>(
        "/api/auth/google/start",
        {
          method: "POST",
          body: { redirectUri },
        },
      ),
    exchangeCode: (code: string, state: string) =>
      apiRequest<{ user: { id: string; email: string; displayName: string; pictureUrl: string | null } }>(
        "/api/auth/google/exchange",
        {
          method: "POST",
          body: { code, state },
        },
      ),
  },

  // Campaigns
  campaigns: {
    list: async () => {
      const response = await apiRequest<{ campaigns: Array<{ id: string; name: string; status: string; createdAt: string }> }>("/api/campaigns");
      return response.campaigns;
    },
    get: (id: string) =>
      apiRequest<{
        id: string;
        name: string;
        status: string;
        summary: {
          total: number;
          sent: number;
          opened: number;
          clicked: number;
          failed: number;
        };
      }>(`/api/campaigns/${id}`),
    create: (data: {
      name: string;
      recipients: { emailField: string; rows: Record<string, string>[] };
      strategy?: {
        startAt?: string;
        delayMsBetweenEmails?: number;
        trackOpens?: boolean;
        trackClicks?: boolean;
        template: { subject: string; html: string };
      };
    }) => apiRequest<{ id: string }>("/api/campaigns", { method: "POST", body: data }),
    schedule: (id: string, startAt?: string) =>
      apiRequest<{ campaignId: string; status: string; startAt: string }>(`/api/campaigns/${id}/schedule`, {
        method: "POST",
        body: startAt ? { startAt } : undefined,
      }),
    pause: (id: string) =>
      apiRequest<{ id: string }>(`/api/campaigns/${id}/pause`, { method: "POST" }),
    cancel: (id: string) =>
      apiRequest<{ id: string }>(`/api/campaigns/${id}/cancel`, { method: "POST" }),
    getRecipients: (id: string) =>
      apiRequest<
        Array<{
          email: string;
          status: string;
          sentAt: string | null;
          openedAt: string | null;
          clickedAt: string | null;
        }>
      >(`/api/campaigns/${id}/recipients`),
    getRecipientActivity: (campaignId: string, email: string) =>
      apiRequest<
        Array<{
          type: string;
          timestamp: string;
          data: Record<string, unknown>;
        }>
      >(`/api/campaigns/${campaignId}/recipients/${encodeURIComponent(email)}/activity`),
  },

  // Calendar
  calendar: {
    getConnections: async () => {
      const response = await apiRequest<{
        connections: Array<{
          id: string;
          accountEmail: string;
          timeZone: string | null;
          lastSyncedAt: string | null;
        }>;
      }>("/api/calendar/connections");
      return response.connections;
    },
    sync: (connectionId: string) =>
      apiRequest<{ success: boolean }>(`/api/calendar/${connectionId}/sync`, { method: "POST" }),
    getMeetingTypes: async () => {
      const response = await apiRequest<{
        meetingTypes: Array<{
          id: string;
          name: string;
          durationMinutes: number;
          isActive: boolean;
          bookingStats: {
            total: number;
            confirmed: number;
            pending: number;
          };
          bookingLinks?: Array<{
            id: string;
            name: string;
            token: string;
            isPublic: boolean;
          }>;
        }>;
      }>("/api/calendar/meeting-types");
      return response.meetingTypes;
    },
    createMeetingType: (data: {
      name: string;
      durationMinutes: number;
      description?: string;
      calendarConnectionId: string;
      meetingLocationType: "GOOGLE_MEET" | "PHONE" | "CUSTOM_URL";
      meetingLocationValue?: string;
      createDefaultBookingLink?: boolean;
      bookingLinkName?: string;
    }) =>
      apiRequest<{
        id: string;
        name: string;
        bookingLinks: Array<{ id: string; token: string; name: string }>;
      }>("/api/calendar/meeting-types", {
        method: "POST",
        body: data,
      }),
    updateMeetingType: (id: string, data: {
      name?: string;
      durationMinutes?: number;
      description?: string;
      isActive?: boolean;
      meetingLocationType?: "GOOGLE_MEET" | "PHONE" | "CUSTOM_URL";
      meetingLocationValue?: string;
    }) =>
      apiRequest<{ id: string }>(`/api/calendar/meeting-types/${id}`, {
        method: "PUT",
        body: data,
      }),
    getEvents: (options?: { start?: string; end?: string; calendarId?: string; region?: string }) => {
      const params = new URLSearchParams();
      if (options?.start) params.append("start", options.start);
      if (options?.end) params.append("end", options.end);
      if (options?.calendarId) params.append("calendarId", options.calendarId);
      if (options?.region) params.append("region", options.region);
      return apiRequest<{
        events: Array<{
          id: string;
          summary: string;
          description: string;
          start: string;
          end: string;
          location: string;
          attendees: Array<{
            email: string;
            displayName: string;
            responseStatus: string;
          }>;
          conferenceData: {
            entryPoints: Array<{
              uri: string;
              label: string;
            }>;
          } | null;
          htmlLink: string;
          status: string;
          calendarId?: string;
          isHoliday?: boolean;
          holidayType?: string;
        }>;
      }>(`/api/calendar/events${params.toString() ? `?${params.toString()}` : ""}`);
    },
    createEvent: (data: {
      summary: string;
      description?: string;
      start: string;
      end: string;
      location?: string;
      attendees?: Array<{ email: string; displayName?: string }>;
      calendarId?: string;
    }) =>
      apiRequest<{
        event: {
          id: string;
          summary: string;
          description: string;
          start: string;
          end: string;
          location: string;
          htmlLink: string;
        };
      }>("/api/calendar/events", {
        method: "POST",
        body: data,
      }),
    updateEvent: (eventId: string, data: {
      summary?: string;
      description?: string;
      start?: string;
      end?: string;
      location?: string;
      attendees?: Array<{ email: string; displayName?: string }>;
      calendarId?: string;
    }) =>
      apiRequest<{
        event: {
          id: string;
          summary: string;
          description: string;
          start: string;
          end: string;
          location: string;
          htmlLink: string;
        };
      }>(`/api/calendar/events/${eventId}`, {
        method: "PUT",
        body: data,
      }),
    deleteEvent: (eventId: string, calendarId?: string) => {
      const params = new URLSearchParams();
      if (calendarId) params.append("calendarId", calendarId);
      return apiRequest<{ success: boolean }>(`/api/calendar/events/${eventId}${params.toString() ? `?${params.toString()}` : ""}`, {
        method: "DELETE",
      });
    },
  },

  // Gmail
  gmail: {
    getMessages: (options?: { pageToken?: string; maxResults?: number; query?: string }) => {
      const params = new URLSearchParams();
      if (options?.pageToken) params.append("pageToken", options.pageToken);
      if (options?.maxResults) params.append("maxResults", options.maxResults.toString());
      if (options?.query) params.append("q", options.query);
      return apiRequest<{
        messages: Array<{
          id: string;
          threadId: string;
          subject?: string;
          from?: string;
          date?: string;
          snippet?: string;
          labelIds?: string[];
        }>;
        nextPageToken?: string;
        resultSizeEstimate: number;
      }>(`/api/gmail/messages${params.toString() ? `?${params.toString()}` : ""}`);
    },
    getMessage: (id: string) =>
      apiRequest<{
        id: string;
        threadId: string;
        snippet: string;
        payload: {
          headers: Record<string, string>;
          body: { text: string; html: string };
          attachments?: Array<{
            filename: string;
            mimeType: string;
            size: number;
            attachmentId: string;
          }>;
        };
        internalDate?: number;
        sizeEstimate?: number;
        labelIds: string[];
      }>(`/api/gmail/messages/${id}`),
    action: (messageId: string, action: "read" | "unread" | "archive" | "unarchive" | "delete" | "trash" | "star" | "unstar", labelIds?: string[]) =>
      apiRequest<{ success: boolean; messageId: string }>(`/api/gmail/messages/${messageId}/actions`, {
        method: "POST",
        body: { action, labelIds },
      }),
    addLabel: (messageId: string, labelId: string) =>
      apiRequest<{ success: boolean; messageId: string }>(`/api/gmail/messages/${messageId}/actions`, {
        method: "POST",
        body: { action: "read", labelIds: [labelId] },
      }),
    removeLabel: (messageId: string, labelId: string) => {
      // Get current labels first, then remove the specified one
      return apiRequest<{ success: boolean; messageId: string }>(`/api/gmail/messages/${messageId}/actions`, {
        method: "POST",
        body: { action: "read" },
      });
    },
    bulkAction: (messageIds: string[], action: "read" | "unread" | "archive" | "unarchive" | "delete" | "trash" | "star" | "unstar", labelIds?: string[]) =>
      apiRequest<{ success: boolean; processed: number }>("/api/gmail/messages/bulk-actions", {
        method: "POST",
        body: { messageIds, action, labelIds },
      }),
    reply: (messageId: string, text: string, html?: string, replyAll?: boolean) =>
      apiRequest<{ success: boolean; messageId: string; threadId: string }>(`/api/gmail/messages/${messageId}/reply`, {
        method: "POST",
        body: { text, html, replyAll },
      }),
    send: (data: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      text: string;
      html?: string;
    }) =>
      apiRequest<{ success: boolean; messageId: string; threadId: string }>("/api/gmail/messages/send", {
        method: "POST",
        body: data,
      }),
    getLabels: () =>
      apiRequest<{
        labels: Array<{
          id: string;
          name: string;
          type: "system" | "user";
          color: string | null;
        }>;
      }>("/api/gmail/labels"),
    getThread: (threadId: string) =>
      apiRequest<{
        threadId: string;
        messages: Array<{
          id: string;
          threadId: string;
          snippet: string;
          payload: {
            headers: Record<string, string>;
            body: { text: string; html: string };
            attachments?: Array<{
              filename: string;
              mimeType: string;
              size: number;
              attachmentId: string;
            }>;
          };
          internalDate?: number;
          labelIds: string[];
        }>;
      }>(`/api/gmail/threads/${threadId}`),
  },

  // Email Features
  emailFeatures: {
    // Drafts
    createDraft: (data: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      body: string;
      html?: string;
      threadId?: string;
      replyToId?: string;
    }) =>
      apiRequest<{
        id: string;
        to: string;
        cc?: string;
        bcc?: string;
        subject: string;
        body: string;
        html?: string;
        createdAt: string;
        updatedAt: string;
      }>("/api/email-features/drafts", {
        method: "POST",
        body: data,
      }),
    getDrafts: () =>
      apiRequest<{
        drafts: Array<{
          id: string;
          to: string;
          cc?: string;
          bcc?: string;
          subject: string;
          body: string;
          html?: string;
          createdAt: string;
          updatedAt: string;
        }>;
      }>("/api/email-features/drafts"),
    getDraft: (draftId: string) =>
      apiRequest<{
        id: string;
        to: string;
        cc?: string;
        bcc?: string;
        subject: string;
        body: string;
        html?: string;
        createdAt: string;
        updatedAt: string;
      }>(`/api/email-features/drafts/${draftId}`),
    updateDraft: (draftId: string, data: Partial<{
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      body: string;
      html?: string;
    }>) =>
      apiRequest<{
        id: string;
        to: string;
        cc?: string;
        bcc?: string;
        subject: string;
        body: string;
        html?: string;
        updatedAt: string;
      }>(`/api/email-features/drafts/${draftId}`, {
        method: "PUT",
        body: data,
      }),
    deleteDraft: (draftId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-features/drafts/${draftId}`, {
        method: "DELETE",
      }),

    // Scheduled Emails
    scheduleEmail: (data: {
      to: string;
      cc?: string;
      bcc?: string;
      subject: string;
      body: string;
      html?: string;
      scheduledAt: string;
      timezone?: string;
    }) =>
      apiRequest<{
        id: string;
        to: string;
        subject: string;
        scheduledAt: string;
        status: string;
      }>("/api/email-features/scheduled", {
        method: "POST",
        body: data,
      }),
    getScheduled: () =>
      apiRequest<{
        scheduled: Array<{
          id: string;
          to: string;
          subject: string;
          scheduledAt: string;
          status: string;
        }>;
      }>("/api/email-features/scheduled"),
    cancelScheduled: (scheduledId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-features/scheduled/${scheduledId}`, {
        method: "DELETE",
      }),

    // Templates
    createTemplate: (data: {
      name: string;
      category?: string;
      subject: string;
      body: string;
      html?: string;
      variables?: Record<string, any>;
      isPublic?: boolean;
    }) =>
      apiRequest<{
        id: string;
        name: string;
        subject: string;
        body: string;
        category?: string;
      }>("/api/email-features/templates", {
        method: "POST",
        body: data,
      }),
    getTemplates: (category?: string) => {
      const params = category ? `?category=${encodeURIComponent(category)}` : "";
      return apiRequest<{
        templates: Array<{
          id: string;
          name: string;
          category?: string;
          subject: string;
          body: string;
          html?: string;
        }>;
      }>(`/api/email-features/templates${params}`);
    },
    getTemplate: (templateId: string) =>
      apiRequest<{
        id: string;
        name: string;
        category?: string;
        subject: string;
        body: string;
        html?: string;
      }>(`/api/email-features/templates/${templateId}`),
    updateTemplate: (templateId: string, data: Partial<{
      name: string;
      category?: string;
      subject: string;
      body: string;
      html?: string;
    }>) =>
      apiRequest<{
        id: string;
        name: string;
        subject: string;
        body: string;
      }>(`/api/email-features/templates/${templateId}`, {
        method: "PUT",
        body: data,
      }),
    deleteTemplate: (templateId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-features/templates/${templateId}`, {
        method: "DELETE",
      }),

    // Snooze
    snoozeEmail: (data: {
      messageId: string;
      threadId?: string;
      snoozeUntil: string;
      labelIds?: string[];
    }) =>
      apiRequest<{
        id: string;
        messageId: string;
        snoozeUntil: string;
      }>("/api/email-features/snooze", {
        method: "POST",
        body: data,
      }),
    getSnoozed: () =>
      apiRequest<{
        snoozes: Array<{
          id: string;
          messageId: string;
          snoozeUntil: string;
        }>;
      }>("/api/email-features/snooze"),
    unsnoozeEmail: (messageId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-features/snooze/${messageId}`, {
        method: "DELETE",
      }),

    // Filters
    createFilter: (data: {
      name: string;
      criteria: {
        from?: string;
        to?: string;
        subject?: string;
        hasAttachment?: boolean;
        label?: string;
        isUnread?: boolean;
        isStarred?: boolean;
      };
      actions: {
        addLabels?: string[];
        removeLabels?: string[];
        archive?: boolean;
        markAsRead?: boolean;
        markAsUnread?: boolean;
        star?: boolean;
        forwardTo?: string;
      };
      isActive?: boolean;
    }) =>
      apiRequest<{
        id: string;
        name: string;
        criteria: any;
        actions: any;
        isActive: boolean;
        matchCount: number;
        lastMatched: string | null;
      }>("/api/email-features/filters", {
        method: "POST",
        body: data,
      }),
    getFilters: () =>
      apiRequest<{
        filters: Array<{
          id: string;
          name: string;
          criteria: any;
          actions: any;
          isActive: boolean;
          matchCount: number;
          lastMatched: string | null;
        }>;
      }>("/api/email-features/filters"),
    getFilter: (filterId: string) =>
      apiRequest<{
        id: string;
        name: string;
        criteria: any;
        actions: any;
        isActive: boolean;
        matchCount: number;
        lastMatched: string | null;
      }>(`/api/email-features/filters/${filterId}`),
    updateFilter: (filterId: string, data: Partial<{
      name: string;
      criteria: any;
      actions: any;
      isActive: boolean;
    }>) =>
      apiRequest<{
        id: string;
        name: string;
        criteria: any;
        actions: any;
        isActive: boolean;
      }>(`/api/email-features/filters/${filterId}`, {
        method: "PUT",
        body: data,
      }),
    deleteFilter: (filterId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-features/filters/${filterId}`, {
        method: "DELETE",
      }),
    executeFilter: (messageId: string) =>
      apiRequest<{
        matchedFilters: number;
        applied: boolean;
      }>(`/api/email-features/filters/execute/${messageId}`, {
        method: "POST",
      }),
  },

  // Bookings
  booking: {
    getBookingPageData: (token: string) =>
      apiRequest<{
        meeting: {
          name: string;
          description: string | null;
          durationMinutes: number;
          locationType: string;
          locationValue: string | null;
          timeZone: string;
        };
        host: {
          name: string;
          email: string;
        };
        availability: Array<{
          date: string;
          slots: Array<{
            start: string;
            end: string;
            status: "available" | "busy";
          }>;
        }>;
        recommendations: Array<{
          start: string;
          end: string;
          score?: number;
        }>;
        metadata?: {
          needsSync?: boolean;
          message?: string;
        };
      }>(`/api/book/${token}/data`),
    createBooking: (token: string, data: {
      email: string;
      name?: string;
      notes?: string;
      start: string;
      end: string;
    }) =>
      apiRequest<{
        booking: {
          id: string;
          startTime: string;
          endTime: string;
          status: string;
          conferenceUrl: string | null;
        };
      }>(`/api/book/${token}/bookings`, {
        method: "POST",
        body: data,
      }),
  },
  bookings: {
    list: (filters?: {
      status?: "PENDING" | "CONFIRMED" | "CANCELLED";
      meetingTypeId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.append("status", filters.status);
      if (filters?.meetingTypeId) params.append("meetingTypeId", filters.meetingTypeId);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);
      if (filters?.limit) params.append("limit", filters.limit.toString());
      if (filters?.offset) params.append("offset", filters.offset.toString());
      return apiRequest<{
        bookings: Array<{
          id: string;
          meetingType: {
            id: string;
            name: string;
            durationMinutes: number;
            meetingLocationType: string;
          };
          startTime: string;
          endTime: string;
          status: "PENDING" | "CONFIRMED" | "CANCELLED";
          inviteeEmail: string;
          inviteeName: string | null;
          conferenceUrl: string | null;
          calendarEventId: string | null;
          createdAt: string;
        }>;
        total: number;
        limit: number;
        offset: number;
      }>(`/api/bookings${params.toString() ? `?${params.toString()}` : ""}`);
    },
    get: (id: string) =>
      apiRequest<{
        booking: {
          id: string;
          meetingType: any;
          startTime: string;
          endTime: string;
          status: string;
          inviteeEmail: string;
          inviteeName: string | null;
          conferenceUrl: string | null;
          calendarEventId: string | null;
          metadata: any;
          createdAt: string;
          updatedAt: string;
        };
      }>(`/api/bookings/${id}`),
    cancel: (id: string, reason?: string) =>
      apiRequest<{ booking: { id: string; status: string } }>(`/api/bookings/${id}/cancel`, {
        method: "POST",
        body: { reason },
      }),
  },

  // Sheets
  sheets: {
    import: (url: string) =>
      apiRequest<{
        sheetSource: {
          id: string;
          title: string;
          spreadsheetId: string;
          worksheetId: string;
          columns: string[];
        };
        headers: string[];
        records: Record<string, string>[];
        importedAt: string;
      }>("/api/sheets/import", {
        method: "POST",
        body: { sheetUrl: url },
      }),
  },

  // Follow-ups
  followUps: {
    list: (campaignId: string) =>
      apiRequest<{
        sequences: Array<{
          id: string;
          name: string;
          steps: Array<{
            id: string;
            order: number;
            templateSubject: string;
            templateHtml: string;
            offsetConfig: { delayMs: number };
          }>;
        }>;
      }>(`/api/follow-ups/${campaignId}`),
    create: (campaignId: string, data: {
      name: string;
      steps: Array<{
        delayMs?: number;
        scheduledAt?: string;
        subject: string;
        html: string;
        sendAsReply?: boolean;
        parentStepId?: string;
        isNested?: boolean;
      }>;
    }) =>
      apiRequest<{
        sequence: {
          id: string;
          name: string;
          steps: Array<{
            id: string;
            order: number;
            templateSubject: string;
            templateHtml: string;
          }>;
        };
      }>("/api/follow-ups", {
        method: "POST",
        body: { campaignId, ...data },
      }),
    // Follow-up Automations (Gmail-based)
    listAutomations: () =>
      apiRequest<{
        automations: Array<{
          id: string;
          userId: string;
          target: { type: "label" | "query" | "folder"; labelIds?: string[]; query?: string; folderId?: string };
          timezone: string;
          rules: Array<{
            id: string;
            name: string;
            schedule: {
              mode: "relative" | "absolute" | "weekly";
              sendAfterDays?: number;
              sendAfterHours?: number;
              sendAt?: string;
              daysOfWeek?: string[];
              sendTime?: string;
              timezone: string;
            };
            conditions: Array<{
              id: string;
              field: "noReplySince" | "hasLabel" | "threadStatus" | "manualTag";
              operator: "gt" | "lt" | "includes" | "excludes" | "equals";
              value: string;
              unit?: "hours" | "days";
            }>;
            actions: Array<{
              id: string;
              type: "sendEmail" | "applyLabel" | "stopSequence";
              subject?: string;
              bodyHtml?: string;
              labelId?: string;
            }>;
            stopConditions?: {
              onReply: boolean;
              onOpen: boolean;
              onClick: boolean;
            };
            maxFollowUps?: number | null;
            isActive: boolean;
          }>;
          createdAt: string;
          updatedAt: string;
          nextRunAt: string | null;
          lastRunAt: string | null;
        }>;
      }>("/api/follow-ups/automations"),
    createAutomation: (data: {
      target: { type: "label" | "query" | "folder"; labelIds?: string[]; query?: string; folderId?: string };
      timezone: string;
      rules: Array<{
        name: string;
        schedule: {
          mode: "relative" | "absolute" | "weekly";
          sendAfterDays?: number;
          sendAfterHours?: number;
          sendAt?: string;
          daysOfWeek?: string[];
          sendTime?: string;
          timezone: string;
        };
        conditions: Array<{
          field: "noReplySince" | "hasLabel" | "threadStatus" | "manualTag";
          operator: "gt" | "lt" | "includes" | "excludes" | "equals";
          value: string;
          unit?: "hours" | "days";
        }>;
        actions: Array<{
          type: "sendEmail" | "applyLabel" | "stopSequence";
          subject?: string;
          bodyHtml?: string;
          labelId?: string;
        }>;
        stopConditions?: {
          onReply: boolean;
          onOpen: boolean;
          onClick: boolean;
        };
        maxFollowUps?: number | null;
        isActive: boolean;
      }>;
    }) =>
      apiRequest<{
        automation: {
          id: string;
          userId: string;
          target: { type: "label" | "query" | "folder"; labelIds?: string[]; query?: string; folderId?: string };
          timezone: string;
          rules: Array<{
            id: string;
            name: string;
            schedule: any;
            conditions: Array<any>;
            actions: Array<any>;
            stopConditions?: any;
            maxFollowUps?: number | null;
            isActive: boolean;
          }>;
          createdAt: string;
          updatedAt: string;
        };
      }>("/api/follow-ups/automations", {
        method: "POST",
        body: data,
      }),
  },

  // AI (Ollama)
  ai: {
    summarizeEmail: async (emailContent: string) => {
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "mistral:instruct",
            prompt: `Summarize this email in 2-3 bullet points:\n\n${emailContent}`,
            stream: false,
          }),
        });
        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.response;
      } catch (error) {
        // Check if Ollama is not running
        if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
          throw new Error("Ollama is not running. Please start Ollama on port 11434.");
        }
        throw error;
      }
    },
    suggestReply: async (emailContent: string, context?: string) => {
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "mistral:instruct",
            prompt: `Suggest a professional reply to this email:\n\n${emailContent}${context ? `\n\nContext: ${context}` : ""}\n\nReply:`,
            stream: false,
          }),
        });
        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.response;
      } catch (error) {
        if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
          throw new Error("Ollama is not running. Please start Ollama on port 11434.");
        }
        throw error;
      }
    },
    analyzeCampaign: async (campaignData: { sent: number; opened: number; clicked: number }) => {
      const ollamaUrl = process.env.NEXT_PUBLIC_OLLAMA_URL || "http://localhost:11434";
      try {
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "mistral:instruct",
            prompt: `Analyze this email campaign performance:\n- Sent: ${campaignData.sent}\n- Opened: ${campaignData.opened}\n- Clicked: ${campaignData.clicked}\n\nProvide 2-3 actionable insights:`,
            stream: false,
          }),
        });
        if (!response.ok) {
          throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data.response;
      } catch (error) {
        if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
          throw new Error("Ollama is not running. Please start Ollama on port 11434.");
        }
        throw error;
      }
    },
  },

  // Teams
  teams: {
    create: (data: { name: string; description?: string }) =>
      apiRequest<{
        team: {
          id: string;
          name: string;
          description: string | null;
          ownerId: string;
          owner: {
            id: string;
            email: string;
            displayName: string | null;
            pictureUrl: string | null;
          };
          members: Array<{
            id: string;
            role: string;
            user: {
              id: string;
              email: string;
              displayName: string | null;
              pictureUrl: string | null;
            };
          }>;
        };
      }>("/api/teams", {
        method: "POST",
        body: data,
      }),
    list: () =>
      apiRequest<{
        teams: Array<{
          id: string;
          name: string;
          description: string | null;
          owner: {
            id: string;
            email: string;
            displayName: string | null;
          };
          members: Array<{
            id: string;
            role: string;
            user: {
              id: string;
              email: string;
              displayName: string | null;
            };
          }>;
          sharedInboxes: Array<{
            id: string;
            name: string;
          }>;
          _count: {
            emailAssignments: number;
          };
        }>;
      }>("/api/teams"),
    get: (teamId: string) =>
      apiRequest<{
        team: {
          id: string;
          name: string;
          description: string | null;
          owner: {
            id: string;
            email: string;
            displayName: string | null;
          };
          members: Array<{
            id: string;
            role: string;
            user: {
              id: string;
              email: string;
              displayName: string | null;
            };
          }>;
          sharedInboxes: Array<{
            id: string;
            name: string;
          }>;
        };
      }>(`/api/teams/${teamId}`),
    update: (teamId: string, data: { name?: string; description?: string }) =>
      apiRequest<{
        team: {
          id: string;
          name: string;
          description: string | null;
        };
      }>(`/api/teams/${teamId}`, {
        method: "PUT",
        body: data,
      }),
    delete: (teamId: string) =>
      apiRequest<{ success: boolean }>(`/api/teams/${teamId}`, {
        method: "DELETE",
      }),
    addMember: (teamId: string, data: { userId: string; role?: "OWNER" | "ADMIN" | "MEMBER" }) =>
      apiRequest<{
        member: {
          id: string;
          role: string;
          user: {
            id: string;
            email: string;
            displayName: string | null;
          };
        };
      }>(`/api/teams/${teamId}/members`, {
        method: "POST",
        body: data,
      }),
    removeMember: (teamId: string, userId: string) =>
      apiRequest<{ success: boolean }>(`/api/teams/${teamId}/members/${userId}`, {
        method: "DELETE",
      }),
    updateMemberRole: (teamId: string, userId: string, role: "OWNER" | "ADMIN" | "MEMBER") =>
      apiRequest<{
        member: {
          id: string;
          role: string;
        };
      }>(`/api/teams/${teamId}/members/${userId}`, {
        method: "PUT",
        body: { role },
      }),
    createSharedInbox: (teamId: string, data: { name: string; description?: string; emailAddress?: string }) =>
      apiRequest<{
        sharedInbox: {
          id: string;
          name: string;
          description: string | null;
          emailAddress: string | null;
        };
      }>(`/api/teams/${teamId}/shared-inboxes`, {
        method: "POST",
        body: data,
      }),
    getSharedInboxes: (teamId: string) =>
      apiRequest<{
        sharedInboxes: Array<{
          id: string;
          name: string;
          description: string | null;
          emailAddress: string | null;
          _count: {
            emailAssignments: number;
          };
        }>;
      }>(`/api/teams/${teamId}/shared-inboxes`),
  },

  // Email Assignments
  emailAssignments: {
    create: (data: {
      teamId: string;
      sharedInboxId?: string;
      messageId: string;
      threadId?: string;
      assignedToId?: string;
      priority?: number;
      notes?: string;
    }) =>
      apiRequest<{
        assignment: {
          id: string;
          messageId: string;
          threadId: string | null;
          status: string;
          priority: number;
          assignedTo: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          assignedBy: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          team: {
            id: string;
            name: string;
          };
          sharedInbox: {
            id: string;
            name: string;
          } | null;
        };
      }>("/api/email-assignments", {
        method: "POST",
        body: data,
      }),
    list: (filters?: {
      teamId?: string;
      assignedToId?: string;
      status?: "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      sharedInboxId?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.teamId) params.append("teamId", filters.teamId);
      if (filters?.assignedToId) params.append("assignedToId", filters.assignedToId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.sharedInboxId) params.append("sharedInboxId", filters.sharedInboxId);
      return apiRequest<{
        assignments: Array<{
          id: string;
          messageId: string;
          threadId: string | null;
          status: string;
          priority: number;
          notes: string | null;
          assignedTo: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          assignedBy: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          team: {
            id: string;
            name: string;
          };
          sharedInbox: {
            id: string;
            name: string;
          } | null;
          createdAt: string;
          assignedAt: string | null;
          resolvedAt: string | null;
        }>;
      }>(`/api/email-assignments${params.toString() ? `?${params.toString()}` : ""}`);
    },
    get: (assignmentId: string) =>
      apiRequest<{
        assignment: {
          id: string;
          messageId: string;
          threadId: string | null;
          status: string;
          priority: number;
          notes: string | null;
          assignedTo: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          assignedBy: {
            id: string;
            email: string;
            displayName: string | null;
          } | null;
          team: {
            id: string;
            name: string;
          };
          sharedInbox: {
            id: string;
            name: string;
          } | null;
        };
      }>(`/api/email-assignments/${assignmentId}`),
    update: (assignmentId: string, data: {
      assignedToId?: string;
      status?: "UNASSIGNED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
      priority?: number;
      notes?: string;
    }) =>
      apiRequest<{
        assignment: {
          id: string;
          status: string;
          priority: number;
          notes: string | null;
        };
      }>(`/api/email-assignments/${assignmentId}`, {
        method: "PUT",
        body: data,
      }),
    delete: (assignmentId: string) =>
      apiRequest<{ success: boolean }>(`/api/email-assignments/${assignmentId}`, {
        method: "DELETE",
      }),
  },
  // Customer View
  customerView: {
    get: (email: string) =>
      apiRequest<{
        email: string;
        name?: string;
        totalEmailsSent: number;
        totalEmailsReceived: number;
        totalMeetings: number;
        totalCampaigns: number;
        lastContacted?: string;
        lastMeeting?: string;
        engagementScore: number;
        activities: Array<{
          type: string;
          timestamp: string;
          title: string;
          description: string;
          metadata?: Record<string, unknown>;
        }>;
      }>(`/api/customer-view/${encodeURIComponent(email)}`),
    search: (query: string, limit?: number) => {
      const params = new URLSearchParams();
      params.append("q", query);
      if (limit) params.append("limit", limit.toString());
      return apiRequest<{
        contacts: Array<{
          email: string;
          name?: string;
        }>;
      }>(`/api/customer-view/search?${params.toString()}`);
    },
  },
  // Tracking Analytics
  tracking: {
    getAnalytics: (options?: { campaignId?: string; messageLogId?: string }) => {
      const params = new URLSearchParams();
      if (options?.campaignId) params.append("campaignId", options.campaignId);
      if (options?.messageLogId) params.append("messageLogId", options.messageLogId);
      return apiRequest<{
        messageLog?: {
          id: string;
          subject: string;
          to: string;
          opens: number;
          clicks: number;
          engagementScore: number;
          firstOpenedAt?: string;
          lastOpenedAt?: string;
          firstClickedAt?: string;
          lastClickedAt?: string;
          clickRate: string;
        };
        campaign?: {
          id: string;
          name: string;
        };
        metrics?: {
          totalSent: number;
          totalOpens: number;
          totalClicks: number;
          uniqueOpens: number;
          openRate: string;
          clickRate: string;
          clickToOpenRate: string;
        };
        messages?: Array<{
          id: string;
          to: string;
          subject: string;
          opens: number;
          clicks: number;
          engagementScore: number;
          sentAt?: string;
        }>;
        events?: Array<{
          type: string;
          createdAt: string;
          meta?: Record<string, unknown>;
        }>;
      }>(`/api/tracking/analytics${params.toString() ? `?${params.toString()}` : ""}`);
    },
  },
  // Workflows
  workflows: {
    list: () =>
      apiRequest<{
        workflows: Array<{
          id: string;
          name: string;
          description: string | null;
          trigger: {
            type: string;
            config: Record<string, unknown>;
          };
          isActive: boolean;
          runCount: number;
          lastRunAt: string | null;
          executionCount: number;
          createdAt: string;
          updatedAt: string;
        }>;
      }>("/api/workflows"),
    get: (workflowId: string) =>
      apiRequest<{
        workflow: {
          id: string;
          name: string;
          description: string | null;
          trigger: {
            type: string;
            config: Record<string, unknown>;
          };
          nodes: Array<{
            id: string;
            type: string;
            label: string;
            config: Record<string, unknown>;
            position?: { x: number; y: number };
          }>;
          edges: Array<{
            id: string;
            source: string;
            target: string;
            condition?: string;
          }>;
          isActive: boolean;
          runCount: number;
          lastRunAt: string | null;
          createdAt: string;
          updatedAt: string;
        };
      }>(`/api/workflows/${workflowId}`),
    create: (data: {
      name: string;
      description?: string;
      trigger: {
        type: string;
        config: Record<string, unknown>;
      };
      nodes: Array<{
        id: string;
        type: string;
        label: string;
        config: Record<string, unknown>;
        position?: { x: number; y: number };
      }>;
      edges: Array<{
        id: string;
        source: string;
        target: string;
        condition?: string;
      }>;
      isActive?: boolean;
    }) =>
      apiRequest<{
        workflow: {
          id: string;
          name: string;
          description: string | null;
          trigger: {
            type: string;
            config: Record<string, unknown>;
          };
          nodes: Array<unknown>;
          edges: Array<unknown>;
          isActive: boolean;
          createdAt: string;
          updatedAt: string;
        };
      }>("/api/workflows", {
        method: "POST",
        body: data,
      }),
    update: (workflowId: string, data: {
      name?: string;
      description?: string;
      trigger?: {
        type: string;
        config: Record<string, unknown>;
      };
      nodes?: Array<unknown>;
      edges?: Array<unknown>;
      isActive?: boolean;
    }) =>
      apiRequest<{
        workflow: {
          id: string;
          name: string;
          description: string | null;
          trigger: {
            type: string;
            config: Record<string, unknown>;
          };
          nodes: Array<unknown>;
          edges: Array<unknown>;
          isActive: boolean;
          updatedAt: string;
        };
      }>(`/api/workflows/${workflowId}`, {
        method: "PUT",
        body: data,
      }),
    delete: (workflowId: string) =>
      apiRequest<{ success: boolean }>(`/api/workflows/${workflowId}`, {
        method: "DELETE",
      }),
    execute: (workflowId: string, triggerData?: Record<string, unknown>) =>
      apiRequest<{
        success: boolean;
        executionId?: string;
      }>(`/api/workflows/${workflowId}/execute`, {
        method: "POST",
        body: { triggerData },
      }),
    getExecutions: (workflowId: string) =>
      apiRequest<{
        executions: Array<{
          id: string;
          status: string;
          currentNodeId: string | null;
          error: string | null;
          startedAt: string;
          completedAt: string | null;
          createdAt: string;
        }>;
      }>(`/api/workflows/${workflowId}/executions`),
  },
};

