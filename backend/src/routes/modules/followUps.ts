import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { prisma } from "../../lib/prisma";
import { campaignEngine } from "../../services/campaignEngine";

export const followUpsRouter = Router();

const followUpStepSchema = z.object({
  delayMs: z.number().int().min(0).optional(), // Relative delay in milliseconds
  scheduledAt: z.string().datetime().optional(), // Absolute scheduled date/time (ISO 8601)
  subject: z.string().min(1),
  html: z.string().min(1),
  sendAsReply: z.boolean().optional().default(false),
  parentStepId: z.string().optional(),
  isNested: z.boolean().optional().default(false),
}).refine(
  (data) => data.delayMs !== undefined || data.scheduledAt !== undefined,
  { message: "Either delayMs or scheduledAt must be provided" }
);

const createFollowUpSchema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1),
  steps: z.array(followUpStepSchema).min(1),
});

const automationTargetSchema = z.union([
  z.object({ type: z.literal("label"), labelIds: z.array(z.string().min(1)).min(1) }),
  z.object({ type: z.literal("query"), query: z.string().min(1) }),
  z.object({ type: z.literal("folder"), folderId: z.string().min(1) }),
]);

const automationConditionSchema = z.object({
  field: z.enum(["noReplySince", "hasLabel", "threadStatus", "manualTag"]),
  operator: z.enum(["gt", "lt", "includes", "excludes", "equals"]),
  value: z.string(),
  unit: z.enum(["hours", "days"]).optional(),
});

const automationActionSchema = z.object({
  type: z.enum(["sendEmail", "applyLabel", "stopSequence"]),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  labelId: z.string().optional(),
});

const daysOfWeekEnum = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const automationScheduleSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("relative"),
    sendAfterHours: z.number().int().min(0).optional(),
    sendAfterDays: z.number().int().min(0).optional(),
    timezone: z.string(),
  }),
  z.object({
    mode: z.literal("absolute"),
    sendAt: z.string().min(1),
    timezone: z.string(),
  }),
  z.object({
    mode: z.literal("weekly"),
    daysOfWeek: z.array(daysOfWeekEnum).min(1),
    sendTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "sendTime must be in HH:MM 24h format"),
    timezone: z.string(),
  }),
]);

const automationStopConditionsSchema = z.object({
  onReply: z.boolean().optional(),
  onOpen: z.boolean().optional(),
  onClick: z.boolean().optional(),
});

const automationRuleSchema = z.object({
  name: z.string().min(1),
  schedule: automationScheduleSchema,
  conditions: z.array(automationConditionSchema),
  actions: z.array(automationActionSchema).min(1),
  stopConditions: automationStopConditionsSchema.optional(),
  maxFollowUps: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

const createAutomationSchema = z.object({
  target: automationTargetSchema,
  timezone: z.string().min(1),
  rules: z.array(automationRuleSchema).min(1),
});

type AutomationRecord = z.infer<typeof createAutomationSchema> & {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  rules: Array<
    z.infer<typeof automationRuleSchema> & {
      id: string;
      conditions: Array<z.infer<typeof automationConditionSchema> & { id: string }>;
      actions: Array<z.infer<typeof automationActionSchema> & { id: string }>;
    }
  >;
};

const automationStore = new Map<string, AutomationRecord[]>();

followUpsRouter.get("/automations", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const automations = (automationStore.get(req.currentUser.id) ?? []).map((automation) => ({
      ...automation,
      rules: automation.rules.map((rule) => ({
        ...rule,
        stopConditions:
          rule.stopConditions ??
          {
            onReply: (rule as unknown as { stopOnReply?: boolean }).stopOnReply ?? true,
            onOpen: false,
            onClick: false,
          },
      })),
    }));
    res.status(200).json({ automations });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createFollowUpSchema.parse(req.body ?? {});

    const campaign = await prisma.campaign.findUnique({
      where: { id: payload.campaignId },
    });

    if (!campaign || campaign.userId !== req.currentUser.id) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Transform Zod-validated steps to FollowUpStepConfig format
    const steps = payload.steps.map((step) => ({
      delayMs: step.delayMs,
      scheduledAt: step.scheduledAt,
      subject: step.subject,
      html: step.html,
      sendAsReply: step.sendAsReply ?? false,
      parentStepId: step.parentStepId,
      isNested: step.isNested ?? false,
    }));

    const sequence = await campaignEngine.createFollowUpSequence(payload.campaignId, {
      name: payload.name,
      steps,
    });

    res.status(201).json({ sequence });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.get("/:campaignId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.userId !== req.currentUser.id) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const sequences = await campaignEngine.listFollowUpSequences(campaignId);

    res.status(200).json({ sequences });
  } catch (error) {
    next(error);
  }
});

// Manual follow-up sending endpoint (not tied to a campaign)
const manualFollowUpSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  html: z.string().min(1),
  sendAsReply: z.boolean().optional().default(false),
  replyToMessageId: z.string().optional(), // Gmail message ID to reply to
  parentFollowUpId: z.string().optional(), // If this is a nested follow-up, the parent follow-up message log ID
  isNested: z.boolean().optional().default(false),
});

