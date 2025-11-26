import { addMinutes } from "date-fns";
import { Router } from "express";
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

bookingRouter.get("/book/:token", async (req, res, next) => {
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
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 6px;
        padding: 16px;
        border-radius: 14px;
        border: 1px solid #cbd5f5;
        background: #ffffff;
        cursor: pointer;
        transition: border 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        text-align: left;
      }
      .slot-choice:hover {
        border-color: #6366f1;
        box-shadow: 0 12px 24px rgba(99, 102, 241, 0.15);
        transform: translateY(-1px);
      }
      .slot-choice.active {
        border-color: #4f46e5;
        background: #eef2ff;
        box-shadow: 0 16px 32px rgba(79, 70, 229, 0.2);
      }
      .slot-choice-time {
        font-weight: 600;
        color: #312e81;
      }
      .slot-choice-label {
        font-size: 14px;
        color: #4338ca;
      }
      .slot-choice-reason {
        font-size: 13px;
        color: #475569;
      }
      .cta-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
      }
      .cta-row .cta-hint {
        font-size: 13px;
        color: #64748b;
      }
      .availability-grid {
        display: grid;
        gap: 12px;
      }
      .feedback-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }
      .feedback-button {
        flex: 1 1 220px;
        padding: 14px 16px;
        border-radius: 12px;
        border: 1px solid #cbd5f5;
        background: #ffffff;
        color: #334155;
        font-weight: 600;
        cursor: pointer;
        transition: border 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        text-align: left;
      }
      .feedback-button:hover {
        border-color: #6366f1;
        box-shadow: 0 10px 24px rgba(99, 102, 241, 0.18);
        transform: translateY(-1px);
      }
      .feedback-button.secondary {
        background: #eef2ff;
        border-color: #cbd5f5;
      }
      .small-print {
        font-size: 12px;
        color: #64748b;
        margin-top: 10px;
      }
      footer {
        padding: 24px 32px;
        font-size: 12px;
        color: #64748b;
        text-align: center;
        background: #f8fafc;
      }
      @media (max-width: 600px) {
        header, .content, footer {
          padding: 24px;
        }
        header h1 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <header>
        <h1>${escapeHtml(meetingType.name)}</h1>
        <p>Hosted by ${escapeHtml(host?.displayName ?? host?.email ?? "your host")}</p>
        <p>${escapeHtml(meetingType.description ?? "")}</p>
      </header>
      <div class="content">
        <section class="section">
          <h2>Confirm your details</h2>
          <form class="form-row" id="booking-form">
            <label>
              Name
              <input type="text" id="guest-name" name="name" placeholder="Your full name" value="${escapeHtml(namePrefill)}" />
            </label>
            <label>
              Email
              <input type="email" id="guest-email" name="email" placeholder="you@example.com" value="${escapeHtml(emailPrefill)}" />
            </label>
            <label>
              Agenda (optional)
              <textarea id="guest-notes" name="notes" placeholder="Share anything you'd like us to know before we meet." rows="3"></textarea>
            </label>
          </form>
        </section>
        <section class="section" id="recommendation">
          <h2>Recommended times</h2>
          ${needsSync || availabilityMessage ? `
            <div style="padding: 16px; background: #fef3c7; border: 1px solid #fbbf24; border-radius: 12px; margin-bottom: 16px;">
              <p style="margin: 0; color: #92400e; font-size: 14px;">
                <strong>⚠️ Calendar sync needed:</strong> ${escapeHtml(availabilityMessage || "The host needs to sync their calendar to show available times.")}
              </p>
            </div>
          ` : `
            <p class="section-support">We analyzed the host calendar to surface high-confidence openings.</p>
          `}
          <div class="slot-card" id="top-recommendation">
            <strong id="recommended-slot">${escapeHtml(suggestedSlotDisplay)}</strong>
            <span id="recommended-details">${meetingType.durationMinutes} minute meeting • ${escapeHtml(timeZone ?? "Local time")}</span>
            <span id="recommended-note" class="slot-choice-reason"></span>
          </div>
          <div class="recommendations-grid" id="recommendation-options">
            <span>Loading suggestions…</span>
          </div>
          <div class="cta-row">
            <button class="cta-button" id="accept-slot">Book selected time</button>
            <span class="cta-hint" id="selected-slot-copy"></span>
          </div>
        </section>
        <section class="section">
          <h2>Pick another time</h2>
          ${needsSync ? `
            <div style="padding: 20px; text-align: center; color: #64748b;">
              <p>Calendar availability will be shown once the host syncs their calendar.</p>
              <p style="font-size: 13px; margin-top: 8px;">Please contact the host or try again later.</p>
            </div>
          ` : `
            <div class="availability-grid" id="availability-grid">
              <span>Loading availability…</span>
            </div>
          `}
        </section>
        <section class="section" id="alternatives">
          <h2>Need something else?</h2>
          <p class="section-support">Let us know what works better and we 'll coordinate with the host.</p>
          <div class="feedback-grid">
            <button class="feedback-button" id="feedback-propose">Propose different times</button>
            <button class="feedback-button secondary" id="feedback-notify">Notify me when new slots open</button>
            <button class="feedback-button" id="feedback-message">Message the host</button>
          </div>
          <p class="small-print" id="feedback-status"></p>
        </section>
        <section class="section">
          <h2>Meeting location</h2>
          <p>${escapeHtml(meetingType.meetingLocationType === "GOOGLE_MEET" ? "Google Meet link will be provided once booked." : meetingType.meetingLocationValue ?? "Confirmed after booking.")}</p>
        </section>
      </div>
      <footer>
        Need a different time? Reply to the invitation email and we’ll make it work.
      </footer>
    </div>
    <script>
      window.BOOKING_DATA = ${availabilityPayload};
      const data = window.BOOKING_DATA || {};
      const grid = document.getElementById("availability-grid");
      const highlightSlot = document.getElementById("recommended-slot");
      const highlightMeta = document.getElementById("recommended-details");
      const highlightNote = document.getElementById("recommended-note");
      const recommendationOptions = document.getElementById("recommendation-options");
      const selectionCopy = document.getElementById("selected-slot-copy");
      const acceptButton = document.getElementById("accept-slot");
      const feedbackStatus = document.getElementById("feedback-status");
      const emailInput = document.getElementById("guest-email");
      const nameInput = document.getElementById("guest-name");
      const reminderEndpoint = window.location.pathname.replace(/\/$/, "") + "/reminders";

      const escapeHtmlClient = (value) => {
        if (typeof value !== "string") return "";
        return value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      };

      const formatSlot = (startIso, endIso) => {
        if (!startIso || !endIso) return "";
        const options = {
          weekday: "short",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        };
        if (data.meeting?.timeZone) {
          options.timeZone = data.meeting.timeZone;
        }
        const formatter = new Intl.DateTimeFormat(undefined, options);
        const startLabel = formatter.format(new Date(startIso));
        const endLabel = formatter.format(new Date(endIso));
        return startLabel + " – " + endLabel;
      };

      let selectedRecommendation = null;

      const updateSelectionCopy = () => {
        if (!selectionCopy) return;
        if (!selectedRecommendation) {
          selectionCopy.textContent = "Select a suggested slot or browse other availability below.";
          return;
        }
        const slotSummary = formatSlot(selectedRecommendation.start, selectedRecommendation.end);
        selectionCopy.textContent = "Selected: " + slotSummary + " • " + (selectedRecommendation.label || "Smart suggestion");
      };

      const applyHighlight = () => {
        if (selectedRecommendation && highlightSlot) {
          highlightSlot.textContent = formatSlot(selectedRecommendation.start, selectedRecommendation.end);
        } else if (data.meeting?.suggestedSlot && highlightSlot) {
          highlightSlot.textContent = data.meeting.suggestedSlot;
        }
        if (highlightMeta) {
          const duration = data.meeting?.durationMinutes
            ? data.meeting.durationMinutes + " minute meeting"
            : "";
          const tz = data.meeting?.timeZone || "Local time";
          highlightMeta.textContent = duration ? duration + " • " + tz : tz;
        }
        if (highlightNote) {
          if (selectedRecommendation) {
            const labelText = selectedRecommendation.label || "";
            const descriptorText = selectedRecommendation.descriptor || "";
            highlightNote.textContent = labelText && descriptorText
              ? labelText + " • " + descriptorText
              : labelText || descriptorText;
          } else {
            highlightNote.textContent = "";
          }
        }
      };

      if (recommendationOptions) {
        if (Array.isArray(data.recommendations) && data.recommendations.length) {
          selectedRecommendation = data.recommendations[0];
          applyHighlight();
          updateSelectionCopy();
          recommendationOptions.innerHTML = data.recommendations
            .map((rec, index) => {
              const slotText = formatSlot(rec.start, rec.end);
              return (
                '<button type="button" class="slot-choice' +
                (index === 0 ? " active" : "") +
                '" data-index="' + index + '">' +
                '<span class="slot-choice-time">' + escapeHtmlClient(slotText) + "</span>" +
                '<span class="slot-choice-label">' + escapeHtmlClient(rec.label || "") + "</span>" +
                '<span class="slot-choice-reason">' + escapeHtmlClient(rec.descriptor || "") + "</span>" +
                "</button>"
              );
            })
            .join("");
          recommendationOptions.querySelectorAll(".slot-choice").forEach((button) => {
            button.addEventListener("click", () => {
              const index = Number.parseInt(button.getAttribute("data-index"), 10);
              if (Number.isNaN(index) || !data.recommendations[index]) {
                return;
              }
              selectedRecommendation = data.recommendations[index];
              recommendationOptions.querySelectorAll(".slot-choice").forEach((b) => b.classList.remove("active"));
              button.classList.add("active");
              applyHighlight();
              updateSelectionCopy();
            });
          });
        } else {
          applyHighlight();
          updateSelectionCopy();
          recommendationOptions.innerHTML = '<span>No smart suggestions yet. Pick a time below that works best for you.</span>';
        }
      } else {
        applyHighlight();
        updateSelectionCopy();
      }

      const availability = data.availability || [];
      if (grid) {
        if (!availability.length) {
          grid.innerHTML = '<span>No slots available yet. We\'ll notify you when new times appear.</span>';
        } else {
          grid.innerHTML = availability.slice(0, 6)
            .map((day) => {
              const busySlots = (day.slots || [])
                .filter((slot) => slot.status === "busy")
                .map((slot) => {
                  const start = new Date(slot.start);
                  const end = new Date(slot.end);
                  return '<li>' + start.toLocaleString() + ' – ' + end.toLocaleTimeString() + '</li>';
                })
                .join('');
              const dateLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' });
              const slotContent = busySlots
                ? '<ul>' + busySlots + '</ul>'
                : '<span>Looks free! Choose a time that works for you.</span>';
              return '<div class="slot-card"><strong>' + dateLabel + '</strong>' + slotContent + '<button class="cta-button" data-day="' + day.date + '">View times</button></div>';
            })
            .join('');
        }
      }

      document.querySelectorAll('.cta-button[data-day]').forEach((button) => {
        button.addEventListener('click', () => {
          alert('Interactive slot picker coming soon! For now, reply to the invite with preferred times.');
        });
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
          const bookingEndpoint = window.location.pathname.replace(/\/$/, "") + "/bookings";
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

      document.getElementById('feedback-propose')?.addEventListener('click', async () => {
        const proposal = prompt('Share a few windows that work for you, and we\'ll relay them to the host:');
        if (feedbackStatus) {
          if (proposal) {
            const result = await sendReminderRequest('propose', proposal);
            if (result.ok) {
              feedbackStatus.textContent = 'Got it! We\'ll nudge the host with your preferred times.';
            }
          } else {
            feedbackStatus.textContent = 'No worries—feel free to suggest times whenever you\'re ready.';
          }
        }
      });
      document.getElementById('feedback-notify')?.addEventListener('click', async () => {
        const result = await sendReminderRequest('notify');
        if (feedbackStatus && result.ok) {
          feedbackStatus.textContent = 'All set! We\'ll email you as soon as new slots open up.';
        }
      });
      document.getElementById('feedback-message')?.addEventListener('click', () => {
        void sendReminderRequest('manual');
        const hostEmail = data.host?.email;
        if (hostEmail) {
          window.location.href = 'mailto:' + hostEmail + '?subject=Scheduling%20Question&body=Hi%20there%2C%0A%0A';
          if (feedbackStatus) {
            feedbackStatus.textContent = 'Opening an email draft so you can message the host directly.';
          }
        } else if (feedbackStatus) {
          feedbackStatus.textContent = 'Reply to the invitation email and we\'ll coordinate the rest.';
        }
      });

      const sendReminderRequest = async (reason, note) => {
        const emailValue = emailInput?.value?.trim();
        if (!emailValue) {
          if (feedbackStatus) {
            feedbackStatus.textContent = "Add your email so we can follow up with new times.";
          }
          emailInput?.focus();
          return { ok: false };
        }
        const payload = {
          email: emailValue,
          name: nameInput?.value?.trim() || undefined,
          reason,
          note: note || undefined,
          selectedSlot: selectedRecommendation
            ? { start: selectedRecommendation.start, end: selectedRecommendation.end }
            : undefined,
        };
        try {
          const response = await fetch(reminderEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error("Request failed");
          }
          return { ok: true };
        } catch (error) {
          if (feedbackStatus) {
            feedbackStatus.textContent = 'We couldn\'t save your reminder just now. Try again in a moment.';
          }
          return { ok: false, error };
        }
      };
    </script>
  </body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    next(error);
  }
});

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
