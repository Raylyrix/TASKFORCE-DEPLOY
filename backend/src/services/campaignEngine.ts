/**
 * Campaign Engine Service
 * 
 * Handles email campaign creation, dispatch, tracking, and follow-up sequences.
 * Integrates with workflow automation to trigger workflows on campaign events.
 * 
 * Features:
 * - Campaign creation with recipient management
 * - Scheduled email dispatch with rate limiting
 * - Email tracking (opens and clicks)
 * - Follow-up sequences with delays
 * - Merge field replacement for personalization
 * - Workflow triggers on campaign completion
 * 
 * @module services/campaignEngine
 */

import { addMilliseconds, isBefore } from "date-fns";

import {
  CampaignStatus,
  MessageStatus,
  Prisma,
  RecipientStatus,
  type CampaignRecipient,
  type MessageLog,
} from "@prisma/client";

import { AppConfig } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { campaignQueue } from "../queue/campaignQueue";
import { followUpQueue } from "../queue/followUpQueue";
import type {
  CampaignDispatchJob,
  FollowUpDispatchJob,
  TrackingEventJob,
} from "../queue/types";
import { gmailDeliveryService } from "./gmailDelivery";
import { googleAuthService } from "./googleAuth";
import { antiSpamService } from "./antiSpamService";

type RecipientRecord = Record<string, string>;

// Convert HTML to plain text (simple version for email deliverability)
const htmlToText = (html: string): string => {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script tags
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
};

export type Attachment = {
  filename: string;
  content: string; // Base64-encoded file content
  contentType?: string; // MIME type
  size?: number; // File size in bytes
};

export type SendStrategy = {
  startAt: string;
  delayMsBetweenEmails: number;
  trackOpens: boolean;
  trackClicks: boolean;
  template: {
    subject: string;
    html: string;
    attachments?: Attachment[]; // File attachments
  };
};

export type CampaignCreationInput = {
  userId: string;
  name: string;
  sheetSourceId?: string;
  recipients: Array<{
    email: string;
    payload: RecipientRecord;
  }>;
  strategy: SendStrategy;
};

export type FollowUpStepConfig = {
  delayMs?: number; // Optional - can use scheduledAt instead
  scheduledAt?: string; // ISO 8601 date string for absolute scheduling
  subject: string;
  html: string;
  maxAttempts?: number;
  sendAsReply?: boolean;
  parentStepId?: string;
  isNested?: boolean;
  attachments?: Attachment[]; // File attachments
};

export type FollowUpSequenceConfig = {
  name: string;
  steps: FollowUpStepConfig[];
};

const DEFAULT_TRACKING_CONFIG = {
  trackOpens: true,
  trackClicks: false,
};

const renderTemplate = (template: string, data: RecipientRecord) => {
  if (!template || typeof template !== "string") {
    logger.warn({ template }, "Invalid template provided to renderTemplate");
    return "";
  }
  
  // First, ensure the template is valid UTF-8
  let cleanedTemplate: string;
  try {
    // Try to fix any encoding issues by re-encoding as UTF-8
    cleanedTemplate = Buffer.from(template, 'utf-8').toString('utf-8');
  } catch (error) {
    // If that fails, try to recover by removing invalid bytes
    logger.warn({ error, template: template.substring(0, 100) }, "Template encoding issue detected, attempting recovery");
    cleanedTemplate = template.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, "");
  }
  
  // Remove any non-printable characters except newlines, tabs, and carriage returns
  cleanedTemplate = cleanedTemplate.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  // Remove any corrupted RFC 2047 encoding that might have leaked into the template
  // This shouldn't happen, but if it does, clean it up
  cleanedTemplate = cleanedTemplate.replace(/=\?[^?]*\?[^?]*\?[^?=]*$/gm, '');
  cleanedTemplate = cleanedTemplate.replace(/^[^?=]*\?[^?]*\?[^?]*\?=/gm, '');
  
  // Remove any accidental URL encoding in templates (like %P, %20 in wrong context)
  // Only decode if it's clearly accidental (not part of a merge field, HTML entity, or URL)
  // We'll be conservative and only decode if it's not preceded by % or & and not followed by valid URL chars
  cleanedTemplate = cleanedTemplate.replace(/%([0-9A-F]{2})(?![0-9A-F]|[\w-]|&)/gi, (match, hex, offset, str) => {
    // Check if this is likely accidental encoding (not part of a URL or HTML entity)
    const before = offset > 0 ? str[offset - 1] : '';
    const after = offset + match.length < str.length ? str[offset + match.length] : '';
    
    // Skip if it's part of a URL (preceded by :, /, ?, =, &) or HTML entity (preceded by &)
    if (before.match(/[:/=&?]/) || after.match(/[0-9A-Fa-f]/)) {
      return match;
    }
    
    const charCode = parseInt(hex, 16);
    // Only decode if it's a printable ASCII character
    if (charCode >= 32 && charCode <= 126 && charCode !== 37) { // 37 is '%'
      return String.fromCharCode(charCode);
    }
    return match;
  });
  
  // Log available data keys for debugging
  const availableKeys = Object.keys(data || {});
  if (availableKeys.length === 0) {
    logger.warn({ template: cleanedTemplate.substring(0, 100) }, "No data available for template rendering");
  }
  
  const rendered = cleanedTemplate.replace(/{{\s*([\w.-]+)\s*}}/g, (match, key: string) => {
    const value = data[key];
    // Log missing variables for debugging
    if (value === undefined || value === null) {
      logger.debug({ key, availableKeys, match }, "Template variable not found in data");
    }
    // Return the value if it exists, otherwise return empty string (not the original placeholder)
    if (value !== undefined && value !== null) {
      // Ensure the replacement value is also clean UTF-8
      const cleanValue = String(value).trim();
      // Remove any control characters from merge field values
      return cleanValue.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
    }
    return ""; // Return empty string instead of the placeholder
  });
  
  return rendered;
};

