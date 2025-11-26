import { google } from "googleapis";
import { parseISO } from "date-fns";

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { googleAuthService } from "./googleAuth";
import { calendarAvailabilityService } from "./calendarAvailability";

type SyncBusyBlocksOptions = {
  userId: string;
  calendarConnectionId: string;
  calendars?: string[];
  start: string;
  end: string;
};

const normalizeCalendarIds = (calendarIds: string[] | undefined, defaultCalendarId?: string | null) => {
  if (calendarIds && calendarIds.length > 0) {
    return calendarIds;
  }
  return defaultCalendarId ? [defaultCalendarId] : ["primary"];
};

const fetchCalendarBusyBlocks = async ({
  auth,
  calendarId,
  start,
  end,
}: {
  auth: ReturnType<typeof googleAuthService.createOAuthClient>;
  calendarId: string;
  start: string;
  end: string;
}) => {
  const calendar = google.calendar({ version: "v3", auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: start,
      timeMax: end,
      items: [{ id: calendarId }],
    },
  });

  const busy = response.data.calendars?.[calendarId]?.busy ?? [];
  return busy.map((interval) => ({
    start: interval.start ?? start,
    end: interval.end ?? end,
    calendarId,
    source: "calendar",
  }));
};

export const googleCalendarService = {
  async syncBusyBlocks(options: SyncBusyBlocksOptions) {
    const connection = await prisma.calendarConnection.findUnique({
      where: { id: options.calendarConnectionId },
    });

    if (!connection) {
      throw new Error("Calendar connection not found");
    }
    if (connection.userId !== options.userId) {
      throw new Error("Calendar connection does not belong to the user");
    }

    const rangeStart = parseISO(options.start);
    const rangeEnd = parseISO(options.end);

    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      throw new Error("Invalid time range provided for calendar sync");
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(options.userId);

    const metadata = (connection.metadata as Record<string, unknown> | null) ?? null;
    const storedCalendars = Array.isArray(metadata?.calendars)
      ? (metadata.calendars as unknown[]).filter((value): value is string => typeof value === "string")
      : undefined;

    const calendarIds = normalizeCalendarIds(options.calendars ?? storedCalendars, connection.defaultCalendarId);

    const blocks = (
      await Promise.all(
        calendarIds.map(async (calendarId) => {
          try {
            return await fetchCalendarBusyBlocks({
              auth: authClient,
              calendarId,
              start: options.start,
              end: options.end,
            });
          } catch (error) {
            logger.error(
              { error, userId: options.userId, calendarId },
              "Failed to fetch free/busy information for calendar",
            );
            return [];
          }
        }),
      )
    ).flat();

    await calendarAvailabilityService.upsertBusyBlocks({
      calendarConnectionId: connection.id,
      rangeStart: options.start,
      rangeEnd: options.end,
      busyBlocks: blocks,
    });

    const existingMetadata = metadata ?? {};
    await prisma.calendarConnection.update({
      where: { id: connection.id },
      data: {
        metadata: {
          ...existingMetadata,
          lastSyncedAt: new Date().toISOString(),
          calendars: calendarIds,
        },
      },
    });

    logger.info(
      {
        userId: options.userId,
        calendarConnectionId: connection.id,
        calendars: calendarIds,
        intervalsCaptured: blocks.length,
      },
      "Updated calendar availability cache from Google Calendar",
    );

    return {
      cachedBlocks: blocks.length,
      calendars: calendarIds,
    };
  },

  async listCalendars({
    userId,
    calendarConnectionId,
  }: {
    userId: string;
    calendarConnectionId: string;
  }) {
    const connection = await prisma.calendarConnection.findUnique({
      where: { id: calendarConnectionId },
    });

    if (!connection) {
      throw new Error("Calendar connection not found");
    }
    if (connection.userId !== userId) {
      throw new Error("Calendar connection does not belong to the user");
    }

    const authClient = await googleAuthService.getAuthorizedClientForUser(userId);
    const calendar = google.calendar({ version: "v3", auth: authClient });

    const response = await calendar.calendarList.list({
      minAccessRole: "writer",
      showHidden: false,
    });

    const metadata = (connection.metadata as Record<string, unknown> | null) ?? null;
    const selectedCalendars = Array.isArray(metadata?.calendars)
      ? (metadata?.calendars as unknown[]).filter((value): value is string => typeof value === "string")
      : [];

    const items = response.data.items ?? [];

    return items
      .filter((item): item is typeof item & { id: string } => Boolean(item.id))
      .map((item) => ({
        id: item.id as string,
        summary: item.summary ?? item.id ?? "Untitled calendar",
        description: item.description ?? null,
        timeZone: item.timeZone ?? null,
        color: item.backgroundColor ?? null,
        primary: Boolean(item.primary),
        selected: selectedCalendars.includes(item.id as string),
      }));
  },
};


