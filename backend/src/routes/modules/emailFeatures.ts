import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";
import { googleAuthService } from "../../services/googleAuth";
import { google } from "googleapis";

export const emailFeaturesRouter = Router();

// ========== DRAFTS ==========

const draftSchema = z.object({
  to: z.string().email(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  html: z.string().optional(),
  threadId: z.string().optional(),
  replyToId: z.string().optional(),
});

emailFeaturesRouter.post("/drafts", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = draftSchema.parse(req.body);
    const draft = await prisma.emailDraft.create({
      data: {
        userId: currentUser.id,
        ...payload,
      },
    });

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/drafts", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const drafts = await prisma.emailDraft.findMany({
      where: { userId: currentUser.id },
      orderBy: { updatedAt: "desc" },
    });

    res.status(200).json({ drafts });
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/drafts/:draftId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { draftId } = req.params;
    const draft = await prisma.emailDraft.findFirst({
      where: { id: draftId, userId: currentUser.id },
    });

    if (!draft) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    res.status(200).json(draft);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.put("/drafts/:draftId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { draftId } = req.params;
    const payload = draftSchema.partial().parse(req.body);

    const draft = await prisma.emailDraft.updateMany({
      where: { id: draftId, userId: currentUser.id },
      data: payload,
    });

    if (draft.count === 0) {
      res.status(404).json({ error: "Draft not found" });
      return;
    }

    const updated = await prisma.emailDraft.findUnique({
      where: { id: draftId },
    });

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.delete("/drafts/:draftId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { draftId } = req.params;
    await prisma.emailDraft.deleteMany({
      where: { id: draftId, userId: currentUser.id },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========== SCHEDULED EMAILS ==========

const scheduledEmailSchema = z.object({
  to: z.string().email(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  html: z.string().optional(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().optional(),
  sendAsReply: z.boolean().optional().default(false), // New: send as reply or separate email
  replyToMessageId: z.string().optional(), // New: message ID to reply to
  replyToThreadId: z.string().optional(), // New: thread ID to reply to
});

emailFeaturesRouter.post("/scheduled", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = scheduledEmailSchema.parse(req.body);
    const scheduled = await prisma.scheduledEmail.create({
      data: {
        userId: currentUser.id,
        to: payload.to,
        cc: payload.cc,
        bcc: payload.bcc,
        subject: payload.subject,
        body: payload.body,
        html: payload.html,
        scheduledAt: new Date(payload.scheduledAt),
        metadata: {
          sendAsReply: payload.sendAsReply ?? false,
          replyToMessageId: payload.replyToMessageId,
          replyToThreadId: payload.replyToThreadId,
        },
      },
    });

    res.status(201).json(scheduled);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/scheduled", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const scheduled = await prisma.scheduledEmail.findMany({
      where: { userId: currentUser.id },
      orderBy: { scheduledAt: "asc" },
    });

    res.status(200).json({ scheduled });
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.delete("/scheduled/:scheduledId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { scheduledId } = req.params;
    await prisma.scheduledEmail.updateMany({
      where: { id: scheduledId, userId: currentUser.id, status: "PENDING" },
      data: { status: "CANCELLED" },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========== TEMPLATES ==========

const templateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  subject: z.string(),
  body: z.string(),
  html: z.string().optional(),
  variables: z.record(z.string(), z.any()).optional(),
  isPublic: z.boolean().optional().default(false),
});

emailFeaturesRouter.post("/templates", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: {
        userId: currentUser.id,
        ...payload,
        variables: payload.variables as any,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/templates", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const templates = await prisma.emailTemplate.findMany({
      where: {
        userId: currentUser.id,
        ...(category ? { category } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    res.status(200).json({ templates });
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/templates/:templateId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { templateId } = req.params;
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, userId: currentUser.id },
    });

    if (!template) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.status(200).json(template);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.put("/templates/:templateId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { templateId } = req.params;
    const payload = templateSchema.partial().parse(req.body);

    await prisma.emailTemplate.updateMany({
      where: { id: templateId, userId: currentUser.id },
      data: {
        ...payload,
        variables: payload.variables as any,
      },
    });

    const updated = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!updated) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.delete("/templates/:templateId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { templateId } = req.params;
    await prisma.emailTemplate.deleteMany({
      where: { id: templateId, userId: currentUser.id },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========== SNOOZE ==========

const snoozeSchema = z.object({
  messageId: z.string(),
  threadId: z.string().optional(),
  snoozeUntil: z.string().datetime(),
  labelIds: z.array(z.string()).optional().default([]),
});

emailFeaturesRouter.post("/snooze", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = snoozeSchema.parse(req.body);
    
    // Get current labels for the message
    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });
    
    let currentLabelIds: string[] = [];
    try {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: payload.messageId,
        format: "metadata",
      });
      currentLabelIds = msg.data.labelIds ?? [];
    } catch (error) {
      // Message might not exist, continue anyway
    }

    // Remove from INBOX temporarily
    await gmail.users.messages.modify({
      userId: "me",
      id: payload.messageId,
      requestBody: {
        removeLabelIds: ["INBOX"],
      },
    });

    const snooze = await prisma.emailSnooze.upsert({
      where: {
        userId_messageId: {
          userId: currentUser.id,
          messageId: payload.messageId,
        },
      },
      create: {
        userId: currentUser.id,
        messageId: payload.messageId,
        threadId: payload.threadId,
        snoozeUntil: new Date(payload.snoozeUntil),
        labelIds: payload.labelIds.length > 0 ? payload.labelIds : currentLabelIds,
      },
      update: {
        threadId: payload.threadId,
        snoozeUntil: new Date(payload.snoozeUntil),
        labelIds: payload.labelIds.length > 0 ? payload.labelIds : currentLabelIds,
      },
    });

    res.status(200).json(snooze);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/snooze", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const snoozes = await prisma.emailSnooze.findMany({
      where: { userId: currentUser.id },
      orderBy: { snoozeUntil: "asc" },
    });

    res.status(200).json({ snoozes });
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.delete("/snooze/:messageId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId } = req.params;
    const snooze = await prisma.emailSnooze.findFirst({
      where: { userId: currentUser.id, messageId },
    });

    if (snooze) {
      // Restore to INBOX
      const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
      const gmail = google.gmail({ version: "v1", auth: client });
      
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: ["INBOX"],
          removeLabelIds: [],
        },
      });

      await prisma.emailSnooze.delete({
        where: { id: snooze.id },
      });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ========== SMART FILTERS ==========

const filterCriteriaSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  hasAttachment: z.boolean().optional(),
  label: z.string().optional(),
  isUnread: z.boolean().optional(),
  isStarred: z.boolean().optional(),
});

const filterActionsSchema = z.object({
  addLabels: z.array(z.string()).optional(),
  removeLabels: z.array(z.string()).optional(),
  archive: z.boolean().optional(),
  markAsRead: z.boolean().optional(),
  markAsUnread: z.boolean().optional(),
  star: z.boolean().optional(),
  forwardTo: z.string().email().optional(),
});

const filterSchema = z.object({
  name: z.string().min(1),
  criteria: filterCriteriaSchema,
  actions: filterActionsSchema,
  isActive: z.boolean().optional(),
});

emailFeaturesRouter.post("/filters", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = filterSchema.parse(req.body);
    const filter = await prisma.emailFilter.create({
      data: {
        userId: currentUser.id,
        name: payload.name,
        criteria: payload.criteria as any,
        actions: payload.actions as any,
        isActive: payload.isActive ?? true,
      },
    });

    res.status(201).json(filter);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/filters", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const filters = await prisma.emailFilter.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ filters });
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.get("/filters/:filterId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { filterId } = req.params;
    const filter = await prisma.emailFilter.findFirst({
      where: { id: filterId, userId: currentUser.id },
    });

    if (!filter) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    res.status(200).json(filter);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.put("/filters/:filterId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { filterId } = req.params;
    const payload = filterSchema.partial().parse(req.body);

    const filter = await prisma.emailFilter.updateMany({
      where: { id: filterId, userId: currentUser.id },
      data: {
        ...(payload.name && { name: payload.name }),
        ...(payload.criteria && { criteria: payload.criteria as any }),
        ...(payload.actions && { actions: payload.actions as any }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      },
    });

    if (filter.count === 0) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    const updatedFilter = await prisma.emailFilter.findUnique({
      where: { id: filterId },
    });

    res.status(200).json(updatedFilter);
  } catch (error) {
    next(error);
  }
});

emailFeaturesRouter.delete("/filters/:filterId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { filterId } = req.params;
    const filter = await prisma.emailFilter.deleteMany({
      where: { id: filterId, userId: currentUser.id },
    });

    if (filter.count === 0) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Execute filters on a message
emailFeaturesRouter.post("/filters/execute/:messageId", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { messageId } = req.params;

    // Get active filters
    const filters = await prisma.emailFilter.findMany({
      where: { userId: currentUser.id, isActive: true },
    });

    // Get message details
    const client = await googleAuthService.getAuthorizedClientForUser(currentUser.id);
    const gmail = google.gmail({ version: "v1", auth: client });

    const { data: messageData } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "To"],
    });

    const headers = (messageData.payload?.headers ?? []).reduce(
      (acc, header) => {
        if (header.name && header.value) {
          acc[header.name.toLowerCase()] = header.value;
        }
        return acc;
      },
      {} as Record<string, string>,
    );

    const from = headers.from || "";
    const to = headers.to || "";
    const subject = headers.subject || "";
    const labelIds = messageData.labelIds || [];
    const hasAttachment = messageData.payload?.parts?.some((p) => p.filename) || false;
    const isUnread = labelIds.includes("UNREAD");
    const isStarred = labelIds.includes("STARRED");

    let matchedFilters = 0;
    const modifications: { addLabelIds?: string[]; removeLabelIds?: string[] } = {};

    for (const filter of filters) {
      const criteria = filter.criteria as any;
      let matches = true;

      // Check criteria
      if (criteria.from && !from.toLowerCase().includes(criteria.from.toLowerCase())) {
        matches = false;
      }
      if (criteria.to && !to.toLowerCase().includes(criteria.to.toLowerCase())) {
        matches = false;
      }
      if (criteria.subject && !subject.toLowerCase().includes(criteria.subject.toLowerCase())) {
        matches = false;
      }
      if (criteria.hasAttachment !== undefined && criteria.hasAttachment !== hasAttachment) {
        matches = false;
      }
      if (criteria.isUnread !== undefined && criteria.isUnread !== isUnread) {
        matches = false;
      }
      if (criteria.isStarred !== undefined && criteria.isStarred !== isStarred) {
        matches = false;
      }
      if (criteria.label && !labelIds.includes(criteria.label)) {
        matches = false;
      }

      if (matches) {
        matchedFilters++;
        const actions = filter.actions as any;

        // Apply actions
        if (actions.addLabels) {
          modifications.addLabelIds = [
            ...(modifications.addLabelIds || []),
            ...actions.addLabels.filter((l: string) => !labelIds.includes(l)),
          ];
        }
        if (actions.removeLabels) {
          modifications.removeLabelIds = [
            ...(modifications.removeLabelIds || []),
            ...actions.removeLabels.filter((l: string) => labelIds.includes(l)),
          ];
        }
        if (actions.archive) {
          modifications.removeLabelIds = [
            ...(modifications.removeLabelIds || []),
            "INBOX",
          ];
        }
        if (actions.markAsRead) {
          modifications.removeLabelIds = [
            ...(modifications.removeLabelIds || []),
            "UNREAD",
          ];
        }
        if (actions.markAsUnread) {
          modifications.addLabelIds = [
            ...(modifications.addLabelIds || []),
            "UNREAD",
          ];
        }
        if (actions.star) {
          modifications.addLabelIds = [
            ...(modifications.addLabelIds || []),
            "STARRED",
          ];
        }

        // Update filter stats
        await prisma.emailFilter.update({
          where: { id: filter.id },
          data: {
            matchCount: { increment: 1 },
            lastMatched: new Date(),
          },
        });
      }
    }

    // Apply modifications if any
    if (modifications.addLabelIds?.length || modifications.removeLabelIds?.length) {
      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: [...new Set(modifications.addLabelIds || [])],
          removeLabelIds: [...new Set(modifications.removeLabelIds || [])],
        },
      });
    }

    res.status(200).json({
      matchedFilters,
      applied: matchedFilters > 0,
    });
  } catch (error) {
    next(error);
  }
});