// Validate and clean subject line to avoid spam triggers
// Now uses the comprehensive antiSpamService
const cleanSubjectLine = (subject: string): string => {
  return antiSpamService.cleanSubjectLine(subject);
};

const ensureUserHasCredentials = async (userId: string) => {
  await googleAuthService.getAuthorizedClientForUser(userId);
};

const scheduleRecipientJobs = async (campaignId: string, strategy: SendStrategy) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const startTime = new Date(strategy.startAt);
  const now = new Date();
  let scheduledAt = isBefore(startTime, now) ? now : startTime;

  for (const recipient of campaign.recipients) {
    const delayMs = Math.max(0, scheduledAt.getTime() - now.getTime());
    await campaignQueue.add(
      "send-recipient",
      {
        campaignId,
        recipientId: recipient.id,
        attempt: 1,
      },
      { delay: delayMs },
    );
    scheduledAt = addMilliseconds(scheduledAt, strategy.delayMsBetweenEmails);
  }
};

const createMessageForRecipient = (
  strategy: SendStrategy,
  recipient: RecipientRecord,
  tracking?: {
    trackingPixelUrl?: string;
    clickTrackingBaseUrl?: string;
    messageLogId?: string;
  },
) => {
  const subject = renderTemplate(strategy.template.subject, recipient);
  let html = renderTemplate(strategy.template.html, recipient);

  // Add click tracking to all links if enabled
  if (strategy.trackClicks && tracking?.clickTrackingBaseUrl && tracking?.messageLogId) {
    // Replace all href attributes with tracking URLs
    html = html.replace(
      /<a\s+([^>]*\s+)?href=["']([^"']+)["']([^>]*)>/gi,
      (match, before, url, after) => {
        // Skip if already a tracking URL or mailto: link
        if (url.startsWith(tracking.clickTrackingBaseUrl) || url.startsWith("mailto:")) {
          return match;
        }
        // Encode the original URL
        const encodedUrl = encodeURIComponent(url);
        const trackingUrl = `${tracking.clickTrackingBaseUrl}?url=${encodedUrl}&msg=${tracking.messageLogId}`;
        return `<a ${before || ""}href="${trackingUrl}"${after || ""}>`;
      },
    );
  }

  // Add tracking pixel for opens ONLY if tracking is explicitly enabled
  // This prevents tracking pixels from being added when user disables tracking
  if (strategy.trackOpens === true && tracking?.trackingPixelUrl) {
    html = `${html}<img src="${tracking.trackingPixelUrl}" alt="" width="1" height="1" style="display:none;" />`;
  }

  return { subject, html };
};

