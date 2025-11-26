import { addMinutes } from "date-fns";
import { MeetingReminderStatus, Prisma } from "@prisma/client";

import { AppConfig } from "../config/env";
import { prisma } from "../lib/prisma";
import { reminderQueue } from "../queue/reminderQueue";
import type { MeetingReminderJob } from "../queue/types";
import { calendarAvailabilityService } from "./calendarAvailability";
import {
  computeSmartRecommendations,
  formatSlotRange,
  generateSuggestedSlot,
  type SmartRecommendation,
} from "./meetingRecommendations";
import { gmailDeliveryService } from "./gmailDelivery";
import { escapeHtml } from "../utils/escapeHtml";

const DEFAULT_PLAN_MINUTES = [24 * 60, 72 * 60];
const MS_PER_MINUTE = 60_000;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return { ...value } as Record<string, unknown>;
};

const buildInteractionEntry = (
  reason: string,
  note: string | null,
  selectedSlot: { start: string; end: string } | null,
): ReminderInteraction => ({
  at: new Date().toISOString(),
  reason,
  note,
  selectedSlot,
});

const mergeMetadata = (
  existing: Prisma.JsonValue | null | undefined,
  entry: ReminderInteraction,
  activationAt: string,
): Prisma.JsonObject => {
  const base = toJsonObject(existing);
  const history = Array.isArray(base.history) ? [...(base.history as unknown[])] : [];
  history.push(entry);
  return {
    ...base,
    history,
    lastInteraction: entry,
    activationAt,
  } as Prisma.JsonObject;
};

const enqueueReminder = async (reminder: { id: string; sendCount: number; nextSendAt: Date | null }) => {
  if (!reminder.nextSendAt) {
    return;
  }
  const delay = Math.max(reminder.nextSendAt.getTime() - Date.now(), 0);
  await reminderQueue.add(
    "dispatch",
    {
      reminderId: reminder.id,
      attempt: reminder.sendCount + 1,
    },
    {
      jobId: `meeting-reminder:${reminder.id}:${reminder.sendCount + 1}`,
      delay,
    },
  );
};

const deriveBookingUrl = (token: string | null | undefined) => {
  if (!token) {
    return null;
  }
  const base = AppConfig.publicUrl.endsWith("/") ? AppConfig.publicUrl.slice(0, -1) : AppConfig.publicUrl;
  return `${base}/api/book/${token}`;
};

const computeNextSendAt = (
  reminder: {
    createdAt: Date;
    schedulePlanMinutes: number[];
    maxSends: number;
    metadata: Prisma.JsonValue | null;
  },
  sendCount: number,
  fallbackMinutes = 3 * 60,
): Date | null => {
  const plan = reminder.schedulePlanMinutes.length > 0 ? reminder.schedulePlanMinutes : DEFAULT_PLAN_MINUTES;
  if (sendCount >= reminder.maxSends || sendCount >= plan.length) {
    return null;
  }
  const metadata = toJsonObject(reminder.metadata);
  const activationIso = typeof metadata.activationAt === "string" ? metadata.activationAt : reminder.createdAt.toISOString();
  const activationDate = new Date(activationIso);
  const candidate = new Date(activationDate.getTime() + plan[sendCount] * MS_PER_MINUTE);
  if (candidate <= new Date()) {
    return new Date(Date.now() + fallbackMinutes * MS_PER_MINUTE);
  }
  return candidate;
};

type ReminderInteraction = {
  at: string;
  reason: string;
  note: string | null;
  selectedSlot: { start: string; end: string } | null;
};

type ReminderContext = {
  meetingType: {
    id: string;
    name: string;
    durationMinutes: number;
    userId: string;
    user?: { email: string; displayName: string | null } | null;
    bookingLinks: Array<{ id: string; token: string }>;
    calendarConnection?: { timeZone?: string | null } | null;
  };
  bookingLink?: { id: string; token: string } | null;
};

type RegisterReminderInput = {
  context: ReminderContext;
  inviteeEmail: string;
  inviteeName?: string;
  reason?: "notify" | "propose" | "manual";
  note?: string | null;
  selectedSlot?: { start: string; end: string } | null;
};

