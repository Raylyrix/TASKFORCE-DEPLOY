import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { slugify } from "../utils/slugify";

const meetingLocationTypes = ["GOOGLE_MEET", "PHONE", "IN_PERSON", "CUSTOM_URL"] as const;
type MeetingLocationType = (typeof meetingLocationTypes)[number];

type MeetingTypeWithLinks = Prisma.MeetingTypeGetPayload<{ include: { bookingLinks: true } }>;

type MeetingTypeStats = {
  total: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  declined: number;
  lastBookedAt: string | null;
};

const createEmptyBookingStats = (): MeetingTypeStats => ({
  total: 0,
  confirmed: 0,
  pending: 0,
  cancelled: 0,
  declined: 0,
  lastBookedAt: null,
});

type MeetingTypeBaseInput = {
  name: string;
  description?: string | null;
  slug?: string | null;
  calendarConnectionId?: string | null;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  maxBookingsPerDay?: number | null;
  availabilityRules?: unknown;
  formSchema?: unknown;
  meetingLocationType: MeetingLocationType;
  meetingLocationValue?: string | null;
  isActive?: boolean;
};

type CreateMeetingTypeInput = MeetingTypeBaseInput & {
  userId: string;
  createDefaultBookingLink?: boolean;
  bookingLinkName?: string | null;
};

type UpdateMeetingTypeInput = Partial<MeetingTypeBaseInput> & {
  userId: string;
  meetingTypeId: string;
  createBookingLink?: boolean;
  bookingLinkName?: string | null;
};

const ensureConnectionOwnership = async (userId: string, connectionId?: string | null) => {
  if (!connectionId) {
    return null;
  }
  const connection = await prisma.calendarConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection || connection.userId !== userId) {
    throw new Error("Calendar connection not found or unauthorized");
  }
  return connection.id;
};