const scheduleFollowUpsForMessage = async (campaignId: string, recipientId: string, baseDate: Date) => {
  const sequences = await prisma.followUpSequence.findMany({
    where: { campaignId },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  for (const sequence of sequences) {
    const sequenceSettings = (sequence.settings as { 
      stopOnReply?: boolean;
      stopOnOpen?: boolean;
      maxFollowUps?: number;
    } | null) ?? {};

    for (const step of sequence.steps) {
      const stepOffset = (step.offsetConfig as { 
        delayMs?: number | null;
        scheduledAt?: string | null; // ISO date string for absolute scheduling
        condition?: "always" | "if_not_opened" | "if_not_replied" | "if_not_clicked";
        isNested?: boolean;
        parentStepId?: string;
      }) ?? {};
      
      // Skip nested follow-ups - they will be scheduled when their parent follow-up is sent
      if (stepOffset.isNested && stepOffset.parentStepId) {
        logger.info(
          {
            campaignId,
            recipientId,
            followUpStepId: step.id,
            parentStepId: stepOffset.parentStepId,
          },
          "Skipping nested follow-up - will be scheduled when parent follow-up is sent"
        );
        continue;
      }
      
      // Calculate scheduled time: use absolute scheduledAt if provided, otherwise use relative delayMs
      let scheduledAt: Date;
      if (stepOffset.scheduledAt) {
        scheduledAt = new Date(stepOffset.scheduledAt);
        // Ensure scheduledAt is in the future
        const now = new Date();
        if (isBefore(scheduledAt, now)) {
          // If scheduledAt is in the past, fall back to delayMs or default
          const fallbackDelayMs = (stepOffset.delayMs != null && stepOffset.delayMs >= 0) 
            ? stepOffset.delayMs 
            : 48 * 60 * 60 * 1000;
          scheduledAt = addMilliseconds(now, fallbackDelayMs);
          logger.warn(
            {
              campaignId,
              recipientId,
              followUpStepId: step.id,
              originalScheduledAt: stepOffset.scheduledAt,
              fallbackDelayMs,
            },
            "scheduledAt was in the past, using delayMs fallback"
          );
        }
      } else {
        // Use delayMs if it's a valid number (not null, not undefined, >= 0)
        // If delayMs is missing or invalid, log a warning and use default
        const delayMs = (stepOffset.delayMs != null && stepOffset.delayMs >= 0)
          ? stepOffset.delayMs
          : 48 * 60 * 60 * 1000; // Default 48 hours
        
        if (stepOffset.delayMs == null || stepOffset.delayMs < 0) {
          logger.warn(
            {
              campaignId,
              recipientId,
              followUpStepId: step.id,
              storedDelayMs: stepOffset.delayMs,
              usingDefault: true,
              defaultDelayMs: 48 * 60 * 60 * 1000,
            },
            "delayMs is missing or invalid in offsetConfig, using 48-hour default"
          );
        }
        
        scheduledAt = addMilliseconds(baseDate, delayMs);
      }
      
      // Calculate delay in milliseconds from now
      const now = new Date();
      const delayMs = Math.max(0, scheduledAt.getTime() - now.getTime());
      
      // Ensure minimum delay of 1 minute to prevent immediate sending
      const minDelayMs = 60 * 1000; // 1 minute
      const finalDelayMs = Math.max(minDelayMs, delayMs);
      
      logger.info(
        {
          campaignId,
          recipientId,
          followUpStepId: step.id,
          scheduledAt: scheduledAt.toISOString(),
          delayMs: finalDelayMs,
          delayHours: Math.round(finalDelayMs / (60 * 60 * 1000) * 100) / 100,
          storedDelayMs: stepOffset.delayMs,
          storedScheduledAt: stepOffset.scheduledAt,
          baseDate: baseDate.toISOString(),
          calculatedFromBase: !stepOffset.scheduledAt,
        },
        "Scheduling follow-up"
      );
      
      await followUpQueue.add(
        "send-follow-up",
        {
          followUpSequenceId: sequence.id,
          followUpStepId: step.id,
          recipientId,
          scheduledAt: scheduledAt.toISOString(),
          attempt: 1,
          condition: stepOffset.condition ?? "always",
          stopOnReply: sequenceSettings.stopOnReply ?? false,
          stopOnOpen: sequenceSettings.stopOnOpen ?? false,
        },
        {
          delay: finalDelayMs, // BullMQ delay option - this is critical!
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
    }
  }
};

// Schedule nested follow-ups that have a specific parent step
const scheduleNestedFollowUpsForStep = async (
  campaignId: string,
  recipientId: string,
  parentStepId: string,
  baseDate: Date
) => {
  const sequences = await prisma.followUpSequence.findMany({
    where: { campaignId },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

  for (const sequence of sequences) {
    const sequenceSettings = (sequence.settings as { 
      stopOnReply?: boolean;
      stopOnOpen?: boolean;
      maxFollowUps?: number;
    } | null) ?? {};

    // Find nested follow-ups that have this step as their parent
    for (const step of sequence.steps) {
      const stepOffset = (step.offsetConfig as { 
        delayMs?: number | null;
        scheduledAt?: string | null;
        condition?: "always" | "if_not_opened" | "if_not_replied" | "if_not_clicked";
        isNested?: boolean;
        parentStepId?: string;
      }) ?? {};
      
      // Only schedule if this is a nested follow-up with the matching parent
      if (!stepOffset.isNested || stepOffset.parentStepId !== parentStepId) {
        continue;
      }
      
      // Calculate scheduled time: use absolute scheduledAt if provided, otherwise use relative delayMs
      let scheduledAt: Date;
      if (stepOffset.scheduledAt) {
        scheduledAt = new Date(stepOffset.scheduledAt);
        // Ensure scheduledAt is in the future
        const now = new Date();
        if (isBefore(scheduledAt, now)) {
          // If scheduledAt is in the past, fall back to delayMs or default
          const fallbackDelayMs = (stepOffset.delayMs != null && stepOffset.delayMs >= 0) 
            ? stepOffset.delayMs 
            : 48 * 60 * 60 * 1000;
          scheduledAt = addMilliseconds(now, fallbackDelayMs);
          logger.warn(
            {
              campaignId,
              recipientId,
              followUpStepId: step.id,
              parentStepId,
              originalScheduledAt: stepOffset.scheduledAt,
              fallbackDelayMs,
            },
            "scheduledAt was in the past for nested follow-up, using delayMs fallback"
          );
        }
      } else {
        // Use delayMs if it's a valid number (not null, not undefined, >= 0)
        const delayMs = (stepOffset.delayMs != null && stepOffset.delayMs >= 0)
          ? stepOffset.delayMs
          : 48 * 60 * 60 * 1000; // Default 48 hours
        
        if (stepOffset.delayMs == null || stepOffset.delayMs < 0) {
          logger.warn(
            {
              campaignId,
              recipientId,
              followUpStepId: step.id,
              parentStepId,
              storedDelayMs: stepOffset.delayMs,
              usingDefault: true,
              defaultDelayMs: 48 * 60 * 60 * 1000,
            },
            "delayMs is missing or invalid in offsetConfig for nested follow-up, using 48-hour default"
          );
        }
        
        scheduledAt = addMilliseconds(baseDate, delayMs);
      }
      
      // Calculate delay in milliseconds from now
      const now = new Date();
      const delayMs = Math.max(0, scheduledAt.getTime() - now.getTime());
      
      // Ensure minimum delay of 1 minute to prevent immediate sending
      const minDelayMs = 60 * 1000; // 1 minute
      const finalDelayMs = Math.max(minDelayMs, delayMs);
      
      logger.info(
        {
          campaignId,
          recipientId,
          followUpStepId: step.id,
          parentStepId,
          scheduledAt: scheduledAt.toISOString(),
          delayMs: finalDelayMs,
          delayHours: Math.round(finalDelayMs / (60 * 60 * 1000) * 100) / 100,
        },
        "Scheduling nested follow-up after parent follow-up"
      );
      
      await followUpQueue.add(
        "send-follow-up",
        {
          followUpSequenceId: sequence.id,
          followUpStepId: step.id,
          recipientId,
          scheduledAt: scheduledAt.toISOString(),
          attempt: 1,
          condition: stepOffset.condition ?? "always",
          stopOnReply: sequenceSettings.stopOnReply ?? false,
          stopOnOpen: sequenceSettings.stopOnOpen ?? false,
        },
        {
          delay: finalDelayMs,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      );
    }
  }
};

const processCampaignDispatch = async (job: CampaignDispatchJob) => {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: job.recipientId },
    include: {
      campaign: {
        select: {
          id: true,
          userId: true,
          name: true,
          status: true,
          sendStrategy: true,
          trackingConfig: true,
          gmailLabelId: true,
          folderId: true,
        },
      },
    },
  });

  if (!recipient || !recipient.campaign) {
    throw new Error("Recipient or campaign not found");
  }

  const strategy = recipient.campaign.sendStrategy as SendStrategy;
  const payload = recipient.payload as RecipientRecord;

  // Validate and sanitize strategy
  if (!strategy || !strategy.template || typeof strategy.template.subject !== "string") {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id, strategy },
      "Invalid sendStrategy in campaign - missing or corrupted template",
    );
    throw new Error("Campaign sendStrategy is invalid or corrupted. Please recreate the campaign.");
  }

  // Sanitize subject template - ensure it's a clean string and fix any encoding issues
  let subjectTemplate = String(strategy.template.subject || "").trim();
  
  // Fix any encoding corruption that might have occurred
  try {
    // Ensure valid UTF-8 encoding
    subjectTemplate = Buffer.from(subjectTemplate, 'utf-8').toString('utf-8');
    // Remove any corrupted RFC 2047 encoding patterns
    subjectTemplate = subjectTemplate.replace(/=\?[^?]*\?[^?]*\?[^?=]*$/g, '');
    subjectTemplate = subjectTemplate.replace(/^[^?=]*\?[^?]*\?[^?]*\?=/g, '');
    // Remove control characters
    subjectTemplate = subjectTemplate.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  } catch (error) {
    logger.warn(
      { error, campaignId: recipient.campaign.id, originalSubject: strategy.template.subject?.substring(0, 100) },
      "Error cleaning subject template, using fallback"
    );
    subjectTemplate = String(strategy.template.subject || "").replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  }
  
  if (!subjectTemplate || subjectTemplate.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id },
      "Campaign subject template is empty",
    );
    throw new Error("Campaign subject template is empty. Please update the campaign.");
  }

  // Sanitize HTML template - ensure it's a clean string and fix any encoding issues
  let htmlTemplate = String(strategy.template.html || "").trim();
  
  // Fix any encoding corruption that might have occurred
  try {
    // Ensure valid UTF-8 encoding
    htmlTemplate = Buffer.from(htmlTemplate, 'utf-8').toString('utf-8');
    // Remove any corrupted RFC 2047 encoding patterns
    htmlTemplate = htmlTemplate.replace(/=\?[^?]*\?[^?]*\?[^?=]*$/gm, '');
    htmlTemplate = htmlTemplate.replace(/^[^?=]*\?[^?]*\?[^?]*\?=/gm, '');
    // Remove control characters (but preserve newlines and tabs for HTML)
    htmlTemplate = htmlTemplate.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  } catch (error) {
    logger.warn(
      { error, campaignId: recipient.campaign.id },
      "Error cleaning HTML template, using fallback"
    );
    htmlTemplate = String(strategy.template.html || "").replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  }
  
  if (!htmlTemplate || htmlTemplate.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id },
      "Campaign HTML template is empty",
    );
    throw new Error("Campaign HTML template is empty. Please update the campaign.");
  }

  // Create sanitized strategy object
  const sanitizedStrategy: SendStrategy = {
    ...strategy,
    template: {
      subject: subjectTemplate,
      html: htmlTemplate,
      attachments: (strategy.template.attachments || []) as Attachment[],
    },
  };

  await ensureUserHasCredentials(recipient.campaign.userId);

  const messageLog = await prisma.messageLog.create({
    data: {
      campaignId: recipient.campaign.id,
      campaignRecipientId: recipient.id,
      subject: "",
      to: recipient.email,
      status: MessageStatus.PROCESSING,
    },
  });

  // Only create tracking URLs if tracking is explicitly enabled
  // This ensures tracking is completely disabled when user turns it off
  const trackingPixelUrl = sanitizedStrategy.trackOpens === true
    ? `${AppConfig.publicUrl}/api/tracking/pixel/${messageLog.id}`
    : undefined;

  const clickTrackingBaseUrl = sanitizedStrategy.trackClicks === true
    ? `${AppConfig.publicUrl}/api/tracking/click`
    : undefined;

  // Only pass tracking if at least one tracking method is enabled
  const tracking = (trackingPixelUrl || clickTrackingBaseUrl) ? {
    trackingPixelUrl,
    clickTrackingBaseUrl,
    messageLogId: messageLog.id,
  } : undefined;

  const messageContent = createMessageForRecipient(sanitizedStrategy, payload, tracking);

  // Final validation of rendered subject
  const finalSubject = messageContent.subject.trim();
  if (!finalSubject || finalSubject.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id, renderedSubject: messageContent.subject },
      "Rendered subject is empty after template processing",
    );
    throw new Error("Email subject is empty after template rendering. Please check your campaign template.");
  }

  // Clean subject line to avoid spam triggers
  let cleanSubject = finalSubject.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  cleanSubject = cleanSubjectLine(cleanSubject);
  
  if (!cleanSubject || cleanSubject.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id, originalSubject: messageContent.subject },
      "Subject is empty after cleaning",
    );
    throw new Error("Email subject is invalid. Please check your campaign template.");
  }

  // Perform spam check before sending
  const spamCheck = antiSpamService.checkForSpam({
    subject: cleanSubject,
    html: messageContent.html,
    text: htmlToText(messageContent.html),
    from: recipient.campaign.userId, // Will be resolved to email in gmailDelivery
    to: recipient.email,
  });

  if (spamCheck.isSpam) {
    logger.warn(
      {
        campaignId: recipient.campaign.id,
        recipientId: recipient.id,
        spamScore: spamCheck.score,
        reasons: spamCheck.reasons,
        subject: cleanSubject.substring(0, 50),
      },
      "Campaign email flagged as potential spam - sending anyway but should be reviewed",
    );
  }

  logger.info(
    { campaignId: recipient.campaign.id, recipientId: recipient.id, subject: cleanSubject, spamScore: spamCheck.score },
    "Sending campaign email",
  );

  // Get label ID from campaign folder if set
  const labelIds: string[] = [];
  if (recipient.campaign.gmailLabelId) {
    labelIds.push(recipient.campaign.gmailLabelId);
  }

  const sendResult = await gmailDeliveryService.sendEmailViaGmail({
    userId: recipient.campaign.userId,
    to: recipient.email,
    subject: cleanSubject,
    bodyHtml: messageContent.html,
    bodyText: htmlToText(messageContent.html), // Add plain text version
    isCampaign: true, // Mark as campaign email for proper headers
    attachments: (sanitizedStrategy.template.attachments || []).map((att: Attachment) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType || undefined,
      size: att.size || undefined,
    })),
    labelIds: labelIds.length > 0 ? labelIds : undefined,
  });

  await prisma.messageLog.update({
    where: { id: messageLog.id },
    data: {
      subject: cleanSubject,
      status: MessageStatus.SENT,
      sendAt: new Date(),
      gmailMessageId: sendResult.id,
    },
  });

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      status: RecipientStatus.SENT,
      lastSentAt: new Date(),
    },
  });

  // Update campaign status to RUNNING if it's still SCHEDULED
  await prisma.campaign.updateMany({
    where: {
      id: recipient.campaign.id,
      status: CampaignStatus.SCHEDULED,
    },
    data: {
      status: CampaignStatus.RUNNING,
    },
  });

  await scheduleFollowUpsForMessage(recipient.campaign.id, recipient.id, new Date());

  // Check if we should trigger campaign workflows (async, don't await)
  triggerCampaignWorkflows(recipient.campaign.id).catch((error) => {
    logger.error({ error, campaignId: recipient.campaign.id }, "Failed to trigger campaign workflows");
  });
};

