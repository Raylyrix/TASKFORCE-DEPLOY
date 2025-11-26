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

type RecipientRecord = Record<string, string>;

export type SendStrategy = {
  startAt: string;
  delayMsBetweenEmails: number;
  trackOpens: boolean;
  trackClicks: boolean;
  template: {
    subject: string;
    html: string;
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
  delayMs: number;
  subject: string;
  html: string;
  maxAttempts?: number;
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
  
  // Clean the template - remove any non-printable characters except newlines and tabs
  const cleanedTemplate = template.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");
  
  return cleanedTemplate.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key: string) => {
    const value = data[key];
    // Only use the value if it's a valid string, otherwise use empty string
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return "";
  });
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

  // Add tracking pixel for opens
  if (tracking?.trackingPixelUrl) {
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
        delayMs?: number;
        condition?: "always" | "if_not_opened" | "if_not_replied" | "if_not_clicked";
      }) ?? {};
      
      const scheduledAt = addMilliseconds(baseDate, stepOffset.delayMs ?? 0);
      
      await followUpQueue.add("send-follow-up", {
        followUpSequenceId: sequence.id,
        followUpStepId: step.id,
        recipientId,
        scheduledAt: scheduledAt.toISOString(),
        attempt: 1,
        condition: stepOffset.condition ?? "always",
        stopOnReply: sequenceSettings.stopOnReply ?? false,
        stopOnOpen: sequenceSettings.stopOnOpen ?? false,
      });
    }
  }
};

const processCampaignDispatch = async (job: CampaignDispatchJob) => {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: job.recipientId },
    include: {
      campaign: true,
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

  // Sanitize subject template - ensure it's a clean string
  const subjectTemplate = String(strategy.template.subject || "").trim();
  if (!subjectTemplate || subjectTemplate.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id },
      "Campaign subject template is empty",
    );
    throw new Error("Campaign subject template is empty. Please update the campaign.");
  }

  // Sanitize HTML template
  const htmlTemplate = String(strategy.template.html || "").trim();
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

  const trackingPixelUrl = sanitizedStrategy.trackOpens
    ? `${AppConfig.publicUrl}/api/tracking/pixel/${messageLog.id}`
    : undefined;

  const clickTrackingBaseUrl = sanitizedStrategy.trackClicks
    ? `${AppConfig.publicUrl}/api/tracking/click`
    : undefined;

  const messageContent = createMessageForRecipient(sanitizedStrategy, payload, {
    trackingPixelUrl,
    clickTrackingBaseUrl,
    messageLogId: messageLog.id,
  });

  // Final validation of rendered subject
  const finalSubject = messageContent.subject.trim();
  if (!finalSubject || finalSubject.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id, renderedSubject: messageContent.subject },
      "Rendered subject is empty after template processing",
    );
    throw new Error("Email subject is empty after template rendering. Please check your campaign template.");
  }

  // Ensure subject is clean before sending
  const cleanSubject = finalSubject.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "").trim();
  
  if (!cleanSubject || cleanSubject.length === 0) {
    logger.error(
      { campaignId: recipient.campaign.id, recipientId: recipient.id, originalSubject: messageContent.subject },
      "Subject is empty after cleaning",
    );
    throw new Error("Email subject is invalid. Please check your campaign template.");
  }

  logger.info(
    { campaignId: recipient.campaign.id, recipientId: recipient.id, subject: cleanSubject },
    "Sending campaign email",
  );

  const sendResult = await gmailDeliveryService.sendEmailViaGmail({
    userId: recipient.campaign.userId,
    to: recipient.email,
    subject: cleanSubject,
    bodyHtml: messageContent.html,
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

  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: job.recipientId },
    include: {
      messages: {
        where: {
          followUpStepId: null, // Original campaign message, not a follow-up
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
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

  // Get the original message for this recipient
  const originalMessage = recipient.messages[0];

  if (originalMessage) {
    // Check if we should stop based on reply
    if (stopOnReply || condition === "if_not_replied") {
      const hasReply = await prisma.trackingEvent.findFirst({
        where: {
          messageLogId: originalMessage.id,
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
          messageLogId: originalMessage.id,
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
          messageLogId: originalMessage.id,
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
  );

  const sendResult = await gmailDeliveryService.sendEmailViaGmail({
    userId: step.sequence.campaign.userId,
    to: recipient.email,
    subject: messageContent.subject,
    bodyHtml: messageContent.html,
  });

  await prisma.messageLog.update({
    where: { id: messageLog.id },
    data: {
      subject: messageContent.subject,
      status: MessageStatus.SENT,
      sendAt: new Date(),
      gmailMessageId: sendResult.id,
    },
  });
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
          offsetConfig: { delayMs: step.delayMs },
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

const listCampaignsForUser = async (userId: string) =>
  prisma.campaign.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
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

