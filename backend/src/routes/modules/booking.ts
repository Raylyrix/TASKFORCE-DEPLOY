import { addMinutes } from "date-fns";
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma";
import { calendarAvailabilityService } from "../../services/calendarAvailability";
import {
  computeSmartRecommendations,
  formatSlotRange,
  generateSuggestedSlot,
  type SmartRecommendation,
} from "../../services/meetingRecommendations";
import { meetingRemindersService } from "../../services/meetingReminders";
import { bookingService } from "../../services/bookingService";
import { escapeHtml } from "../../utils/escapeHtml";

export const bookingRouter = Router();

const isoString = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid datetime" });

const reminderRequestSchema = z.object({
  email: z.string().email("Provide a valid email so we can reach you."),
  name: z.string().trim().max(200).optional(),
  reason: z.enum(["notify", "propose", "manual"]).optional(),
  note: z.string().trim().max(2000).optional(),
  selectedSlot: z
    .object({
      start: isoString,
      end: isoString,
    })
    .optional(),
});

// Export the handler function so it can be reused
export const handleBookingPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const namePrefill = typeof req.query.name === "string" ? req.query.name : "";
    const emailPrefill = typeof req.query.email === "string" ? req.query.email : "";

    const bookingLink = await prisma.bookingLink.findUnique({
    where: { token },
    include: {
      meetingType: {
        include: {
          user: true,
          calendarConnection: true,
        },
      },
    },
  });

  if (!bookingLink || !bookingLink.meetingType) {
    res.status(404).send("Booking link not found");
    return;
  }

  const meetingType = bookingLink.meetingType;
  const host = meetingType.user;
  const timeZone = meetingType.calendarConnection?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Check if calendar connection exists
  if (!meetingType.calendarConnection) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Calendar Connection Required</title>
          <style>
            body {
              font-family: system-ui, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f7fb;
            }
            .error-card {
              background: white;
              padding: 40px;
              border-radius: 16px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              max-width: 500px;
              text-align: center;
            }
            h1 { color: #dc2626; margin: 0 0 16px; }
            p { color: #64748b; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="error-card">
            <h1>Calendar Connection Required</h1>
            <p>This meeting type requires a calendar connection to function. Please contact the host to set up their calendar connection.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  const availabilityResponse = await calendarAvailabilityService.getAvailability({
    userId: meetingType.userId,
    start: new Date().toISOString(),
    end: addMinutes(new Date(), 14 * 24 * 60).toISOString(),
    meetingTypeId: meetingType.id,
  });

  // Check if availability sync is needed
  const needsSync = availabilityResponse.metadata?.needsSync ?? false;
  const availabilityMessage = availabilityResponse.metadata?.message;

  const recommendations = computeSmartRecommendations(
    availabilityResponse.availability,
    meetingType.durationMinutes,
    timeZone,
  );

  const suggestedSlotDisplay =
    recommendations.length > 0
      ? formatSlotRange(recommendations[0].start, recommendations[0].end, timeZone)
      : generateSuggestedSlot(timeZone, meetingType.durationMinutes);

  const availabilityPayload = JSON.stringify({
    availability: availabilityResponse.availability,
    metadata: availabilityResponse.metadata,
    meeting: {
      name: meetingType.name,
      durationMinutes: meetingType.durationMinutes,
      locationType: meetingType.meetingLocationType,
      locationValue: meetingType.meetingLocationValue,
      description: meetingType.description,
      timeZone: timeZone ?? "UTC",
      suggestedSlot: suggestedSlotDisplay,
    },
    host: {
      name: host?.displayName ?? bookingLink.meetingType.name,
      email: host?.email ?? "",
    },
    recommendations,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(meetingType.name)} • Schedule</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Inter", "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(135deg, #f5f7fb 0%, #ffffff 60%, #eff2ff 100%);
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 40px 16px;
      }
      .card {
        background: #ffffffcc;
        backdrop-filter: blur(8px);
        border-radius: 24px;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.12);
        max-width: 720px;
        width: 100%;
        overflow: hidden;
        border: 1px solid rgba(99, 102, 241, 0.08);
      }
      header {
        padding: 32px;
        background: radial-gradient(circle at top left, rgba(59, 130, 246, 0.15), transparent), #ffffff;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      header h1 {
        margin: 0;
        font-size: 28px;
        color: #0f172a;
      }
      header p {
        margin: 0;
        color: #475569;
      }
      .content {
        padding: 32px;
        display: grid;
        gap: 24px;
        background: #fff;
      }
      .section {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 20px;
        background: #f8fafc;
      }
      .section h2 {
        margin: 0 0 12px;
        font-size: 18px;
        color: #0f172a;
      }
      .section p {
        margin: 0;
        color: #475569;
        line-height: 1.6;
      }
      .section-support {
        margin: 0 0 16px;
        color: #64748b;
        font-size: 14px;
      }
      .form-row {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .form-row label {
        font-weight: 600;
        color: #334155;
      }
      .form-row input, .form-row textarea, .form-row select {
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid #cbd5f5;
        font-size: 15px;
        transition: border 0.2s ease, box-shadow 0.2s ease;
      }
      .form-row input:focus, .form-row textarea:focus, .form-row select:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
        outline: none;
      }
      .slot-card {
        border: 1px solid #cbd5f5;
        border-radius: 14px;
        padding: 16px;
        background: #eef2ff;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .slot-card strong {
        color: #312e81;
      }
      .recommendations-grid {
        display: grid;
        gap: 12px;
      }
      .slot-choice {
        border: 2px solid #cbd5f5;
        border-radius: 12px;
        padding: 16px;
        background: #ffffff;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }
      .slot-choice:hover {
        border-color: #6366f1;
        background: #eef2ff;
      }
      .slot-choice.selected {
        border-color: #6366f1;
        background: #eef2ff;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.12);
      }
      .slot-choice strong {
        display: block;
        color: #0f172a;
        margin-bottom: 4px;
      }
      .slot-choice span {
        color: #64748b;
        font-size: 14px;
      }
      .cta-button {
        background: #6366f1;
        color: #ffffff;
        border: none;
        border-radius: 12px;
        padding: 14px 24px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        width: 100%;
        margin-top: 16px;
      }
      .cta-button:hover:not(:disabled) {
        background: #4f46e5;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }
      .cta-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .feedback-section {
        margin-top: 24px;
        padding-top: 24px;
        border-top: 1px solid #e2e8f0;
      }
      .feedback-buttons {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .feedback-button {
        background: #f1f5f9;
        border: 1px solid #cbd5f5;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .feedback-button:hover {
        background: #e2e8f0;
        border-color: #94a3b8;
      }
      .status-message {
        padding: 12px;
        border-radius: 8px;
        margin-top: 12px;
        font-size: 14px;
      }
      .status-message.success {
        background: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
      }
      .status-message.error {
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <header>
        <h1>${escapeHtml(meetingType.name)}</h1>
        ${meetingType.description ? `<p>${escapeHtml(meetingType.description)}</p>` : ""}
        <p class="section-support">Duration: ${meetingType.durationMinutes} minutes</p>
      </header>
      <div class="content">
        <div class="section">
          <h2>Select a time</h2>
          ${needsSync ? `<p class="section-support">${availabilityMessage || "Syncing calendar availability..."}</p>` : ""}
          <div class="recommendations-grid" id="recommendations">
            ${recommendations.length > 0
              ? recommendations
                  .slice(0, 6)
                  .map(
                    (rec) => `
              <button class="slot-choice" data-start="${rec.start}" data-end="${rec.end}">
                <strong>${formatSlotRange(rec.start, rec.end, timeZone)}</strong>
                <span>Recommended time</span>
              </button>
            `,
                  )
                  .join("")
              : `<p class="section-support">No available times found. Please use the feedback options below to propose alternative times.</p>`}
          </div>
        </div>
        <div class="section">
          <h2>Your information</h2>
          <div class="form-row">
            <label for="guest-email">Email <span style="color: #dc2626;">*</span></label>
            <input type="email" id="guest-email" placeholder="your.email@example.com" value="${escapeHtml(emailPrefill)}" required />
          </div>
          <div class="form-row">
            <label for="guest-name">Name</label>
            <input type="text" id="guest-name" placeholder="Your name" value="${escapeHtml(namePrefill)}" />
          </div>
          <div class="form-row">
            <label for="guest-notes">Additional notes (optional)</label>
            <textarea id="guest-notes" rows="3" placeholder="Any additional information..."></textarea>
          </div>
          <button class="cta-button" id="accept-button">Book selected time</button>
          <div id="status-message"></div>
        </div>
        <div class="feedback-section">
          <h2 style="font-size: 16px; margin: 0 0 12px; color: #475569;">Can't find a time that works?</h2>
          <div class="feedback-buttons">
            <button class="feedback-button" id="feedback-notify">Notify me when new times appear</button>
            <button class="feedback-button" id="feedback-propose">Propose alternative times</button>
          </div>
          <div id="feedback-status"></div>
        </div>
      </div>
    </div>
    <script>
      const availabilityData = ${availabilityPayload};
      let selectedRecommendation = null;
      const recommendationsGrid = document.getElementById('recommendations');
      const acceptButton = document.getElementById('accept-button');
      const emailInput = document.getElementById('guest-email');
      const nameInput = document.getElementById('guest-name');
      const statusMessage = document.getElementById('status-message');
      const feedbackStatus = document.getElementById('feedback-status');

      document.querySelectorAll('.slot-choice').forEach((button) => {
        button.addEventListener('click', () => {
          document.querySelectorAll('.slot-choice').forEach((b) => b.classList.remove('selected'));
          button.classList.add('selected');
          selectedRecommendation = {
            start: button.dataset.start,
            end: button.dataset.end,
          };
        });
      });

      const sendReminderRequest = async (reason, note) => {
        const emailValue = emailInput?.value?.trim();
        if (!emailValue) {
          alert('Please enter your email address first.');
          emailInput?.focus();
          return { ok: false };
        }
        const nameValue = nameInput?.value?.trim() || '';
        const response = await fetch(window.location.pathname.replace(/\\/$/, "") + "/reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: emailValue,
            name: nameValue || undefined,
            reason,
            note: note || undefined,
            selectedSlot: selectedRecommendation || undefined,
          }),
        });
        return response;
      };

      document.getElementById('feedback-notify')?.addEventListener('click', async () => {
        const result = await sendReminderRequest('notify');
        if (result.ok) {
          if (feedbackStatus) {
            feedbackStatus.innerHTML = '<div class="status-message success">Got it! We\\'ll notify you when new times appear.</div>';
          }
        } else {
          if (feedbackStatus) {
            feedbackStatus.innerHTML = '<div class="status-message error">Failed to register notification. Please try again.</div>';
          }
        }
      });

      document.getElementById('feedback-propose')?.addEventListener('click', async () => {
        const proposal = prompt('Share a few windows that work for you, and we\\'ll relay them to the host:');
        if (feedbackStatus) {
          if (proposal) {
            const result = await sendReminderRequest('propose', proposal);
            if (result.ok) {
              feedbackStatus.innerHTML = '<div class="status-message success">Got it! We\\'ll relay your proposed times to the host.</div>';
            } else {
              feedbackStatus.innerHTML = '<div class="status-message error">Failed to send proposal. Please try again.</div>';
            }
          }
        }
      });

      acceptButton?.addEventListener('click', async (event) => {
        event.preventDefault();
        if (!selectedRecommendation) {
          alert('Select one of the suggested slots or choose a time below to continue.');
          return;
        }
        const emailValue = emailInput?.value?.trim();
        if (!emailValue) {
          alert('Please enter your email address to book the meeting.');
          emailInput?.focus();
          return;
        }
        const nameValue = nameInput?.value?.trim() || '';
        const notesValue = document.getElementById('guest-notes')?.value?.trim() || '';
        
        if (acceptButton) {
          acceptButton.disabled = true;
          acceptButton.textContent = 'Booking...';
        }
        
        try {
          const bookingEndpoint = window.location.pathname.replace(/\\/$/, "") + "/bookings";
          const response = await fetch(bookingEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: emailValue,
              name: nameValue || undefined,
              notes: notesValue || undefined,
              start: selectedRecommendation.start,
              end: selectedRecommendation.end,
            }),
          });
          
          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: "Booking failed" }));
            throw new Error(error.error || "Failed to book meeting");
          }
          
          const result = await response.json();
          const slotSummary = formatSlot(selectedRecommendation.start, selectedRecommendation.end);
          
          // Show success message
          if (acceptButton) {
            acceptButton.textContent = '✓ Booked!';
            acceptButton.style.background = '#34a853';
            acceptButton.style.color = '#fff';
          }
          
          // Show confirmation
          const confirmationMessage = result.booking?.conferenceUrl
            ? 'Meeting booked! Check your email for the calendar invitation and Google Meet link: ' + result.booking.conferenceUrl
            : 'Meeting booked for ' + slotSummary + '! Check your email for the calendar invitation.';
          alert(confirmationMessage);
          
          // Optionally redirect or show success page
          if (result.booking?.conferenceUrl) {
            setTimeout(() => {
              window.open(result.booking.conferenceUrl, '_blank');
            }, 1000);
          }
        } catch (error) {
          if (acceptButton) {
            acceptButton.disabled = false;
            acceptButton.textContent = 'Book selected time';
          }
          alert('Failed to book meeting: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
      });

      const formatSlot = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return startDate.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + 
               ' - ' + endDate.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      };
    </script>
  </body>