const triggerCampaignWorkflows = async (campaignId: string) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        recipients: {
          where: {
            status: RecipientStatus.SENT,
          },
        },
        sheetSource: true,
      },
    });

    if (!campaign) {
      return;
    }

    // Trigger when campaign is fully sent
    const totalRecipients = await prisma.campaignRecipient.count({
      where: { campaignId },
    });

    const sentRecipients = campaign.recipients.length;

    if (sentRecipients > 0 && sentRecipients === totalRecipients) {
      // Mark campaign as COMPLETED
      await prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.COMPLETED,
        },
      });

      logger.info({ campaignId }, "Campaign marked as COMPLETED");

      // Update Google Sheet with campaign results if sheetSource exists
      if (campaign.sheetSource) {
        try {
          const allRecipients = await prisma.campaignRecipient.findMany({
            where: { campaignId },
            include: {
              messages: {
                where: {
                  followUpStepId: null, // Only original campaign messages
                },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
            },
          });

          const recipientsWithStatus = await Promise.all(
            allRecipients.map(async (recipient) => {
              const message = recipient.messages[0];
              const hasBounce = message?.status === MessageStatus.BOUNCED;
              const hasFailed = recipient.status === RecipientStatus.FAILED || message?.status === MessageStatus.FAILED;

              // Get tracking events
              const openedEvent = message
                ? await prisma.trackingEvent.findFirst({
                    where: {
                      messageLogId: message.id,
                      type: "OPEN",
                    },
                    orderBy: { createdAt: "asc" },
                  })
                : null;

              const clickedEvent = message
                ? await prisma.trackingEvent.findFirst({
                    where: {
                      messageLogId: message.id,
                      type: "CLICK",
                    },
                    orderBy: { createdAt: "asc" },
                  })
                : null;

              return {
                email: recipient.email,
                payload: recipient.payload as RecipientRecord,
                status: recipient.status,
                sentAt: message?.sendAt ?? null,
                openedAt: openedEvent?.createdAt ?? null,
                clickedAt: clickedEvent?.createdAt ?? null,
                bounced: hasBounce,
                failed: hasFailed,
              };
            }),
          );

          const { sheetsService } = await import("./googleSheets.js");
          await sheetsService.updateSheetWithCampaignResults(
            campaign.userId,
            campaign.sheetSource.spreadsheetId,
            campaign.sheetSource.worksheetId,
            recipientsWithStatus,
          );

          logger.info({ campaignId, spreadsheetId: campaign.sheetSource.spreadsheetId }, "Updated Google Sheet with campaign results");
        } catch (error) {
          logger.error(
            { error, campaignId },
            "Failed to update Google Sheet with campaign results (non-fatal)",
          );
          // Don't throw - sheet update failure shouldn't break campaign completion
        }
      }

      // Trigger workflow
      const { workflowTriggerService } = await import("./workflowTrigger.js");
      await workflowTriggerService.triggerCampaignSent(campaign.userId, {
        campaignId: campaign.id,
        campaignName: campaign.name,
        recipientCount: sentRecipients,
      });
    }
  } catch (error) {
    logger.error({ error, campaignId }, "Failed to trigger campaign workflows");
  }
};

