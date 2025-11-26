import { Router } from "express";
import { z } from "zod";
import { MeetingBookingStatus } from "@prisma/client";
import { google } from "googleapis";

import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";
import { googleAuthService } from "../../services/googleAuth";
import { gmailDeliveryService } from "../../services/gmailDelivery";
import { logger } from "../../lib/logger";

export const bookingsRouter = Router();

const bookingQuerySchema = z.object({
  meetingTypeId: z.string().optional(),
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

bookingsRouter.get("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const query = bookingQuerySchema.parse(req.query);

    const where: {
      userId: string;
      meetingTypeId?: string;
      status?: MeetingBookingStatus;
      startTime?: { gte?: Date; lte?: Date };
    } = {
      userId: req.currentUser.id,
    };

    if (query.meetingTypeId) {
      where.meetingTypeId = query.meetingTypeId;
    }

    if (query.status) {
      where.status = query.status as MeetingBookingStatus;
    }

    if (query.startDate || query.endDate) {
      where.startTime = {};
      if (query.startDate) {
        where.startTime.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.startTime.lte = new Date(query.endDate);
      }
    }

    const [bookings, total] = await Promise.all([
      prisma.meetingBooking.findMany({
        where,
        include: {
          meetingType: {
            select: {
              id: true,
              name: true,
              durationMinutes: true,
              meetingLocationType: true,
            },
          },
        },
        orderBy: {
          startTime: "desc",
        },
        take: query.limit,
        skip: query.offset,
      }),
      prisma.meetingBooking.count({ where }),
    ]);

    res.status(200).json({
      bookings: bookings.map((booking) => ({
        id: booking.id,
        meetingType: booking.meetingType || null,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        inviteeEmail: booking.inviteeEmail,
        inviteeName: booking.inviteeName,
        conferenceUrl: booking.conferenceUrl,
        calendarEventId: booking.calendarEventId,
        createdAt: booking.createdAt.toISOString(),
      })),
      total,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get("/:bookingId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const booking = await prisma.meetingBooking.findFirst({
      where: {
        id: req.params.bookingId,
        userId: req.currentUser.id,
      },
      include: {
        meetingType: {
          include: {
            calendarConnection: {
              select: {
                accountEmail: true,
                timeZone: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    res.status(200).json({
      booking: {
        id: booking.id,
        meetingType: booking.meetingType,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
        inviteeEmail: booking.inviteeEmail,
        inviteeName: booking.inviteeName,
        conferenceUrl: booking.conferenceUrl,
        calendarEventId: booking.calendarEventId,
        metadata: booking.metadata,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

const cancelBookingSchema = z.object({
  reason: z.string().max(500).optional(),
});

bookingsRouter.post("/:bookingId/cancel", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = cancelBookingSchema.parse(req.body ?? {});

    const booking = await prisma.meetingBooking.findFirst({
      where: {
        id: req.params.bookingId,
        userId: req.currentUser.id,
      },
      include: {
        meetingType: {
          include: {
            calendarConnection: true,
          },
        },
      },
    });

    if (!booking) {
      res.status(404).json({ error: "Booking not found" });
      return;
    }

    if (booking.status === "CANCELLED") {
      res.status(400).json({ error: "Booking is already cancelled" });
      return;
    }

    // Cancel Google Calendar event if calendarEventId exists
    if (booking.calendarEventId && booking.meetingType?.calendarConnection) {
      try {
        const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
        const calendar = google.calendar({ version: "v3", auth: authClient });
        const calendarId = booking.meetingType.calendarConnection.defaultCalendarId ?? "primary";

        await calendar.events.delete({
          calendarId,
          eventId: booking.calendarEventId,
          sendUpdates: "all", // Notify all attendees
        });

        logger.info(
          { bookingId: booking.id, calendarEventId: booking.calendarEventId },
          "Cancelled Google Calendar event",
        );
      } catch (error) {
        logger.error(
          { error, bookingId: booking.id, calendarEventId: booking.calendarEventId },
          "Failed to cancel Google Calendar event",
        );
        // Continue with booking cancellation even if calendar event cancellation fails
      }
    }

    // Update booking status
    const updated = await prisma.meetingBooking.update({
      where: { id: booking.id },
      data: {
        status: "CANCELLED",
        metadata: {
          ...((booking.metadata as Record<string, unknown>) ?? {}),
          cancelledAt: new Date().toISOString(),
          cancellationReason: payload.reason ?? null,
        },
      },
      include: {
        meetingType: {
          include: {
            user: true,
          },
        },
      },
    });

    // Send cancellation emails to host and invitee
    try {
      const cancellationReason = payload.reason ? `\n\nReason: ${payload.reason}` : "";
      const cancellationHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Meeting Cancelled</h2>
          <p>The following meeting has been cancelled:</p>
          <ul>
            <li><strong>Meeting:</strong> ${booking.meetingType?.name || "Meeting"}</li>
            <li><strong>Date:</strong> ${new Date(booking.startTime).toLocaleString()}</li>
            <li><strong>Duration:</strong> ${booking.meetingType?.durationMinutes || 30} minutes</li>
          </ul>
          ${cancellationReason}
          <p>We apologize for any inconvenience.</p>
        </div>
      `;

      // Send to invitee
      if (booking.inviteeEmail) {
        await gmailDeliveryService.sendEmailViaGmail({
          userId: req.currentUser.id,
          to: booking.inviteeEmail,
          subject: `Meeting Cancelled: ${booking.meetingType?.name || "Meeting"}`,
          bodyHtml: cancellationHtml,
        });
      }

      // Send to host (if different from current user)
      if (updated.meetingType?.user?.email && updated.meetingType.user.email !== req.currentUser.email) {
        await gmailDeliveryService.sendEmailViaGmail({
          userId: req.currentUser.id,
          to: updated.meetingType.user.email,
          subject: `Meeting Cancelled: ${booking.meetingType?.name || "Meeting"}`,
          bodyHtml: cancellationHtml,
        });
      }

      logger.info({ bookingId: booking.id }, "Sent cancellation emails");
    } catch (error) {
      logger.error({ error, bookingId: booking.id }, "Failed to send cancellation emails");
      // Continue even if email sending fails
    }

    res.status(200).json({
      booking: {
        id: updated.id,
        status: updated.status,
      },
    });
  } catch (error) {
    next(error);
  }
});



