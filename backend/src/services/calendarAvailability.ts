import { eachDayOfInterval, endOfDay, isAfter, isBefore, parseISO, startOfDay } from "date-fns";

import { prisma } from "../lib/prisma";

type BusyBlock = {
  start: string;
  end: string;
  calendarId?: string;
  source?: string;
};

export type AvailabilitySlot = {
  start: string;
  end: string;
  status: "busy" | "free" | "held";
  source: "calendar" | "buffer" | "booking" | "custom";
  calendarId?: string;
};

export type AvailabilityDay = {
  date: string;
  slots: AvailabilitySlot[];
  isFullyBooked: boolean;
};

type GetAvailabilityOptions = {
  userId: string;
  start: string;
  end: string;
  meetingTypeId?: string;
};

const normalizeBusyBlocks = (blocks: BusyBlock[], rangeStart: Date, rangeEnd: Date): AvailabilitySlot[] => {
  const normalized: AvailabilitySlot[] = [];
  blocks.forEach((block) => {
    if (!block.start || !block.end) {
      return;
    }
    const start = parseISO(block.start);
    const end = parseISO(block.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return;
    }
    if (isAfter(start, rangeEnd) || isBefore(end, rangeStart)) {
      return;
    }
    const clampedStart = start < rangeStart ? rangeStart : start;
    const clampedEnd = end > rangeEnd ? rangeEnd : end;
    if (clampedEnd <= clampedStart) {
      return;
    }
    normalized.push({
      start: clampedStart.toISOString(),
      end: clampedEnd.toISOString(),
      status: "busy",
      source: (block.source as AvailabilitySlot["source"]) ?? "calendar",
      calendarId: block.calendarId,
    });
  });
  return normalized;
};