const processFollowUpDispatch = async (job: FollowUpDispatchJob) => {
  const step = await prisma.followUpStep.findUnique({
    where: { id: job.followUpStepId },
    include: {
      sequence: {
        include: {
          campaign: true,
        },
      },
    },
  });

  if (!step) {
    throw new Error("Follow-up step not found");
  }

  // Read offsetConfig to check if this is a nested follow-up
  const offsetConfig = step.offsetConfig as { delayMs: number; sendAsReply?: boolean; parentStepId?: string; isNested?: boolean; attachments?: Attachment[] };
  const isNested = offsetConfig?.isNested ?? false;
  const parentStepId = offsetConfig?.parentStepId;
  const sendAsReply = offsetConfig?.sendAsReply ?? false;

  // For nested follow-ups, we need to find the parent follow-up message
  // For regular follow-ups, we need to find the original campaign message
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: job.recipientId },
    include: {
      messages: {
        where: isNested && parentStepId
          ? { followUpStepId: parentStepId } // For nested: find parent follow-up message
          : { followUpStepId: null }, // For regular: find original campaign message
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      campaign: {
        select: {
          id: true,
          userId: true,
          name: true,
          status: true,
          sendStrategy: true,
          trackingConfig: true,
          gmailLabelId: true,
          folderId: true,
        },
      },
    },
  });

  if (!step || !step.sequence?.campaign || !recipient) {
    throw new Error("Follow-up prerequisites not met");
  }

  // Check conditions before sending follow-up
  const condition = job.condition ?? "always";
  const stopOnReply = job.stopOnReply ?? false;
  const stopOnOpen = job.stopOnOpen ?? false;

  // Get the message to reply to (original for regular follow-ups, parent for nested)
  const messageToReplyTo = recipient.messages[0];
  
  // Get threadId and Message-ID for reply if needed
  let threadId: string | null = null;
  let inReplyTo: string | null = null;
  let references: string | null = null;
  let replySubject: string | null = null;
  
  // Validate that we have the message to reply to if sendAsReply is enabled
  if (sendAsReply && !messageToReplyTo) {
    logger.warn(
      { 
        recipientId: recipient.id, 
        followUpStepId: step.id,
        isNested,
        parentStepId,
        hasMessages: recipient.messages.length
      },
      `sendAsReply is true but no ${isNested ? 'parent follow-up' : 'original'} message found for recipient, sending as new email`
    );
  } else if (sendAsReply && messageToReplyTo && messageToReplyTo.status !== MessageStatus.SENT) {
    logger.warn(
      { 
        recipientId: recipient.id, 
        followUpStepId: step.id,
        messageLogId: messageToReplyTo.id,
        messageStatus: messageToReplyTo.status,
        isNested
      },
      `sendAsReply is true but ${isNested ? 'parent follow-up' : 'original'} message was not sent successfully, sending as new email`
    );
  } else if (sendAsReply && messageToReplyTo && !messageToReplyTo.gmailMessageId) {
    logger.warn(
      { 
        recipientId: recipient.id, 
        followUpStepId: step.id,
        messageLogId: messageToReplyTo.id,
        messageStatus: messageToReplyTo.status,
        isNested
      },
      `sendAsReply is true but ${isNested ? 'parent follow-up' : 'original'} message has no gmailMessageId, sending as new email`
    );
  } else if (sendAsReply && messageToReplyTo?.gmailMessageId && messageToReplyTo.status === MessageStatus.SENT) {
    // Fetch the Gmail message to get threadId and Message-ID
    try {
      const authClient = await googleAuthService.getAuthorizedClientForUser(step.sequence.campaign.userId);
      const { google } = await import("googleapis");
      const gmail = google.gmail({
        version: "v1",
        auth: authClient,
      });
      
      const gmailMessage = await gmail.users.messages.get({
        userId: "me",
        id: messageToReplyTo.gmailMessageId,
        format: "metadata",
        metadataHeaders: ["Message-ID", "Subject", "References"],
      });
      
      threadId = gmailMessage.data.threadId ?? null;
      
      // Extract Message-ID and References from headers
      const headers = (gmailMessage.data.payload?.headers ?? []).reduce(
        (acc, header) => {
          if (header.name && header.value) {
            acc[header.name.toLowerCase()] = header.value;
          }
          return acc;
        },
        {} as Record<string, string>,
      );
      
      const originalMessageId = headers["message-id"];
      const originalReferences = headers["references"];
      const originalSubject = headers["subject"] || "";
      
      if (originalMessageId) {
        inReplyTo = originalMessageId;
        // Build References header: original References + original Message-ID
        references = originalReferences 
          ? `${originalReferences} ${originalMessageId}`
          : originalMessageId;
      }
      
      // Format reply subject
      if (originalSubject && !originalSubject.startsWith("Re:")) {
        replySubject = `Re: ${originalSubject}`;
      } else {
        replySubject = originalSubject;
      }
      
      if (threadId && inReplyTo) {
        logger.info(
          { 
            recipientId: recipient.id, 
            followUpStepId: step.id,
            isNested,
            parentStepId,
            threadId, 
            inReplyTo,
            messageId: messageToReplyTo.gmailMessageId,
            replySubject
          },
          `Successfully fetched threadId and Message-ID for ${isNested ? 'nested' : 'regular'} reply follow-up`
        );
      } else {
        logger.warn(
          { 
            recipientId: recipient.id,
            followUpStepId: step.id,
            isNested,
            messageId: messageToReplyTo.gmailMessageId,
            hasThreadId: !!threadId,
            hasInReplyTo: !!inReplyTo,
            headersFound: Object.keys(headers).length
          },
          "Failed to extract required reply data from Gmail message"
        );
      }
    } catch (error) {
      logger.error(
        { 
          error, 
          messageId: messageToReplyTo?.gmailMessageId,
          recipientId: recipient.id,
          followUpStepId: step.id,
          errorMessage: error instanceof Error ? error.message : String(error)
        },
        "Failed to fetch Gmail message for reply threading"
      );
      // Reset reply variables to ensure we don't send with incomplete data
      threadId = null;
      inReplyTo = null;
      references = null;
      replySubject = null;
    }
  }

  if (messageToReplyTo) {
    // Check if we should stop based on reply
    // For nested follow-ups, check replies to the parent follow-up
    // For regular follow-ups, check replies to the original message
    if (stopOnReply || condition === "if_not_replied") {
      const hasReply = await prisma.trackingEvent.findFirst({
        where: {
          messageLogId: messageToReplyTo.id,
          type: "REPLY",
        },
      });

      if (hasReply && stopOnReply) {
        logger.info(
          { recipientId: recipient.id, followUpStepId: step.id },
          "Skipping follow-up: recipient replied",
        );
        return; // Don't send follow-up if they replied
      }

      if (hasReply && condition === "if_not_replied") {
        logger.info(
          { recipientId: recipient.id, followUpStepId: step.id },
          "Skipping follow-up: condition requires no reply",
        );
        return; // Don't send if condition requires no reply but they replied
      }
    }

    // Check if we should stop based on open
    if (stopOnOpen || condition === "if_not_opened") {
      const hasOpen = await prisma.trackingEvent.findFirst({
        where: {
          messageLogId: messageToReplyTo.id,
          type: "OPEN",
        },
      });

      if (hasOpen && stopOnOpen) {
        logger.info(
          { recipientId: recipient.id, followUpStepId: step.id },
          "Skipping follow-up: recipient opened email",
        );
        return; // Don't send follow-up if they opened
      }

      if (!hasOpen && condition === "if_not_opened") {
        // This is correct - we want to send if NOT opened
      } else if (hasOpen && condition === "if_not_opened") {
        logger.info(
          { recipientId: recipient.id, followUpStepId: step.id },
          "Skipping follow-up: condition requires no open",
        );
        return; // Don't send if condition requires no open but they opened
      }
    }

    // Check if we should stop based on click
    if (condition === "if_not_clicked") {
      const hasClick = await prisma.trackingEvent.findFirst({
        where: {
          messageLogId: messageToReplyTo.id,
          type: "CLICK",
        },
      });

      if (hasClick) {
        logger.info(
          { recipientId: recipient.id, followUpStepId: step.id },
          "Skipping follow-up: condition requires no click",
        );
        return; // Don't send if condition requires no click but they clicked
      }
    }
  }

  const payload = recipient.payload as RecipientRecord;

  // Log payload for debugging variable replacement
  logger.debug(
    { 
      recipientId: recipient.id, 
      followUpStepId: step.id,
      payloadKeys: Object.keys(payload || {}),
      subjectTemplate: step.templateSubject,
      hasName: 'name' in (payload || {}),
      nameValue: payload?.name,
    },
    "Rendering follow-up template with payload"
  );

  const subjectTemplate = step.templateSubject?.length ? step.templateSubject : "Checking in";

  const messageLog = await prisma.messageLog.create({
    data: {
      campaignId: step.sequence.campaignId,
      campaignRecipientId: recipient.id,
      followUpStepId: step.id,
      subject: "",
      to: recipient.email,
      status: MessageStatus.PROCESSING,
    },
  });

  const messageContent = createMessageForRecipient(
    {
      startAt: job.scheduledAt,
      delayMsBetweenEmails: 0,
      trackClicks: false,
      trackOpens: false,
      template: {
        subject: subjectTemplate,
        html: step.templateHtml,
      },
    },
    payload,
    undefined, // No tracking for follow-ups
  );

  // Validate reply setup: if sendAsReply is true, we must have threadId and inReplyTo
  const canSendAsReply = sendAsReply && threadId && inReplyTo;
  
  if (sendAsReply && !canSendAsReply) {
    logger.warn(
      { 
        recipientId: recipient.id, 
        followUpStepId: step.id,
        hasThreadId: !!threadId,
        hasInReplyTo: !!inReplyTo,
        hasGmailMessageId: !!messageToReplyTo?.gmailMessageId,
        isNested,
        parentStepId
      },
      `sendAsReply is true but missing required reply data for ${isNested ? 'nested' : 'regular'} follow-up, sending as new email instead`
    );
  }

  // Use reply subject if this is a reply, otherwise use the template subject
  let finalSubject: string;
  if (canSendAsReply && replySubject) {
    finalSubject = replySubject;
  } else {
    finalSubject = messageContent.subject;
    // If sendAsReply was requested but we don't have reply data, ensure subject doesn't have "Re:" prefix
    if (sendAsReply && !canSendAsReply && finalSubject.startsWith("Re: ")) {
      finalSubject = finalSubject.replace(/^Re: /i, "");
    }
  }

  // Get attachments from step configuration (offsetConfig already declared above)
  const stepOffsetConfig = step.offsetConfig as { delayMs?: number; sendAsReply?: boolean; parentStepId?: string; isNested?: boolean; attachments?: Attachment[] } | null;
  const stepAttachments = (stepOffsetConfig?.attachments || []) as Attachment[];

  // Get label ID from campaign folder if set
  const labelIds: string[] = [];
  if (step.sequence.campaign.gmailLabelId) {
    labelIds.push(step.sequence.campaign.gmailLabelId);
  }

  const sendResult = await gmailDeliveryService.sendEmailViaGmail({
    userId: step.sequence.campaign.userId,
    to: recipient.email,
    subject: finalSubject,
    bodyHtml: messageContent.html,
    bodyText: htmlToText(messageContent.html), // Add plain text version
    threadId: canSendAsReply ? threadId : null,
    inReplyTo: canSendAsReply ? inReplyTo : null,
    references: canSendAsReply ? references : null,
    isCampaign: true, // Mark as campaign email for proper headers
    attachments: stepAttachments.map((att: Attachment) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType || undefined,
      size: att.size || undefined,
    })),
    labelIds: labelIds.length > 0 ? labelIds : undefined,
  });

  if (canSendAsReply) {
    logger.info(
      { 
        recipientId: recipient.id, 
        followUpStepId: step.id,
        threadId,
        inReplyTo,
        messageId: sendResult.id
      },
      "Follow-up sent as reply successfully"
    );
  }

  await prisma.messageLog.update({
    where: { id: messageLog.id },
    data: {
      subject: finalSubject,
      status: MessageStatus.SENT,
      sendAt: new Date(),
      gmailMessageId: sendResult.id,
    },
  });

  // If this is a follow-up message, schedule any nested follow-ups that have this step as their parent
  if (step.id) {
    await scheduleNestedFollowUpsForStep(step.sequence.campaignId, recipient.id, step.id, new Date());
  }
};