</html>`;

  res.send(html);
  } catch (error) {
    next(error);
  }
};

// JSON API endpoint for React booking page
bookingRouter.get("/book/:token/data", async (req, res, next) => {
  try {
    const { token } = req.params;

    const bookingLink = await prisma.bookingLink.findUnique({
      where: { token },
      include: {
        meetingType: {
          include: {
            user: true,
            calendarConnection: true,
          },
        },
      },
    });

    if (!bookingLink || !bookingLink.meetingType) {
      res.status(404).json({ error: "Booking link not found" });
      return;
    }

    const meetingType = bookingLink.meetingType;
    const host = meetingType.user;
    const timeZone = meetingType.calendarConnection?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (!meetingType.calendarConnection) {
      res.status(400).json({ error: "Calendar connection required" });
      return;
    }

    const availabilityResponse = await calendarAvailabilityService.getAvailability({
      userId: meetingType.userId,
      start: new Date().toISOString(),
      end: addMinutes(new Date(), 14 * 24 * 60).toISOString(),
      meetingTypeId: meetingType.id,
    });

    const recommendations = computeSmartRecommendations(
      availabilityResponse.availability,
      meetingType.durationMinutes,
      timeZone,
    );

    res.status(200).json({
      meeting: {
        name: meetingType.name,
        description: meetingType.description,
        durationMinutes: meetingType.durationMinutes,
        locationType: meetingType.meetingLocationType,
        locationValue: meetingType.meetingLocationValue,
        timeZone,
      },
      host: {
        name: host?.displayName ?? meetingType.name,
        email: host?.email ?? "",
      },
      availability: availabilityResponse.availability,
      recommendations: recommendations.map((rec) => ({
        start: rec.start,
        end: rec.end,
        score: rec.score,
      })),
      metadata: availabilityResponse.metadata,
    });
  } catch (error) {
    next(error);
  }
  });

// Note: handleBookingPage is exported and used in app.ts for the public route at /book/:token
// The bookingRouter routes below are mounted at /api, so they use /api/book/:token

const bookingRequestSchema = z.object({
  email: z.string().email("Provide a valid email so we can reach you."),
  name: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  start: isoString,
  end: isoString,
});

bookingRouter.post("/book/:token/bookings", async (req, res, next) => {
  try {
    const { token } = req.params;
    const parseResult = bookingRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
      return;
    }

    const bookingLink = await prisma.bookingLink.findUnique({
      where: { token },
      include: {
        meetingType: {
          include: {
            user: true,
            calendarConnection: true,
          },
        },
      },
    });

    if (!bookingLink || !bookingLink.meetingType) {
      res.status(404).json({ error: "Booking link not found" });
      return;
    }

    if (!bookingLink.meetingType.calendarConnection) {
      res.status(400).json({ error: "Meeting type does not have a calendar connection" });
      return;
    }

    const payload = parseResult.data;
    const startTime = new Date(payload.start);
    const endTime = new Date(payload.end);

    // Validate time range
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
      res.status(400).json({ error: "Invalid time range" });
      return;
    }

    if (startTime >= endTime) {
      res.status(400).json({ error: "Start time must be before end time" });
      return;
    }

    // Create booking
    const booking = await bookingService.createBooking({
      meetingTypeId: bookingLink.meetingType.id,
      bookingLinkId: bookingLink.id,
      userId: bookingLink.meetingType.userId,
      inviteeEmail: payload.email,
      inviteeName: payload.name ?? null,
      startTime,
      endTime,
      notes: payload.notes ?? null,
    });

    res.status(201).json({
      booking: {
        id: booking.id,
        status: booking.status,
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        conferenceUrl: booking.conferenceUrl,
        calendarEventId: booking.calendarEventId,
      },
    });
  } catch (error) {
    next(error);
  }
});

bookingRouter.post("/book/:token/reminders", async (req, res, next) => {
  const parseResult = reminderRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    return;
  }

  const { token } = req.params;

  const bookingLink = await prisma.bookingLink.findUnique({
    where: { token },
    include: {
      meetingType: {
        include: {
          user: true,
          bookingLinks: true,
          calendarConnection: true,
        },
      },
    },
  });

  if (!bookingLink || !bookingLink.meetingType) {
    res.status(404).json({ error: "Booking link not found" });
    return;
  }

  const payload = parseResult.data;

  try {
    const reminder = await meetingRemindersService.registerReminder({
      context: {
        meetingType: {
          id: bookingLink.meetingType.id,
          name: bookingLink.meetingType.name,
          durationMinutes: bookingLink.meetingType.durationMinutes,
          userId: bookingLink.meetingType.userId,
          user: bookingLink.meetingType.user,
          bookingLinks: bookingLink.meetingType.bookingLinks.map((link) => ({
            id: link.id,
            token: link.token,
          })),
          calendarConnection: bookingLink.meetingType.calendarConnection
            ? { timeZone: bookingLink.meetingType.calendarConnection.timeZone }
            : null,
        },
        bookingLink: {
          id: bookingLink.id,
          token: bookingLink.token,
        },
      },
      inviteeEmail: payload.email,
      inviteeName: payload.name,
      reason: payload.reason,
      note: payload.note ?? null,
      selectedSlot: payload.selectedSlot ?? null,
    });

    res.status(200).json({
      reminder: {
        id: reminder.id,
        status: reminder.status,
        nextSendAt: reminder.nextSendAt?.toISOString() ?? null,
        sendCount: reminder.sendCount,
      },
    });
  } catch (error) {
    next(error);
  }
});