const sendHostNotification = async (
  context: ReminderContext,
  reminder: { inviteeEmail: string; inviteeName: string | null },
  entry: ReminderInteraction,
) => {
  if (entry.reason !== "propose" || !entry.note) {
    return;
  }

  const hostEmail = context.meetingType.user?.email;
  if (!hostEmail) {
    return;
  }

  const bookingToken = context.bookingLink?.token ?? context.meetingType.bookingLinks[0]?.token ?? null;
  const bookingUrl = deriveBookingUrl(bookingToken);
  const inviteeDisplay = reminder.inviteeName || reminder.inviteeEmail;
  const timeZone = context.meetingType.calendarConnection?.timeZone ?? null;
  const slotSummary = entry.selectedSlot
    ? formatSlotRange(entry.selectedSlot.start, entry.selectedSlot.end, timeZone)
    : null;

  const html: string[] = [
    `<p>${escapeHtml(inviteeDisplay)} asked for alternate times for <strong>${escapeHtml(context.meetingType.name)}</strong>.</p>`,
    `<p><em>Message:</em> ${escapeHtml(entry.note ?? "")}</p>`,
  ];

  if (slotSummary) {
    html.push(`<p><em>Preferred window:</em> ${escapeHtml(slotSummary)}</p>`);
  }

  if (bookingUrl) {
    html.push(`<p><a href="${bookingUrl}">Open the scheduling dashboard</a></p>`);
  }

  html.push("<p>– TaskForce Scheduling Assistant</p>");

  await gmailDeliveryService.sendEmailViaGmail({
    userId: context.meetingType.userId,
    to: hostEmail,
    subject: `Follow-up request from ${inviteeDisplay}`,
    bodyHtml: html.join(""),
  });
};

const registerReminder = async (input: RegisterReminderInput) => {
  const plan = DEFAULT_PLAN_MINUTES;
  const normalizedEmail = normalizeEmail(input.inviteeEmail);
  const now = new Date();
  const reason = input.reason ?? "notify";
  const interaction = buildInteractionEntry(reason, input.note ?? null, input.selectedSlot ?? null);
  const activationAt = interaction.at;

  const existing = await prisma.meetingReminder.findUnique({
    where: {
      meetingTypeId_inviteeEmail: {
        meetingTypeId: input.context.meetingType.id,
        inviteeEmail: normalizedEmail,
      },
    },
  });

  let reminder;

  if (!existing) {
    reminder = await prisma.meetingReminder.create({
      data: {
        userId: input.context.meetingType.userId,
        meetingTypeId: input.context.meetingType.id,
        bookingLinkId: input.context.bookingLink?.id ?? null,
        inviteeEmail: normalizedEmail,
        inviteeName: input.inviteeName?.trim() || null,
        status: plan.length ? MeetingReminderStatus.SCHEDULED : MeetingReminderStatus.PENDING,
        schedulePlanMinutes: plan,
        maxSends: plan.length,
        nextSendAt: plan.length ? new Date(now.getTime() + plan[0] * MS_PER_MINUTE) : null,
        metadata: mergeMetadata(null, interaction, activationAt),
      },
    });
  } else {
    let status = existing.status;
    let sendCount = existing.sendCount;
    let nextSendAt = existing.nextSendAt;
    let effectiveActivationAt = activationAt;

    if (status === MeetingReminderStatus.COMPLETED || status === MeetingReminderStatus.CANCELLED) {
      status = MeetingReminderStatus.SCHEDULED;
      sendCount = 0;
      nextSendAt = plan.length ? new Date(now.getTime() + plan[0] * MS_PER_MINUTE) : null;
    } else if ((!nextSendAt || nextSendAt <= now) && sendCount < plan.length) {
      nextSendAt = new Date(now.getTime() + plan[sendCount] * MS_PER_MINUTE);
    } else {
      const metadata = toJsonObject(existing.metadata);
      effectiveActivationAt = typeof metadata.activationAt === "string" ? metadata.activationAt : activationAt;
    }

    reminder = await prisma.meetingReminder.update({
      where: { id: existing.id },
      data: {
        inviteeName: input.inviteeName?.trim() || existing.inviteeName,
        bookingLinkId: input.context.bookingLink?.id ?? existing.bookingLinkId,
        status,
        sendCount,
        nextSendAt,
        maxSends: plan.length,
        schedulePlanMinutes: plan,
        metadata: mergeMetadata(existing.metadata, interaction, effectiveActivationAt),
        updatedAt: now,
      },
    });
  }

  if (reminder.nextSendAt && reminder.status === MeetingReminderStatus.SCHEDULED) {
    await enqueueReminder(reminder);
  }

  await sendHostNotification(input.context, reminder, interaction);

  return reminder;
};

const buildReminderEmail = (
  context: ReminderContext,
  inviteeDisplay: string,
  bookingUrl: string,
  recommendations: SmartRecommendation[],
  timeZone: string | null,
) => {
  const lines: string[] = [];
  lines.push(`<p>Hi ${escapeHtml(inviteeDisplay)},</p>`);
  lines.push(
    `<p>Just a quick reminder to grab a slot for <strong>${escapeHtml(context.meetingType.name)}</strong>. We carved out a few openings that should work for you.</p>`,
  );

  if (recommendations.length) {
    const listItems = recommendations
      .slice(0, 3)
      .map((rec) => {
        const slotLabel = formatSlotRange(rec.start, rec.end, timeZone);
        const descriptor = [rec.label, rec.descriptor].filter(Boolean).join(" • ");
        return `<li><strong>${escapeHtml(slotLabel)}</strong><br/><span>${escapeHtml(descriptor)}</span></li>`;
      })
      .join("");
    lines.push(`<ul>${listItems}</ul>`);
  } else {
    lines.push("<p>Fresh openings are limited right now, but you can still grab the next available time that fits your schedule.</p>");
  }

  lines.push(
    `<p><a href="${bookingUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:600;">Pick a time</a></p>`,
  );
  lines.push("<p>If none of these times work, reply to this email and we’ll coordinate something that does.</p>");
  lines.push("<p>– TaskForce Scheduling Assistant</p>");

  return lines.join("");
};