const processTrackingEvent = async (job: TrackingEventJob) => {
  const occurredAt = new Date(job.occurredAt);
  
  // Get message log for workflow triggers
  const messageLog = await prisma.messageLog.findUnique({
    where: { id: job.messageLogId },
    include: {
      campaign: {
        select: {
          userId: true,
        },
      },
    },
  });

  // Create tracking event
  await prisma.trackingEvent.create({
    data: {
      messageLogId: job.messageLogId,
      type: job.eventType,
      meta: (job.meta ?? {}) as Prisma.JsonObject,
      createdAt: occurredAt,
    },
  });

  // Update message log counters
  const updateData: {
    opens?: { increment: number };
    clicks?: { increment: number };
    updatedAt?: Date;
  } = {
    updatedAt: new Date(),
  };

  if (job.eventType === "OPEN") {
    updateData.opens = { increment: 1 };
  } else if (job.eventType === "CLICK") {
    updateData.clicks = { increment: 1 };
  }

  await prisma.messageLog.update({
    where: { id: job.messageLogId },
    data: updateData,
  });

  // Trigger workflows for email events
  if (messageLog && messageLog.campaign) {
    const { workflowTriggerService } = await import("./workflowTrigger.js");
    const meta = job.meta as Record<string, unknown> | undefined;

    if (job.eventType === "OPEN") {
      await workflowTriggerService.triggerEmailOpened(messageLog.campaign.userId, {
        messageLogId: job.messageLogId,
        to: messageLog.to,
        subject: messageLog.subject,
        campaignId: messageLog.campaignId,
      });
    } else if (job.eventType === "CLICK") {
      await workflowTriggerService.triggerEmailClicked(messageLog.campaign.userId, {
        messageLogId: job.messageLogId,
        to: messageLog.to,
        subject: messageLog.subject,
        url: (meta?.url as string) || "",
        campaignId: messageLog.campaignId,
      });
    }
  }
};

