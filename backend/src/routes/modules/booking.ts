import { addMinutes } from "date-fns";
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";

import { AppConfig } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";
import { calendarAvailabilityService } from "../../services/calendarAvailability";
import {
  computeSmartRecommendations,
  formatSlotRange,
  generateSuggestedSlot,
  type SmartRecommendation,
} from "../../services/meetingRecommendations";
import { meetingRemindersService } from "../../services/meetingReminders";
import { bookingService } from "../../services/bookingService";
import { gmailDeliveryService } from "../../services/gmailDelivery";
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
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
      }
      
      :root {
        --color-bg: #fafafa;
        --color-surface: #ffffff;
        --color-text-primary: #1d1d1f;
        --color-text-secondary: #86868b;
        --color-text-tertiary: #a1a1a6;
        --color-border: #d2d2d7;
        --color-border-light: #e5e5ea;
        --color-primary: #007aff;
        --color-primary-hover: #0051d5;
        --color-primary-light: #e3f2fd;
        --color-success: #34c759;
        --color-success-light: #d4edda;
        --color-error: #ff3b30;
        --color-error-light: #f8d7da;
        --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
        --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
        --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
        --shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.16);
        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 16px;
        --radius-xl: 20px;
        --spacing-xs: 4px;
        --spacing-sm: 8px;
        --spacing-md: 16px;
        --spacing-lg: 24px;
        --spacing-xl: 32px;
        --spacing-2xl: 48px;
      }
      
      body {
        margin: 0;
        padding: 0;
        background: var(--color-bg);
        min-height: 100vh;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.47059;
        font-weight: 400;
        letter-spacing: -0.022em;
        color: var(--color-text-primary);
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: var(--spacing-xl) var(--spacing-md);
      }
      
      @media (max-width: 768px) {
        body {
          padding: var(--spacing-md) var(--spacing-sm);
        }
      }
      
      .container {
        max-width: 680px;
        width: 100%;
        margin: 0 auto;
      }
      
      .card {
        background: var(--color-surface);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        overflow: hidden;
        margin-bottom: var(--spacing-lg);
        border: 1px solid var(--color-border-light);
      }
      
      header {
        padding: var(--spacing-2xl) var(--spacing-xl) var(--spacing-xl);
        border-bottom: 1px solid var(--color-border-light);
        background: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), var(--color-surface));
      }
      
      header h1 {
        margin: 0 0 var(--spacing-sm);
        font-size: 32px;
        font-weight: 700;
        letter-spacing: -0.03em;
        color: var(--color-text-primary);
        line-height: 1.125;
      }
      
      header .description {
        margin: var(--spacing-md) 0 0;
        font-size: 19px;
        font-weight: 400;
        color: var(--color-text-secondary);
        line-height: 1.4211;
      }
      
      header .meta {
        margin: var(--spacing-md) 0 0;
        font-size: 15px;
        color: var(--color-text-tertiary);
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
      }
      
      header .meta-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
      }
      
      .content {
        padding: var(--spacing-xl);
      }
      
      @media (max-width: 768px) {
        header {
          padding: var(--spacing-xl) var(--spacing-lg);
        }
        
        header h1 {
          font-size: 28px;
        }
        
        .content {
          padding: var(--spacing-lg);
        }
      }
      
      .section {
        margin-bottom: var(--spacing-xl);
      }
      
      .section:last-child {
        margin-bottom: 0;
      }
      
      .section-title {
        margin: 0 0 var(--spacing-lg);
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.02em;
        color: var(--color-text-primary);
      }
      
      .section-subtitle {
        margin: var(--spacing-sm) 0 var(--spacing-lg);
        font-size: 15px;
        color: var(--color-text-secondary);
        line-height: 1.46667;
      }
      
      .recommendations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: var(--spacing-md);
        margin-bottom: var(--spacing-lg);
      }
      
      @media (max-width: 640px) {
        .recommendations-grid {
          grid-template-columns: 1fr;
        }
      }
      
      .slot-choice {
        position: relative;
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-lg);
        background: var(--color-surface);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
      }
      
      .slot-choice:hover {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
      
      .slot-choice.selected {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
      }
      
      .slot-choice.selected::before {
        content: '';
        position: absolute;
        top: var(--spacing-sm);
        right: var(--spacing-sm);
        width: 20px;
        height: 20px;
        background: var(--color-primary);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .slot-choice.selected::after {
        content: '✓';
        position: absolute;
        top: var(--spacing-sm);
        right: var(--spacing-sm);
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
        font-weight: 600;
      }
      
      .slot-choice .time {
        font-size: 17px;
        font-weight: 600;
        color: var(--color-text-primary);
        letter-spacing: -0.01em;
      }
      
      .slot-choice .label {
        font-size: 13px;
        color: var(--color-text-secondary);
        font-weight: 400;
      }
      
      .form-group {
        margin-bottom: var(--spacing-lg);
      }
      
      .form-group:last-child {
        margin-bottom: 0;
      }
      
      .form-label {
        display: block;
        margin-bottom: var(--spacing-sm);
        font-size: 15px;
        font-weight: 500;
        color: var(--color-text-primary);
      }
      
      .form-label .required {
        color: var(--color-error);
        margin-left: var(--spacing-xs);
      }
      
      .form-input,
      .form-textarea {
        width: 100%;
        padding: var(--spacing-md) var(--spacing-lg);
        font-size: 17px;
        font-family: inherit;
        line-height: 1.47059;
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-md);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        -webkit-appearance: none;
        appearance: none;
      }
      
      .form-input:focus,
      .form-textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 4px rgba(0, 122, 255, 0.1);
      }
      
      .form-textarea {
        resize: vertical;
        min-height: 100px;
      }
      
      .cta-button {
        width: 100%;
        padding: var(--spacing-md) var(--spacing-xl);
        font-size: 17px;
        font-weight: 600;
        font-family: inherit;
        letter-spacing: -0.01em;
        color: white;
        background: var(--color-primary);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        margin-top: var(--spacing-lg);
        -webkit-appearance: none;
        appearance: none;
      }
      
      .cta-button:hover:not(:disabled) {
        background: var(--color-primary-hover);
        transform: translateY(-1px);
        box-shadow: var(--shadow-md);
      }
      
      .cta-button:active:not(:disabled) {
        transform: translateY(0);
      }
      
      .cta-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      
      .cta-button.success {
        background: var(--color-success);
      }
      
      .feedback-section {
        margin-top: var(--spacing-xl);
        padding-top: var(--spacing-xl);
        border-top: 1px solid var(--color-border-light);
      }
      
      .feedback-title {
        margin: 0 0 var(--spacing-md);
        font-size: 17px;
        font-weight: 600;
        color: var(--color-text-primary);
      }
      
      .feedback-buttons {
        display: flex;
        gap: var(--spacing-sm);
        flex-wrap: wrap;
      }
      
      .feedback-button {
        padding: var(--spacing-sm) var(--spacing-lg);
        font-size: 15px;
        font-weight: 500;
        font-family: inherit;
        color: var(--color-text-primary);
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        -webkit-appearance: none;
        appearance: none;
      }
      
      .feedback-button:hover {
        background: var(--color-bg);
        border-color: var(--color-primary);
        color: var(--color-primary);
      }
      
      .status-message {
        padding: var(--spacing-md) var(--spacing-lg);
        border-radius: var(--radius-md);
        margin-top: var(--spacing-md);
        font-size: 15px;
        line-height: 1.46667;
        animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }
      
      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .status-message.success {
        background: var(--color-success-light);
        color: #155724;
        border: 1px solid #c3e6cb;
      }
      
      .status-message.error {
        background: var(--color-error-light);
        color: #721c24;
        border: 1px solid #f5c6cb;
      }
      
      .empty-state {
        padding: var(--spacing-2xl);
        text-align: center;
        color: var(--color-text-secondary);
      }
      
      .empty-state p {
        margin: 0;
        font-size: 15px;
        line-height: 1.46667;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <header>
          <h1>${escapeHtml(meetingType.name)}</h1>
          ${meetingType.description ? `<p class="description">${escapeHtml(meetingType.description)}</p>` : ""}
          <div class="meta">
            <div class="meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.6;">
                <path d="M8 0C3.58 0 0 3.58 0 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6S4.69 2 8 2s6 2.69 6 6-2.69 6-6 6zm.5-9H7v4l3.25 1.95.75-1.23L8.5 6.5V5z" fill="currentColor"/>
              </svg>
              <span>${meetingType.durationMinutes} minutes</span>
            </div>
            ${host?.displayName ? `
            <div class="meta-item">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity: 0.6;">
                <path d="M8 8a3 3 0 100-6 3 3 0 000 6zm0 1c-2.67 0-8 1.34-8 4v1h16v-1c0-2.66-5.33-4-8-4z" fill="currentColor"/>
              </svg>
              <span>${escapeHtml(host.displayName)}</span>
            </div>
            ` : ""}
          </div>
        </header>
        <div class="content">
          <div class="section">
            <h2 class="section-title">Select a time</h2>
            ${needsSync ? `<p class="section-subtitle">${availabilityMessage || "Syncing calendar availability..."}</p>` : ""}
            <div class="recommendations-grid" id="recommendations">
              ${recommendations.length > 0
                ? recommendations
                    .slice(0, 6)
                    .map(
                      (rec) => `
                <button class="slot-choice" data-start="${rec.start}" data-end="${rec.end}">
                  <span class="time">${formatSlotRange(rec.start, rec.end, timeZone)}</span>
                  <span class="label">Available</span>
                </button>
              `,
                    )
                    .join("")
                : `<div class="empty-state"><p>No available times found. Please use the options below to propose alternative times.</p></div>`}
            </div>
          </div>
          <div class="section">
            <h2 class="section-title">Your information</h2>
            <div class="form-group">
              <label class="form-label" for="guest-email">
                Email
                <span class="required">*</span>
              </label>
              <input 
                type="email" 
                id="guest-email" 
                class="form-input"
                placeholder="your.email@example.com" 
                value="${escapeHtml(emailPrefill)}" 
                required 
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="guest-name">Name</label>
              <input 
                type="text" 
                id="guest-name" 
                class="form-input"
                placeholder="Your name" 
                value="${escapeHtml(namePrefill)}" 
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="guest-notes">Additional notes</label>
              <textarea 
                id="guest-notes" 
                class="form-textarea"
                rows="3" 
                placeholder="Any additional information you'd like to share..."
              ></textarea>
            </div>
            <button class="cta-button" id="accept-button">Confirm booking</button>
            <div id="status-message"></div>
          </div>
          <div class="feedback-section">
            <h3 class="feedback-title">Can't find a time that works?</h3>
            <div class="feedback-buttons">
              <button class="feedback-button" id="feedback-notify">Notify me of new times</button>
              <button class="feedback-button" id="feedback-propose">Propose alternative times</button>
            </div>
            <div id="feedback-status"></div>
          </div>
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
            acceptButton.textContent = '✓ Booked successfully';
            acceptButton.classList.add('success');
            acceptButton.disabled = true;
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

// Helper function to derive booking URL (matches the one in meetingReminders.ts but uses public route)
const deriveBookingUrl = (token: string): string => {
  const baseUrl = AppConfig.publicUrl || "https://taskforce-backend-production.up.railway.app";
  // Use the public route /book/:token (not /api/book/:token)
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBase}/book/${token}`;
};

// Send booking link via email
const sendBookingLinkSchema = z.object({
  to: z.string().email("Provide a valid recipient email address"),
  message: z.string().trim().max(2000).optional(),
});

bookingRouter.post("/booking-links/:bookingLinkId/send", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { bookingLinkId } = req.params;
    const parseResult = sendBookingLinkSchema.safeParse(req.body);

    if (!parseResult.success) {
      res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
      return;
    }

    const bookingLink = await prisma.bookingLink.findUnique({
      where: { id: bookingLinkId },
      include: {
        meetingType: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!bookingLink || !bookingLink.meetingType) {
      res.status(404).json({ error: "Booking link not found" });
      return;
    }

    // Verify the user owns this booking link
    if (bookingLink.meetingType.userId !== req.currentUser.id) {
      res.status(403).json({ error: "You don't have permission to send this booking link" });
      return;
    }

    const meetingType = bookingLink.meetingType;
    const host = meetingType.user;
    const bookingUrl = deriveBookingUrl(bookingLink.token);
    const hostName = host?.displayName || host?.email || "Someone";

    // Build email HTML
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1d1d1f; margin-top: 0; font-size: 24px; font-weight: 600;">
              ${escapeHtml(meetingType.name)}
            </h1>
            
            ${meetingType.description ? `
            <p style="color: #666; font-size: 16px; margin: 16px 0;">
              ${escapeHtml(meetingType.description)}
            </p>
            ` : ""}
            
            <div style="background: #f5f5f7; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Duration</p>
              <p style="margin: 0; color: #1d1d1f; font-size: 16px; font-weight: 500;">
                ${meetingType.durationMinutes} minutes
              </p>
            </div>
            
            ${parseResult.data.message ? `
            <p style="color: #333; font-size: 16px; margin: 24px 0;">
              ${escapeHtml(parseResult.data.message).replace(/\n/g, "<br>")}
            </p>
            ` : ""}
            
            <div style="margin: 32px 0; text-align: center;">
              <a href="${bookingUrl}" 
                 style="display: inline-block; padding: 14px 28px; background: #007aff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Book a time
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 32px; border-top: 1px solid #e5e5ea; padding-top: 16px;">
              This booking link was sent by ${escapeHtml(hostName)}.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email via Gmail
    await gmailDeliveryService.sendEmailViaGmail({
      userId: meetingType.userId,
      to: parseResult.data.to,
      subject: `Schedule a meeting: ${meetingType.name}`,
      bodyHtml: emailHtml,
    });

    res.status(200).json({
      success: true,
      message: "Booking link sent successfully",
    });
  } catch (error) {
    next(error);
  }
});