const processReminderDispatch = async (payload: MeetingReminderJob) => {
  const reminder = await prisma.meetingReminder.findUnique({
    where: { id: payload.reminderId },
    include: {
      meetingType: {
        include: {
          user: true,
          bookingLinks: true,
          calendarConnection: true,
        },
      },
      bookingLink: true,
    },
  });

  if (!reminder) {
    return;
  }

  if (reminder.status !== MeetingReminderStatus.SCHEDULED || !reminder.nextSendAt) {
    return;
  }

  const now = new Date();
  if (reminder.nextSendAt.getTime() - now.getTime() > 60 * 1000) {
    await enqueueReminder(reminder);
    return;
  }

  if (reminder.sendCount >= reminder.maxSends) {
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: {
        status: MeetingReminderStatus.COMPLETED,
        nextSendAt: null,
      },
    });
    return;
  }

  const existingBooking = await prisma.meetingBooking.findFirst({
    where: {
      meetingTypeId: reminder.meetingTypeId,
      inviteeEmail: reminder.inviteeEmail,
      status: "CONFIRMED",
    },
  });

  if (existingBooking) {
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: {
        status: MeetingReminderStatus.COMPLETED,
        nextSendAt: null,
      },
    });
    return;
  }

  const bookingToken = reminder.bookingLink?.token ?? reminder.meetingType.bookingLinks[0]?.token ?? null;
  if (!bookingToken) {
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: {
        status: MeetingReminderStatus.FAILED,
        nextSendAt: null,
        metadata: {
          ...(toJsonObject(reminder.metadata)),
          lastError: "No booking link available for reminder dispatch",
        } as Prisma.JsonObject,
      },
    });
    return;
  }

  const bookingUrl = deriveBookingUrl(bookingToken);
  const timeZone = reminder.meetingType.calendarConnection?.timeZone ?? null;

  const availability = await calendarAvailabilityService.getAvailability({
    userId: reminder.meetingType.userId,
    start: now.toISOString(),
    end: addMinutes(now, 14 * 24 * 60).toISOString(),
    meetingTypeId: reminder.meetingTypeId,
  });

  const recommendations = computeSmartRecommendations(
    availability.availability,
    reminder.meetingType.durationMinutes,
    timeZone,
  );

  const inviteeDisplay = reminder.inviteeName || reminder.inviteeEmail;
  const emailHtml = buildReminderEmail(
    {
      meetingType: reminder.meetingType,
      bookingLink: reminder.bookingLink ?? reminder.meetingType.bookingLinks[0] ?? null,
    },
    inviteeDisplay,
    bookingUrl!,
    recommendations,
    timeZone,
  );

  try {
    await gmailDeliveryService.sendEmailViaGmail({
      userId: reminder.meetingType.userId,
      to: reminder.inviteeEmail,
      subject: `Still want to meet with ${reminder.meetingType.name}?`,
      bodyHtml: emailHtml,
    });
  } catch (error) {
    await prisma.meetingReminder.update({
      where: { id: reminder.id },
      data: {
        status: MeetingReminderStatus.FAILED,
        lastSentAt: now,
        metadata: {
          ...(toJsonObject(reminder.metadata)),
          lastError: error instanceof Error ? error.message : "Unknown reminder send failure",
          lastAttemptAt: now.toISOString(),
        } as Prisma.JsonObject,
      },
    });
    throw error;
  }

  const nextSendAt = computeNextSendAt(reminder, reminder.sendCount + 1);
  const metadata = {
    ...(toJsonObject(reminder.metadata)),
    lastDispatchedAt: now.toISOString(),
    lastRecommendations: recommendations.slice(0, 3),
  } as Prisma.JsonObject;

  const updated = await prisma.meetingReminder.update({
    where: { id: reminder.id },
    data: {
      sendCount: reminder.sendCount + 1,
      lastSentAt: now,
      status: nextSendAt ? MeetingReminderStatus.SCHEDULED : MeetingReminderStatus.COMPLETED,
      nextSendAt,
      metadata,
      updatedAt: now,
    },
  });

  if (updated.nextSendAt && updated.status === MeetingReminderStatus.SCHEDULED) {
    await enqueueReminder(updated);
  }
};

export const meetingRemindersService = {
  registerReminder,
  processReminderDispatch,
};










