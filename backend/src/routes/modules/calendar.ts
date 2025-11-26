import type { CalendarConnection } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { Router } from "express";
import { z } from "zod";
import { google } from "googleapis";

import { requireUser } from "../../middleware/requireUser";
import { prisma } from "../../lib/prisma";
import { cache, cacheKeys, CACHE_TTL } from "../../lib/cache";
import { calendarAvailabilityService } from "../../services/calendarAvailability";
import { googleCalendarService } from "../../services/googleCalendar";
import { googleAuthService } from "../../services/googleAuth";
import { holidaysService } from "../../services/holidays";
import {
  meetingTypesService,
  loadMeetingTypeBookingStats,
  createEmptyMeetingTypeStats,
} from "../../services/meetingTypes";

export const calendarRouter = Router();

const ensureStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const mapCalendarConnection = (connection: CalendarConnection) => {
  const metadata = (connection.metadata as Record<string, unknown> | null) ?? null;
  const syncPreferences = (metadata?.syncPreferences as { cadenceMinutes?: unknown } | undefined) ?? {};
  const syncCadenceMinutes =
    typeof syncPreferences.cadenceMinutes === "number" ? syncPreferences.cadenceMinutes : null;
  const selectedCalendars = ensureStringArray(metadata?.calendars);
  const lastSyncedAt = typeof metadata?.lastSyncedAt === "string" ? (metadata.lastSyncedAt as string) : null;

  return {
    id: connection.id,
    provider: connection.provider,
    accountEmail: connection.accountEmail,
    externalAccountId: connection.externalAccountId,
    defaultCalendarId: connection.defaultCalendarId,
    timeZone: connection.timeZone,
    connectedAt: connection.createdAt,
    lastSyncedAt,
    syncCadenceMinutes,
    selectedCalendars,
    metadata: connection.metadata,
  };
};

calendarRouter.get("/connections", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cacheKey = cacheKeys.calendarConnection(req.currentUser.id);

    // Try cache first (fail silently if cache unavailable)
    let cached: { connections: ReturnType<typeof mapCalendarConnection>[] } | null = null;
    try {
      cached = await cache.get<{ connections: ReturnType<typeof mapCalendarConnection>[] }>(cacheKey);
    } catch (error) {
      // Cache error is non-critical, continue without cache
    }

    if (cached) {
      return res.status(200).json(cached);
    }

    const connections = await prisma.calendarConnection.findMany({
      where: {
        userId: req.currentUser.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const result = {
      connections: connections.map((connection) => mapCalendarConnection(connection)),
    };

    // Cache the result (fail silently if cache unavailable)
    try {
      await cache.set(cacheKey, result, CACHE_TTL.CALENDAR_CONNECTION);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

const connectionPreferencesSchema = z.object({
  syncCadenceMinutes: z
    .number()
    .int()
    .min(15)
    .max(7 * 24 * 60)
    .nullable()
    .optional(),
  calendars: z.array(z.string().min(1)).optional(),
});

calendarRouter.get("/connections/:connectionId/calendars", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const calendars = await googleCalendarService.listCalendars({
      userId: req.currentUser.id,
      calendarConnectionId: req.params.connectionId,
    });

    res.status(200).json({ calendars });
  } catch (error) {
    next(error);
  }
});

calendarRouter.put("/connections/:connectionId/preferences", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = connectionPreferencesSchema.parse(req.body ?? {});

    const connection = await prisma.calendarConnection.findFirst({
      where: {
        id: req.params.connectionId,
        userId: req.currentUser.id,
      },
    });

    if (!connection) {
      res.status(404).json({ error: "Calendar connection not found" });
      return;
    }

    const metadata = (connection.metadata as Record<string, unknown> | null) ?? {};
    const nextMetadata: Record<string, unknown> = { ...metadata };

    if (payload.calendars) {
      nextMetadata.calendars = payload.calendars;
    }

    if (payload.syncCadenceMinutes !== undefined) {
      if (payload.syncCadenceMinutes === null) {
        if (typeof nextMetadata.syncPreferences === "object" && nextMetadata.syncPreferences !== null) {
          const syncPrefs = { ...(nextMetadata.syncPreferences as Record<string, unknown>) };
          delete syncPrefs.cadenceMinutes;
          if (Object.keys(syncPrefs).length === 0) {
            delete nextMetadata.syncPreferences;
          } else {
            nextMetadata.syncPreferences = syncPrefs;
          }
        }
      } else {
        const syncPrefs =
          typeof nextMetadata.syncPreferences === "object" && nextMetadata.syncPreferences !== null
            ? { ...(nextMetadata.syncPreferences as Record<string, unknown>) }
            : {};
        syncPrefs.cadenceMinutes = payload.syncCadenceMinutes;
        nextMetadata.syncPreferences = syncPrefs;
      }
    }

    const updated = await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        metadata: nextMetadata as Prisma.InputJsonValue,
      },
    });

    res.status(200).json({
      connection: mapCalendarConnection(updated),
    });
  } catch (error) {
    next(error);
  }
});

const availabilitySchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  meetingTypeId: z.string().optional(),
});

calendarRouter.get("/availability", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { start, end, meetingTypeId } = availabilitySchema.parse(req.query);

    const availability = await calendarAvailabilityService.getAvailability({
      userId: req.currentUser.id,
      start,
      end,
      meetingTypeId,
    });

    res.status(200).json(availability);
  } catch (error) {
    next(error);
  }
});

calendarRouter.get("/meeting-types", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cacheKey = cacheKeys.meetingTypes(req.currentUser.id);

    // Try cache first (fail silently if cache unavailable)
    let cached: { meetingTypes: Array<{
      id: string;
      name: string;
      slug: string;
      description: string | null;
      durationMinutes: number;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
      maxBookingsPerDay: number | null;
      meetingLocationType: string;
      meetingLocationValue: string | null;
      isActive: boolean;
      calendarConnectionId: string | null;
      availabilityRules: unknown;
      formSchema: unknown;
      updatedAt: Date;
      bookingLinks: Array<{
        id: string;
        name: string | null;
        token: string;
        isPublic: boolean;
        createdAt: Date;
      }>;
      bookingStats: {
        total: number;
        confirmed: number;
        pending: number;
        cancelled: number;
      };
    }> } | null = null;

    try {
      cached = await cache.get<{ meetingTypes: Array<{
        id: string;
        name: string;
        slug: string;
        description: string | null;
        durationMinutes: number;
        bufferBeforeMinutes: number;
        bufferAfterMinutes: number;
        maxBookingsPerDay: number | null;
        meetingLocationType: string;
        meetingLocationValue: string | null;
        isActive: boolean;
        calendarConnectionId: string | null;
        availabilityRules: unknown;
        formSchema: unknown;
        updatedAt: Date;
        bookingLinks: Array<{
          id: string;
          name: string | null;
          token: string;
          isPublic: boolean;
          createdAt: Date;
        }>;
        bookingStats: {
          total: number;
          confirmed: number;
          pending: number;
          cancelled: number;
        };
      }> }>(cacheKey);
    } catch (error) {
      // Cache error is non-critical, continue without cache
    }

    if (cached) {
      return res.status(200).json(cached);
    }

    const meetingTypes = await prisma.meetingType.findMany({
      where: {
        userId: req.currentUser.id,
      },
      include: {
        bookingLinks: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const statsMap = await loadMeetingTypeBookingStats(
      meetingTypes.map((meetingType) => meetingType.id),
    );

    const result = {
      meetingTypes: meetingTypes.map((meetingType) => ({
        id: meetingType.id,
        name: meetingType.name,
        slug: meetingType.slug,
        description: meetingType.description,
        durationMinutes: meetingType.durationMinutes,
        bufferBeforeMinutes: meetingType.bufferBeforeMinutes,
        bufferAfterMinutes: meetingType.bufferAfterMinutes,
        maxBookingsPerDay: meetingType.maxBookingsPerDay,
        meetingLocationType: meetingType.meetingLocationType,
        meetingLocationValue: meetingType.meetingLocationValue,
        isActive: meetingType.isActive,
        calendarConnectionId: meetingType.calendarConnectionId,
        availabilityRules: meetingType.availabilityRules,
        formSchema: meetingType.formSchema,
        updatedAt: meetingType.updatedAt,
        bookingLinks: meetingType.bookingLinks.map((link) => ({
          id: link.id,
          name: link.name,
          token: link.token,
          isPublic: link.isPublic,
          createdAt: link.createdAt,
        })),
        bookingStats: statsMap.get(meetingType.id) ?? createEmptyMeetingTypeStats(),
      })),
    };

    // Cache the result (fail silently if cache unavailable)
    try {
      await cache.set(cacheKey, result, CACHE_TTL.MEETING_TYPES);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

const syncSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
  calendars: z.array(z.string()).optional(),
});

calendarRouter.post("/:connectionId/sync", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { connectionId } = req.params;
    const { start, end, calendars } = syncSchema.parse(req.body ?? {});

    const result = await googleCalendarService.syncBusyBlocks({
      userId: req.currentUser.id,
      calendarConnectionId: connectionId,
      start,
      end,
      calendars,
    });

    res.status(202).json({
      status: "queued",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

const meetingLocationEnum = z.enum(["GOOGLE_MEET", "PHONE", "IN_PERSON", "CUSTOM_URL"]);

const meetingTypeCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, or dashes.")
    .optional(),
  calendarConnectionId: z.string().nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480),
  bufferBeforeMinutes: z.number().int().min(0).max(360).optional(),
  bufferAfterMinutes: z.number().int().min(0).max(360).optional(),
  maxBookingsPerDay: z.number().int().min(1).max(50).optional(),
  availabilityRules: z.unknown().optional(),
  formSchema: z.unknown().optional(),
  meetingLocationType: meetingLocationEnum,
  meetingLocationValue: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  createDefaultBookingLink: z.boolean().optional(),
  bookingLinkName: z.string().optional(),
});

const meetingTypeUpdateSchema = meetingTypeCreateSchema
  .partial()
  .extend({
    createBookingLink: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Update payload cannot be empty",
  });

calendarRouter.post("/meeting-types", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = meetingTypeCreateSchema.parse(req.body ?? {});

    const meetingType = await meetingTypesService.createMeetingType({
      userId: req.currentUser.id,
      ...payload,
    });

    // Invalidate meeting types cache (fail silently if cache unavailable)
    try {
      await cache.delete(cacheKeys.meetingTypes(req.currentUser.id));
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(201).json({
      meetingType,
    });
  } catch (error) {
    next(error);
  }
});

calendarRouter.put("/meeting-types/:meetingTypeId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = meetingTypeUpdateSchema.parse(req.body ?? {});

    const meetingType = await meetingTypesService.updateMeetingType({
      userId: req.currentUser.id,
      meetingTypeId: req.params.meetingTypeId,
      ...payload,
    });

    // Invalidate meeting types cache (fail silently if cache unavailable)
    try {
      await cache.delete(cacheKeys.meetingTypes(req.currentUser.id));
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json({
      meetingType,
    });
  } catch (error) {
    next(error);
  }
});

// Get calendar events
calendarRouter.get("/events", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const start = typeof req.query.start === "string" ? req.query.start : new Date().toISOString();
    const end = typeof req.query.end === "string" ? req.query.end : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const calendarId = typeof req.query.calendarId === "string" ? req.query.calendarId : "primary";

    const cacheKey = cacheKeys.calendarEvents(req.currentUser.id, start, end);

    // Try cache first (fail silently if cache unavailable)
    let cached: { events: Array<{
      id: string;
      summary: string;
      description: string;
      start: string;
      end: string;
      location: string;
      attendees: Array<{ email: string; displayName: string; responseStatus: string }>;
      conferenceData: { entryPoints: Array<{ uri: string; label: string }> } | null;
      htmlLink: string;
      status: string;
      calendarId?: string;
      isHoliday?: boolean;
      holidayType?: string;
    }> } | null = null;

    try {
      cached = await cache.get<{ events: Array<{
        id: string;
        summary: string;
        description: string;
        start: string;
        end: string;
        location: string;
        attendees: Array<{ email: string; displayName: string; responseStatus: string }>;
        conferenceData: { entryPoints: Array<{ uri: string; label: string }> } | null;
        htmlLink: string;
        status: string;
        calendarId?: string;
        isHoliday?: boolean;
        holidayType?: string;
      }> }>(cacheKey);
    } catch (error) {
      // Cache error is non-critical, continue without cache
    }

    if (cached) {
      return res.status(200).json(cached);
    }

    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    if (!connection) {
      res.status(404).json({ error: "No calendar connection found" });
      return;
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    const { data } = await calendar.events.list({
      calendarId,
      timeMin: start,
      timeMax: end,
      maxResults: 2500,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (data.items ?? []).map((event) => ({
      id: event.id ?? "",
      summary: event.summary || "(No Title)",
      description: event.description || "",
      start: event.start?.dateTime || event.start?.date || "",
      end: event.end?.dateTime || event.end?.date || "",
      location: event.location || "",
      attendees: (event.attendees ?? []).map((a) => ({
        email: a.email || "",
        displayName: a.displayName || "",
        responseStatus: a.responseStatus || "needsAction",
      })),
      conferenceData: event.conferenceData
        ? {
            entryPoints: event.conferenceData.entryPoints?.map((ep) => ({
              uri: ep.uri || "",
              label: ep.label || "",
            })) || [],
          }
        : null,
      htmlLink: event.htmlLink || "",
      status: event.status || "confirmed",
      calendarId: calendarId,
    }));

    // Add holidays
    const region = typeof req.query.region === "string" ? req.query.region : undefined;
    const holidays = holidaysService.getHolidays(new Date(start), new Date(end), region);
    const holidayEvents = holidays.map((holiday) => ({
      id: `holiday-${holiday.date.toISOString()}-${holiday.name}`,
      summary: holiday.name,
      description: `${holiday.type} holiday${holiday.region ? ` (${holiday.region})` : ""}`,
      start: holiday.date.toISOString().split("T")[0],
      end: holiday.date.toISOString().split("T")[0],
      location: "",
      attendees: [],
      conferenceData: null,
      htmlLink: "",
      status: "confirmed",
      calendarId: "holidays",
      isHoliday: true,
      holidayType: holiday.type,
    }));

    const result = { events: [...events, ...holidayEvents] };

    // Cache the result (fail silently if cache unavailable)
    try {
      await cache.set(cacheKey, result, CACHE_TTL.CALENDAR_EVENTS);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Create calendar event
calendarRouter.post("/events", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = z.object({
      summary: z.string().min(1),
      description: z.string().optional(),
      start: z.string(),
      end: z.string(),
      location: z.string().optional(),
      attendees: z.array(z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
      })).optional(),
      calendarId: z.string().optional(),
    }).parse(req.body);

    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    if (!connection) {
      res.status(404).json({ error: "No calendar connection found" });
      return;
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    const calendarId = payload.calendarId || connection.defaultCalendarId || "primary";

    const eventData: any = {
      summary: payload.summary,
      description: payload.description,
      start: {
        dateTime: payload.start,
        timeZone: connection.timeZone || "UTC",
      },
      end: {
        dateTime: payload.end,
        timeZone: connection.timeZone || "UTC",
      },
    };

    if (payload.location) {
      eventData.location = payload.location;
    }

    if (payload.attendees && payload.attendees.length > 0) {
      eventData.attendees = payload.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
      }));
    }

    const { data: event } = await calendar.events.insert({
      calendarId,
      requestBody: eventData,
      sendUpdates: payload.attendees && payload.attendees.length > 0 ? "all" : "none",
    });

    // Invalidate calendar events cache (fail silently if cache unavailable)
    try {
      await cache.deletePattern(`calendar:events:${req.currentUser.id}:*`);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(201).json({
      event: {
        id: event.id ?? "",
        summary: event.summary || "",
        description: event.description || "",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        location: event.location || "",
        htmlLink: event.htmlLink || "",
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update calendar event
calendarRouter.put("/events/:eventId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { eventId } = req.params;
    const payload = z.object({
      summary: z.string().min(1).optional(),
      description: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      location: z.string().optional(),
      attendees: z.array(z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
      })).optional(),
      calendarId: z.string().optional(),
    }).parse(req.body);

    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    if (!connection) {
      res.status(404).json({ error: "No calendar connection found" });
      return;
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    const calendarId = payload.calendarId || connection.defaultCalendarId || "primary";

    // Get existing event
    const { data: existingEvent } = await calendar.events.get({
      calendarId,
      eventId,
    });

    const eventData: any = {
      ...existingEvent,
      summary: payload.summary ?? existingEvent.summary,
      description: payload.description !== undefined ? payload.description : existingEvent.description,
    };

    if (payload.start) {
      eventData.start = {
        dateTime: payload.start,
        timeZone: connection.timeZone || "UTC",
      };
    }

    if (payload.end) {
      eventData.end = {
        dateTime: payload.end,
        timeZone: connection.timeZone || "UTC",
      };
    }

    if (payload.location !== undefined) {
      eventData.location = payload.location;
    }

    if (payload.attendees !== undefined) {
      eventData.attendees = payload.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
      }));
    }

    const { data: event } = await calendar.events.update({
      calendarId,
      eventId,
      requestBody: eventData,
      sendUpdates: payload.attendees && payload.attendees.length > 0 ? "all" : "none",
    });

    // Invalidate calendar events cache (fail silently if cache unavailable)
    try {
      await cache.deletePattern(`calendar:events:${req.currentUser.id}:*`);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json({
      event: {
        id: event.id ?? "",
        summary: event.summary || "",
        description: event.description || "",
        start: event.start?.dateTime || event.start?.date || "",
        end: event.end?.dateTime || event.end?.date || "",
        location: event.location || "",
        htmlLink: event.htmlLink || "",
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete calendar event
calendarRouter.delete("/events/:eventId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { eventId } = req.params;
    const calendarId = typeof req.query.calendarId === "string" ? req.query.calendarId : "primary";

    const connection = await prisma.calendarConnection.findFirst({
      where: { userId: req.currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    if (!connection) {
      res.status(404).json({ error: "No calendar connection found" });
      return;
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    await calendar.events.delete({
      calendarId: calendarId || connection.defaultCalendarId || "primary",
      eventId,
      sendUpdates: "all",
    });

    // Invalidate calendar events cache (fail silently if cache unavailable)
    try {
      await cache.deletePattern(`calendar:events:${req.currentUser.id}:*`);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});