followUpsRouter.post("/send", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = manualFollowUpSchema.parse(req.body ?? {});

    // Import required services
    const { gmailDeliveryService } = await import("../../services/gmailDelivery.js");
    const { googleAuthService } = await import("../../services/googleAuth.js");
    
    // Simple HTML to text converter (inline to avoid dependency)
    const htmlToText = (html: string): string => {
      return html
        .replace(/<style[^>]*>.*?<\/style>/gi, '')
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    };

    let threadId: string | null = null;
    let inReplyTo: string | null = null;
    let references: string | null = null;
    let replySubject: string | null = null;

    // If sendAsReply is true, fetch the message to reply to
    if (payload.sendAsReply && payload.replyToMessageId) {
      try {
        const authClient = await googleAuthService.getAuthorizedClientForUser(req.currentUser.id);
        const { google } = await import("googleapis");
        const gmail = google.gmail({
          version: "v1",
          auth: authClient,
        });
        
        const gmailMessage = await gmail.users.messages.get({
          userId: "me",
          id: payload.replyToMessageId,
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
      } catch (error) {
        // If we can't fetch the message, log warning but continue
        console.warn("Failed to fetch Gmail message for reply threading:", error);
      }
    }

    // Use reply subject if available, otherwise use provided subject
    const finalSubject = (payload.sendAsReply && replySubject) ? replySubject : payload.subject;
    const canSendAsReply = payload.sendAsReply && threadId && inReplyTo;

    // Send the email
    const sendResult = await gmailDeliveryService.sendEmailViaGmail({
      userId: req.currentUser.id,
      to: payload.to,
      subject: finalSubject,
      bodyHtml: payload.html,
      bodyText: htmlToText(payload.html),
      threadId: canSendAsReply ? threadId : null,
      inReplyTo: canSendAsReply ? inReplyTo : null,
      references: canSendAsReply ? references : null,
      isCampaign: false, // Manual follow-up, not a campaign
    });

    // Optionally save to message log if parentFollowUpId is provided (for nested follow-ups)
    if (payload.isNested && payload.parentFollowUpId) {
      const parentMessage = await prisma.messageLog.findUnique({
        where: { id: payload.parentFollowUpId },
      });

      if (parentMessage && parentMessage.campaignRecipientId) {
        await prisma.messageLog.create({
          data: {
            campaignId: parentMessage.campaignId,
            campaignRecipientId: parentMessage.campaignRecipientId,
            subject: finalSubject,
            to: payload.to,
            status: "SENT",
            sendAt: new Date(),
            gmailMessageId: sendResult.id,
          },
        });
      }
    }

    res.status(200).json({ 
      success: true, 
      messageId: sendResult.id,
      sentAsReply: canSendAsReply,
    });
  } catch (error) {
    next(error);
  }
});

followUpsRouter.post("/automations", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createAutomationSchema.parse(req.body ?? {});
    const normalizedRules = payload.rules.map((rule) => ({
      ...rule,
      stopConditions: {
        onReply: rule.stopConditions?.onReply ?? true,
        onOpen: rule.stopConditions?.onOpen ?? false,
        onClick: rule.stopConditions?.onClick ?? false,
      },
    }));

    const existing = automationStore.get(req.currentUser.id) ?? [];

    const automation: AutomationRecord = {
      ...payload,
      id: randomUUID(),
      userId: req.currentUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastRunAt: null,
      nextRunAt: null,
      rules: normalizedRules.map((rule) => ({
        ...rule,
        id: randomUUID(),
        conditions: rule.conditions.map((condition) => ({ ...condition, id: randomUUID() })),
        actions: rule.actions.map((action) => ({ ...action, id: randomUUID() })),
      })),
    };

    existing.push(automation);
    automationStore.set(req.currentUser.id, existing);

    res.status(201).json({ automation });
  } catch (error) {
    next(error);
  }
});