const ensureUniqueSlug = async (userId: string, slug: string, meetingTypeId?: string) => {
  let candidate = slug;
  let counter = 1;
  while (true) {
    const existing = await prisma.meetingType.findFirst({
      where: {
        userId,
        slug: candidate,
        ...(meetingTypeId ? { NOT: { id: meetingTypeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
};

const getBookingStatsForMeetingTypes = async (
  meetingTypeIds: string[],
): Promise<Map<string, MeetingTypeStats>> => {
  if (meetingTypeIds.length === 0) {
    return new Map();
  }

  const statusGroups = await prisma.meetingBooking.groupBy({
    by: ["meetingTypeId", "status"],
    where: {
      meetingTypeId: {
        in: meetingTypeIds,
      },
    },
    _count: {
      _all: true,
    },
  });

  const lastBookedGroups = await prisma.meetingBooking.groupBy({
    by: ["meetingTypeId"],
    where: {
      meetingTypeId: {
        in: meetingTypeIds,
      },
    },
    _max: {
      createdAt: true,
    },
  });

  const statsMap = new Map<string, MeetingTypeStats>();

  meetingTypeIds.forEach((id) => {
    statsMap.set(id, createEmptyBookingStats());
  });

  statusGroups.forEach((group) => {
    const stats = statsMap.get(group.meetingTypeId) ?? createEmptyBookingStats();
    const count = group._count._all ?? 0;
    stats.total += count;
    switch (group.status) {
      case "CONFIRMED":
        stats.confirmed = count;
        break;
      case "PENDING":
        stats.pending = count;
        break;
      case "CANCELLED":
        stats.cancelled = count;
        break;
      case "DECLINED":
        stats.declined = count;
        break;
      default:
        break;
    }
    statsMap.set(group.meetingTypeId, stats);
  });

  lastBookedGroups.forEach((group) => {
    const stats = statsMap.get(group.meetingTypeId) ?? createEmptyBookingStats();
    stats.lastBookedAt = group._max.createdAt ? group._max.createdAt.toISOString() : null;
    statsMap.set(group.meetingTypeId, stats);
  });

  return statsMap;
};

const mapMeetingType = (meetingType: MeetingTypeWithLinks | null, stats?: MeetingTypeStats) => {
  if (!meetingType) return null;
  return {
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
    bookingStats: stats ?? createEmptyBookingStats(),
  };
};

const normalizeMeetingLocationValue = (type: MeetingLocationType, value?: string | null) => {
  if ((type === "PHONE" || type === "CUSTOM_URL") && !value) {
    throw new Error("Meeting location requires a value for the selected type.");
  }
  if (type === "GOOGLE_MEET") {
    return null;
  }
  return value ?? null;
};

export const meetingTypesService = {
  async createMeetingType(input: CreateMeetingTypeInput) {
    // Check if user has at least one calendar connection
    const userConnections = await prisma.calendarConnection.findMany({
      where: { userId: input.userId },
      take: 1,
    });

    if (userConnections.length === 0) {
      throw new Error(
        "No calendar connection found. Please connect your Google Calendar first. Calendar connection is required for meeting scheduling.",
      );
    }

    // If no calendarConnectionId provided, use the first available connection
    const connectionIdToUse = input.calendarConnectionId ?? userConnections[0].id;
    const calendarConnectionId = await ensureConnectionOwnership(input.userId, connectionIdToUse);
    
    if (!calendarConnectionId) {
      throw new Error(
        "Calendar connection is required for meeting types. Please connect your Google Calendar first.",
      );
    }

    const slugBase = input.slug ?? slugify(input.name);
    const slug = await ensureUniqueSlug(input.userId, slugBase);

    const availabilityRules =
      input.availabilityRules === undefined
        ? ({} as Prisma.InputJsonValue)
        : (input.availabilityRules as Prisma.InputJsonValue);

    const formSchemaValue =
      input.formSchema === undefined
        ? Prisma.JsonNull
        : input.formSchema === null
          ? Prisma.JsonNull
          : (input.formSchema as Prisma.InputJsonValue);

    const meetingType = await prisma.meetingType.create({
      data: {
        userId: input.userId,
        calendarConnectionId,
        name: input.name,
        description: input.description ?? null,
        slug,
        durationMinutes: input.durationMinutes,
        bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
        bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
        maxBookingsPerDay: input.maxBookingsPerDay ?? null,
        availabilityRules,
        formSchema: formSchemaValue,
        meetingLocationType: input.meetingLocationType,
        meetingLocationValue: normalizeMeetingLocationValue(
          input.meetingLocationType,
          input.meetingLocationValue ?? null,
        ),
        isActive: input.isActive ?? true,
        bookingLinks: input.createDefaultBookingLink
          ? {
              create: {
                name: input.bookingLinkName ?? "Default link",
                token: randomUUID(),
                isPublic: true,
              },
            }
          : undefined,
      },
      include: {
        bookingLinks: true,
      },
    });

    return mapMeetingType(meetingType, createEmptyBookingStats());
  },

  async updateMeetingType(input: UpdateMeetingTypeInput) {
    const existing = await prisma.meetingType.findUnique({
      where: { id: input.meetingTypeId },
      include: {
        bookingLinks: true,
      },
    });

    if (!existing || existing.userId !== input.userId) {
      throw new Error("Meeting type not found");
    }

    const calendarConnectionId =
      input.calendarConnectionId !== undefined
        ? await ensureConnectionOwnership(input.userId, input.calendarConnectionId)
        : existing.calendarConnectionId;

    let slug = existing.slug;
    if (input.slug) {
      slug = await ensureUniqueSlug(input.userId, input.slug, existing.id);
    } else if (input.name && !existing.slug) {
      slug = await ensureUniqueSlug(input.userId, slugify(input.name), existing.id);
    }

    const nextLocationType = input.meetingLocationType ?? existing.meetingLocationType;
    const nextLocationValue =
      input.meetingLocationValue !== undefined
        ? normalizeMeetingLocationValue(nextLocationType, input.meetingLocationValue)
        : normalizeMeetingLocationValue(nextLocationType, existing.meetingLocationValue);
    const availabilityRulesValue =
      input.availabilityRules !== undefined
        ? (input.availabilityRules as Prisma.InputJsonValue)
        : ((existing.availabilityRules ?? {}) as Prisma.InputJsonValue);
    const formSchemaValue =
      input.formSchema !== undefined
        ? input.formSchema === null
          ? Prisma.JsonNull
          : (input.formSchema as Prisma.InputJsonValue)
        : existing.formSchema ?? Prisma.JsonNull;

    await prisma.meetingType.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? existing.name,
        description: input.description ?? existing.description,
        slug,
        calendarConnectionId,
        durationMinutes: input.durationMinutes ?? existing.durationMinutes,
        bufferBeforeMinutes: input.bufferBeforeMinutes ?? existing.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes ?? existing.bufferAfterMinutes,
        maxBookingsPerDay:
          input.maxBookingsPerDay !== undefined ? input.maxBookingsPerDay : existing.maxBookingsPerDay,
        availabilityRules: availabilityRulesValue,
        formSchema: formSchemaValue,
        meetingLocationType: nextLocationType,
        meetingLocationValue: nextLocationValue,
        isActive: input.isActive ?? existing.isActive,
      },
      include: {
        bookingLinks: true,
      },
    });

    if (input.createBookingLink) {
      await prisma.bookingLink.create({
        data: {
          meetingTypeId: existing.id,
          name: input.bookingLinkName ?? "New link",
          token: randomUUID(),
          isPublic: true,
        },
      });
    }

    const refreshed = await prisma.meetingType.findUnique({
      where: { id: existing.id },
      include: {
        bookingLinks: true,
      },
    });
    const statsMap = await getBookingStatsForMeetingTypes([existing.id]);
    const stats = statsMap.get(existing.id) ?? createEmptyBookingStats();

    return mapMeetingType(refreshed, stats);
  },
};

export const loadMeetingTypeBookingStats = getBookingStatsForMeetingTypes;
export const createEmptyMeetingTypeStats = createEmptyBookingStats;


