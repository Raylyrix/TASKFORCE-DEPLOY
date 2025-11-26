/**
 * Booking Service
 * 
 * Handles meeting booking creation, calendar integration, and workflow automation.
 * 
 * Features:
 * - Creates meeting bookings from public booking pages
 * - Integrates with Google Calendar to create events
 * - Generates conference URLs (Google Meet)
 * - Triggers workflows when meetings are booked
 * - Manages booking status and metadata
 * 
 * @module services/bookingService
 */

import { google } from "googleapis";
import { addMinutes } from "date-fns";

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { googleAuthService } from "./googleAuth";

type CreateBookingInput = {
  meetingTypeId: string;
  bookingLinkId: string | null;
  userId: string;
  inviteeEmail: string;
  inviteeName: string | null;
  startTime: Date;
  endTime: Date;
  notes?: string | null;
};

export const bookingService = {
  async createBooking(input: CreateBookingInput) {
    // Get meeting type with calendar connection
    const meetingType = await prisma.meetingType.findUnique({
      where: { id: input.meetingTypeId },
      include: {
        calendarConnection: true,
        user: true,
      },
    });

    if (!meetingType) {
      throw new Error("Meeting type not found");
    }

    if (!meetingType.calendarConnection) {
      throw new Error("Meeting type does not have a calendar connection");
    }

    if (meetingType.userId !== input.userId) {
      throw new Error("Meeting type does not belong to user");
    }

    // Create calendar event
    let calendarEventId: string | null = null;
    let conferenceUrl: string | null = null;

    try {
      const authClient = await googleAuthService.getAuthorizedClientForUser(input.userId);
      const calendar = google.calendar({ version: "v3", auth: authClient });

      const calendarId = meetingType.calendarConnection.defaultCalendarId ?? "primary";

      // Prepare event data
      const eventData: {
        summary: string;
        description?: string;
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
        attendees: Array<{ email: string; displayName?: string }>;
        conferenceData?: {
          createRequest: {
            requestId: string;
            conferenceSolutionKey: { type: "hangoutsMeet" };
          };
        };
        location?: string;
        reminders?: {
          useDefault: boolean;
        };
      } = {
        summary: meetingType.name,
        description: meetingType.description ?? undefined,
        start: {
          dateTime: input.startTime.toISOString(),
          timeZone: meetingType.calendarConnection.timeZone ?? "UTC",
        },
        end: {
          dateTime: input.endTime.toISOString(),
          timeZone: meetingType.calendarConnection.timeZone ?? "UTC",
        },
        attendees: [
          {
            email: input.inviteeEmail,
            displayName: input.inviteeName ?? undefined,
          },
        ],
        reminders: {
          useDefault: true,
        },
      };

      // Add Google Meet link if meeting location is GOOGLE_MEET
      if (meetingType.meetingLocationType === "GOOGLE_MEET") {
        eventData.conferenceData = {
          createRequest: {
            requestId: `${input.meetingTypeId}-${Date.now()}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
      } else if (meetingType.meetingLocationType === "CUSTOM_URL" && meetingType.meetingLocationValue) {
        eventData.location = meetingType.meetingLocationValue;
      } else if (meetingType.meetingLocationType === "PHONE" && meetingType.meetingLocationValue) {
        eventData.description = `${meetingType.description ?? ""}\n\nPhone: ${meetingType.meetingLocationValue}`.trim();
      }

      // Add notes if provided
      if (input.notes) {
        eventData.description = `${eventData.description ?? ""}\n\nNotes: ${input.notes}`.trim();
      }

      const event = await calendar.events.insert({
        calendarId,
        requestBody: eventData,
        conferenceDataVersion: meetingType.meetingLocationType === "GOOGLE_MEET" ? 1 : 0,
        sendUpdates: "all", // Send email invitations to all attendees
      });

      calendarEventId = event.data.id ?? null;
      conferenceUrl = event.data.conferenceData?.entryPoints?.[0]?.uri ?? null;

      logger.info(
        {
          userId: input.userId,
          meetingTypeId: input.meetingTypeId,
          calendarEventId,
          inviteeEmail: input.inviteeEmail,
        },
        "Created Google Calendar event for booking",
      );

      // Try to add event to recipient's calendar if they have a calendar connection
      // Note: Google Calendar invitations (sendUpdates: "all") automatically add events
      // to recipients' calendars, but we can also create it directly if they're a user
      try {
        const inviteeUser = await prisma.user.findUnique({
          where: { email: input.inviteeEmail },
          include: {
            calendarConnections: {
              where: {
                provider: "GOOGLE",
              },
              take: 1,
            },
          },
        });

        if (inviteeUser && inviteeUser.calendarConnections.length > 0) {
          const inviteeConnection = inviteeUser.calendarConnections[0];
          
          try {
            const inviteeAuthClient = await googleAuthService.getAuthorizedClientForUser(inviteeUser.id);
            const inviteeCalendar = google.calendar({ version: "v3", auth: inviteeAuthClient });
            const inviteeCalendarId = inviteeConnection.defaultCalendarId ?? "primary";

            // Create the same event in recipient's calendar
            // This ensures it appears even if they haven't accepted the invitation yet
            await inviteeCalendar.events.insert({
              calendarId: inviteeCalendarId,
              requestBody: {
                summary: eventData.summary,
                description: eventData.description,
                start: eventData.start,
                end: eventData.end,
                attendees: [
                  {
                    email: meetingType.user.email,
                    displayName: meetingType.user.displayName ?? undefined,
                  },
                ],
                location: eventData.location,
                conferenceData: eventData.conferenceData,
                reminders: eventData.reminders,
              },
              sendUpdates: "none", // Don't send another email, already sent from host's calendar
            });

            logger.info(
              {
                inviteeUserId: inviteeUser.id,
                inviteeEmail: input.inviteeEmail,
                calendarEventId,
              },
              "Added booking event to recipient's calendar",
            );
          } catch (authError) {
            // If auth fails, that's okay - the invitation email will still work
            logger.warn(
              { error: authError, inviteeEmail: input.inviteeEmail },
              "Could not authenticate recipient calendar (non-critical)",
            );
          }
        }
      } catch (error) {
        // Non-critical: if recipient doesn't have calendar connection or creation fails,
        // the email invitation from host's calendar will still add it to their calendar
        logger.warn(
          { error, inviteeEmail: input.inviteeEmail },
          "Could not add event to recipient's calendar (non-critical)",
        );
      }
    } catch (error) {
      logger.error(
        { error, userId: input.userId, meetingTypeId: input.meetingTypeId },
        "Failed to create Google Calendar event",
      );
      // Continue to create booking record even if calendar event creation fails
    }

    // Create booking record
    const booking = await prisma.meetingBooking.create({
      data: {
        meetingTypeId: input.meetingTypeId,
        bookingLinkId: input.bookingLinkId,
        userId: input.userId,
        calendarEventId,
        conferenceUrl,
        startTime: input.startTime,
        endTime: input.endTime,
        inviteeEmail: input.inviteeEmail,
        inviteeName: input.inviteeName,
        status: "PENDING",
        metadata: {
          notes: input.notes ?? null,
        },
      },
      include: {
        meetingType: true,
        user: true,
      },
    });

    logger.info({ bookingId: booking.id, userId: input.userId }, "Created meeting booking");

    // Trigger workflows for meeting booked event
    try {
      const { workflowTriggerService } = await import("./workflowTrigger.js");
      await workflowTriggerService.triggerMeetingBooked(input.userId, {
        bookingId: booking.id,
        meetingTypeId: input.meetingTypeId,
        inviteeEmail: input.inviteeEmail,
        inviteeName: input.inviteeName ?? undefined,
        startTime: input.startTime,
        endTime: input.endTime,
      });
    } catch (error) {
      logger.error({ error, bookingId: booking.id }, "Failed to trigger workflows for meeting booked");
      // Don't fail booking creation if workflow trigger fails
    }

    return booking;
  },
};