export const calendarAvailabilityService = {
  async getAvailability(options: GetAvailabilityOptions) {
    const rangeStart = startOfDay(parseISO(options.start));
    const rangeEnd = endOfDay(parseISO(options.end));

    // Get custom availability slots if meetingTypeId is provided
    let customSlots: AvailabilitySlot[] = [];
    if (options.meetingTypeId) {
      const slots = await prisma.customAvailabilitySlot.findMany({
        where: {
          meetingTypeId: options.meetingTypeId,
          isActive: true,
          OR: [
            // One-time slots within range
            {
              isRecurring: false,
              startTime: { lte: rangeEnd },
              endTime: { gte: rangeStart },
            },
            // Recurring slots (we'll expand these later if needed)
            {
              isRecurring: true,
            },
          ],
        },
      });

      // Convert custom slots to AvailabilitySlot format
      customSlots = slots
        .filter((slot) => {
          // For one-time slots, check if they're in range
          if (!slot.isRecurring) {
            const slotStart = slot.startTime;
            const slotEnd = slot.endTime;
            return slotStart <= rangeEnd && slotEnd >= rangeStart;
          }
          // For recurring slots, we'd need to expand them based on recurrenceRule
          // For now, include them and let the frontend handle expansion
          return true;
        })
        .map((slot) => ({
          start: slot.startTime.toISOString(),
          end: slot.endTime.toISOString(),
          status: "free" as const,
          source: "custom" as const,
        }));
    }

    // Check if user has calendar connections
    const userConnections = await prisma.calendarConnection.findMany({
      where: { userId: options.userId },
    });

    if (userConnections.length === 0) {
      // Return custom slots only if no calendar connection
      return {
        availability: customSlots.length > 0
          ? [
              {
                date: rangeStart.toISOString().split("T")[0],
                slots: customSlots,
                isFullyBooked: false,
              },
            ]
          : [],
        metadata: {
          cachesEvaluated: 0,
          rangeStart: rangeStart.toISOString(),
          rangeEnd: rangeEnd.toISOString(),
          meetingTypeId: options.meetingTypeId ?? null,
          error: "NO_CALENDAR_CONNECTION",
          message: customSlots.length > 0
            ? "Using custom availability slots. Connect your Google Calendar for automatic availability."
            : "No calendar connection found. Please connect your Google Calendar first or add custom availability slots.",
          customSlotsCount: customSlots.length,
        },
      };
    }

    const caches = await prisma.calendarAvailabilityCache.findMany({
      where: {
        calendarConnection: {
          userId: options.userId,
        },
        AND: [
          {
            rangeStart: {
              lte: rangeEnd,
            },
          },
          {
            rangeEnd: {
              gte: rangeStart,
            },
          },
        ],
      },
      include: {
        calendarConnection: true,
      },
      orderBy: {
        refreshedAt: "desc",
      },
    });

    const busyBlocks: BusyBlock[] = caches.flatMap((cache) => {
      const payload = cache.busyBlocks as unknown;
      if (!Array.isArray(payload)) {
        return [];
      }
      return payload.map((block) => ({
        start: typeof block?.start === "string" ? block.start : "",
        end: typeof block?.end === "string" ? block.end : "",
        calendarId: typeof block?.calendarId === "string" ? block.calendarId : cache.calendarConnectionId,
        source: typeof block?.source === "string" ? block.source : "calendar",
      }));
    });

    const normalizedBusyBlocks = normalizeBusyBlocks(busyBlocks, rangeStart, rangeEnd);

    // Merge custom slots with busy blocks (custom slots were already fetched earlier if no calendar connection)
    // If we have calendar connection, we still want to include custom slots
    if (options.meetingTypeId && customSlots.length === 0) {
      const slots = await prisma.customAvailabilitySlot.findMany({
        where: {
          meetingTypeId: options.meetingTypeId,
          isActive: true,
          OR: [
            // One-time slots within range
            {
              isRecurring: false,
              startTime: { lte: rangeEnd },
              endTime: { gte: rangeStart },
            },
            // Recurring slots (basic support - full recurrence expansion would require a library)
            {
              isRecurring: true,
            },
          ],
        },
      });

      // Convert custom slots to AvailabilitySlot format (as free slots)
      customSlots = slots
        .filter((slot) => {
          // For one-time slots, check if they're in range
          if (!slot.isRecurring) {
            const slotStart = slot.startTime;
            const slotEnd = slot.endTime;
            return slotStart <= rangeEnd && slotEnd >= rangeStart;
          }
          // For recurring slots, include them (frontend can handle basic expansion)
          return true;
        })
        .map((slot) => ({
          start: slot.startTime.toISOString(),
          end: slot.endTime.toISOString(),
          status: "free" as const,
          source: "custom" as const,
        }));
    }

    // Combine busy blocks and custom slots
    const allSlots = [...normalizedBusyBlocks, ...customSlots];

    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd }).map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const slots = allSlots.filter((slot) => {
        const slotStart = parseISO(slot.start);
        return slotStart >= dayStart && slotStart <= dayEnd;
      });
      return {
        date: dayStart.toISOString(),
        slots,
        isFullyBooked: false,
      };
    });

    // If no cache exists, indicate that sync is needed
    const needsSync = caches.length === 0;
    const oldestCache = caches.length > 0 ? caches[caches.length - 1] : null;
    const cacheAge = oldestCache
      ? Date.now() - oldestCache.refreshedAt.getTime()
      : null;
    const isStale = cacheAge !== null && cacheAge > 7 * 24 * 60 * 60 * 1000; // 7 days

    return {
      availability: days,
      metadata: {
        cachesEvaluated: caches.length,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        meetingTypeId: options.meetingTypeId ?? null,
        needsSync,
        isStale,
        oldestCacheAge: cacheAge,
        customSlotsCount: customSlots.length,
        message: needsSync
          ? customSlots.length > 0
            ? "Using custom availability slots. Calendar sync recommended for automatic availability."
            : "Calendar sync required. Please sync your calendar to see availability."
          : isStale
            ? "Calendar data may be stale. Consider syncing your calendar for up-to-date availability."
            : null,
      },
    };
  },
  async upsertBusyBlocks(params: {
    calendarConnectionId: string;
    rangeStart: string;
    rangeEnd: string;
    busyBlocks: BusyBlock[];
  }) {
    const rangeStart = parseISO(params.rangeStart);
    const rangeEnd = parseISO(params.rangeEnd);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      throw new Error("Invalid range supplied for availability cache.");
    }

    const record = await prisma.calendarAvailabilityCache.upsert({
      where: {
        calendarConnectionId_rangeStart_rangeEnd: {
          calendarConnectionId: params.calendarConnectionId,
          rangeStart,
          rangeEnd,
        },
      },
      update: {
        busyBlocks: params.busyBlocks,
        refreshedAt: new Date(),
      },
      create: {
        calendarConnectionId: params.calendarConnectionId,
        rangeStart,
        rangeEnd,
        busyBlocks: params.busyBlocks,
      },
    });

    return record;
  },
};