const createCampaign = async (input: CampaignCreationInput) => {
  await ensureUserHasCredentials(input.userId);

  const campaign = await prisma.campaign.create({
    data: {
      userId: input.userId,
      sheetSourceId: input.sheetSourceId ?? null,
      name: input.name,
      status: CampaignStatus.DRAFT,
      sendStrategy: input.strategy,
      trackingConfig: {
        trackOpens: input.strategy.trackOpens,
        trackClicks: input.strategy.trackClicks,
      },
      recipients: {
        create: input.recipients.map((recipient) => ({
          email: recipient.email,
          payload: recipient.payload,
        })),
      },
    },
    include: {
      recipients: true,
    },
  });

  return campaign;
};

const scheduleCampaign = async (campaignId: string, startAt: string) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const strategy = campaign.sendStrategy as SendStrategy;
  strategy.startAt = startAt;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      scheduledSendAt: new Date(startAt),
      status: CampaignStatus.SCHEDULED,
      sendStrategy: strategy,
    },
  });

  await scheduleRecipientJobs(campaignId, strategy);
};

const pauseCampaign = async (campaignId: string) => {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.PAUSED,
    },
  });
};

const cancelCampaign = async (campaignId: string) => {
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.CANCELLED,
    },
  });
};

const createFollowUpSequence = async (campaignId: string, config: FollowUpSequenceConfig) => {
  const sequence = await prisma.followUpSequence.create({
    data: {
      campaignId,
      name: config.name,
      settings: {},
      steps: {
        create: config.steps.map((step, index) => ({
          order: index,
          offsetConfig: {
            // Only include delayMs if it's a valid number (not undefined, not null, >= 0)
            ...(step.delayMs != null && step.delayMs >= 0 ? { delayMs: step.delayMs } : {}),
            // Only include scheduledAt if provided
            ...(step.scheduledAt ? { scheduledAt: step.scheduledAt } : {}),
            sendAsReply: step.sendAsReply ?? false,
            ...(step.parentStepId ? { parentStepId: step.parentStepId } : {}),
            isNested: step.isNested ?? false,
          },
          templateSubject: step.subject,
          templateHtml: step.html,
        })),
      },
    },
    include: {
      steps: true,
    },
  });

  return sequence;
};

const listFollowUpSequences = async (campaignId: string) =>
  prisma.followUpSequence.findMany({
    where: { campaignId },
    include: {
      steps: {
        orderBy: { order: "asc" },
      },
    },
  });

const listCampaignsForUser = async (userId: string) => {
  try {
    return await prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        sheetSourceId: true,
        name: true,
        status: true,
        sendStrategy: true,
        trackingConfig: true,
        folderId: true,
        gmailLabelId: true,
        createdAt: true,
        updatedAt: true,
        scheduledSendAt: true,
        recipients: {
          select: {
            id: true,
            status: true,
          },
        },
        messages: {
          select: {
            id: true,
            status: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
            color: true,
            gmailLabelId: true,
          },
        },
      },
    });
  } catch (error: any) {
    // If folderId column doesn't exist yet, query without it
    if (error?.message?.includes("folderId") || error?.message?.includes("does not exist")) {
      logger.warn({ userId, error: error.message }, "Campaign folder columns not yet migrated, querying without folder relation");
      return await prisma.campaign.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          sheetSourceId: true,
          name: true,
          status: true,
          sendStrategy: true,
          trackingConfig: true,
          createdAt: true,
          updatedAt: true,
          scheduledSendAt: true,
          recipients: {
            select: {
              id: true,
              status: true,
            },
          },
          messages: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      });
    }
    throw error;
  }
};

const getCampaignSummary = async (campaignId: string) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      recipients: true,
      messages: true,
      followUps: {
        include: {
          steps: true,
        },
      },
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  const recipients = campaign.recipients as CampaignRecipient[];
  const messages = campaign.messages as MessageLog[];

  const totalRecipients = recipients.length;

  let sentCount = 0;
  let failedCount = 0;
  for (const recipient of recipients) {
    if (recipient.status === RecipientStatus.SENT) {
      sentCount += 1;
    } else if (recipient.status === RecipientStatus.FAILED) {
      failedCount += 1;
    }
  }

  let opens = 0;
  let clicks = 0;
  for (const message of messages) {
    opens += message.opens;
    clicks += message.clicks;
  }

  return {
    campaign,
    metrics: {
      totalRecipients,
      sentCount,
      failedCount,
      opens,
      clicks,
    },
  };
};

export const campaignEngine = {
  createCampaign,
  scheduleCampaign,
  pauseCampaign,
  cancelCampaign,
  processCampaignDispatch,
  processFollowUpDispatch,
  processTrackingEvent,
  createFollowUpSequence,
  listFollowUpSequences,
  listCampaignsForUser,
  getCampaignSummary,
  DEFAULT_TRACKING_CONFIG,
};

