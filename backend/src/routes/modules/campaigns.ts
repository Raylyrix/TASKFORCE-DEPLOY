import { Router } from "express";
import { z } from "zod";

import { cache, cacheKeys, CACHE_TTL } from "../../lib/cache";
import { campaignEngine } from "../../services/campaignEngine";
import { requireUser } from "../../middleware/requireUser";
import { prisma } from "../../lib/prisma";

type CampaignListItem = Awaited<ReturnType<typeof campaignEngine.listCampaignsForUser>>[number];

export const campaignsRouter = Router();

const recipientRecordSchema = z.record(z.string(), z.string());

const attachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string().min(1), // Base64-encoded file content
  contentType: z.string().optional(), // MIME type
  size: z.number().optional(), // File size in bytes
});

const createCampaignSchema = z.object({
  name: z.string().min(1),
  sheetSourceId: z.string().optional(),
  recipients: z.object({
    emailField: z.string().min(1),
    rows: z.array(recipientRecordSchema).min(1),
  }),
  strategy: z
    .object({
      startAt: z.string().datetime().optional(),
      delayMsBetweenEmails: z.number().int().min(0).default(30_000),
      trackOpens: z.boolean().optional(),
      trackClicks: z.boolean().optional(),
      template: z.object({
        subject: z.string().min(1),
        html: z.string().min(1),
        attachments: z.array(attachmentSchema).optional().default([]), // File attachments
      }),
    })
    .optional(),
});

campaignsRouter.post("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = createCampaignSchema.parse(req.body ?? {});

    const strategy = {
      startAt: payload.strategy?.startAt ?? new Date().toISOString(),
      delayMsBetweenEmails: payload.strategy?.delayMsBetweenEmails ?? 30_000,
      trackOpens:
        payload.strategy?.trackOpens ?? campaignEngine.DEFAULT_TRACKING_CONFIG.trackOpens,
      trackClicks:
        payload.strategy?.trackClicks ?? campaignEngine.DEFAULT_TRACKING_CONFIG.trackClicks,
      template: payload.strategy?.template ?? {
        subject: "Untitled Campaign",
        html: "<p>Hello {{email}}</p>",
      },
    };

    const recipients = payload.recipients.rows
      .map((row) => {
        const email = row[payload.recipients.emailField]?.trim();
        if (!email) {
          return null;
        }
        return {
          email,
          payload: row,
        };
      })
      .filter((entry): entry is { email: string; payload: Record<string, string> } => Boolean(entry));

    if (recipients.length === 0) {
      res
        .status(400)
        .json({ error: "No valid recipients found. Check the email field references." });
      return;
    }

    const campaign = await campaignEngine.createCampaign({
      userId: req.currentUser.id,
      name: payload.name,
      sheetSourceId: payload.sheetSourceId,
      recipients,
      strategy,
    });

    res.status(201).json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        recipients: campaign.recipients.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

const scheduleSchema = z.object({
  startAt: z.string().datetime(),
});

campaignsRouter.post("/:campaignId/schedule", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { startAt } = scheduleSchema.parse(req.body ?? {});
    const { campaignId } = req.params;

    await campaignEngine.scheduleCampaign(campaignId, startAt);

    res.status(202).json({ campaignId, status: "scheduled", startAt });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/:campaignId/pause", requireUser, async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    await campaignEngine.pauseCampaign(campaignId);
    res.status(200).json({ campaignId, status: "paused" });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.post("/:campaignId/cancel", requireUser, async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    await campaignEngine.cancelCampaign(campaignId);
    res.status(200).json({ campaignId, status: "cancelled" });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cacheKey = cacheKeys.campaigns(req.currentUser.id);

    // Try cache first (fail silently if cache unavailable)
    let cached: { campaigns: Array<{
      id: string;
      name: string;
      status: string;
      createdAt: Date;
      recipients: { total: number; sent: number };
    }> } | null = null;
    
    try {
      cached = await cache.get<{ campaigns: Array<{
        id: string;
        name: string;
        status: string;
        createdAt: Date;
        recipients: { total: number; sent: number };
      }> }>(cacheKey);
    } catch (error) {
      // Cache error is non-critical, continue without cache
    }

    if (cached) {
      return res.status(200).json(cached);
    }

    const campaigns = await campaignEngine.listCampaignsForUser(req.currentUser.id);

    const normalized = campaigns.map((campaign: CampaignListItem) => {
      const sentCount = campaign.recipients.reduce(
        (count, recipient) => (recipient.status === "SENT" ? count + 1 : count),
        0,
      );

      return {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        createdAt: campaign.createdAt,
        recipients: {
          total: campaign.recipients.length,
          sent: sentCount,
        },
      };
    });

    const result = { campaigns: normalized };

    // Cache the result (fail silently if cache unavailable)
    try {
      await cache.set(cacheKey, result, CACHE_TTL.CAMPAIGNS);
    } catch (error) {
      // Cache error is non-critical, continue
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/:campaignId", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { campaignId } = req.params;
    const summary = await campaignEngine.getCampaignSummary(campaignId);

    res.status(200).json(summary);
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/:campaignId/recipients", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { campaignId } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.currentUser.id,
      },
      include: {
        recipients: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    res.status(200).json({
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        status: recipient.status,
        lastSentAt: recipient.lastSentAt?.toISOString() ?? null,
        createdAt: recipient.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

campaignsRouter.get("/:campaignId/recipients/:email/activity", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { campaignId, email } = req.params;

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.currentUser.id,
      },
      include: {
        recipients: {
          where: {
            email: email.toLowerCase().trim(),
          },
        },
        messages: {
          where: {
            to: email.toLowerCase().trim(),
          },
          include: {
            trackingEvents: {
              orderBy: {
                createdAt: "asc",
              },
            },
            followUpStep: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    const recipient = campaign.recipients[0];
    if (!recipient) {
      res.status(404).json({ error: "Recipient not found in campaign" });
      return;
    }

    const bookings = await prisma.meetingBooking.findMany({
      where: {
        userId: req.currentUser.id,
        inviteeEmail: email.toLowerCase().trim(),
      },
      include: {
        meetingType: {
          select: {
            id: true,
            name: true,
            durationMinutes: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const reminders = await prisma.meetingReminder.findMany({
      where: {
        userId: req.currentUser.id,
        inviteeEmail: email.toLowerCase().trim(),
      },
      include: {
        meetingType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    type TimelineEvent =
      | {
          type: "message";
          id: string;
          timestamp: string;
          subject: string;
          status: string;
          isFollowUp: boolean;
          opens: number;
          clicks: number;
          trackingEvents: Array<{
            type: string;
            timestamp: string;
          }>;
        }
      | {
          type: "booking";
          id: string;
          timestamp: string;
          meetingType: {
            id: string;
            name: string;
            durationMinutes: number;
          };
          startTime: string;
          endTime: string;
          status: string;
        }
      | {
          type: "reminder";
          id: string;
          timestamp: string;
          meetingType: {
            id: string;
            name: string;
          };
          status: string;
          sendCount: number;
        };

    const timeline: TimelineEvent[] = [];

    for (const message of campaign.messages) {
      timeline.push({
        type: "message",
        id: message.id,
        timestamp: message.createdAt.toISOString(),
        subject: message.subject,
        status: message.status,
        isFollowUp: message.followUpStep !== null,
        opens: message.opens,
        clicks: message.clicks,
        trackingEvents: message.trackingEvents.map((event) => ({
          type: event.type,
          timestamp: event.createdAt.toISOString(),
        })),
      });
    }

    for (const booking of bookings) {
      timeline.push({
        type: "booking",
        id: booking.id,
        timestamp: booking.createdAt.toISOString(),
        meetingType: {
          id: booking.meetingType.id,
          name: booking.meetingType.name,
          durationMinutes: booking.meetingType.durationMinutes,
        },
        startTime: booking.startTime.toISOString(),
        endTime: booking.endTime.toISOString(),
        status: booking.status,
      });
    }

    for (const reminder of reminders) {
      timeline.push({
        type: "reminder",
        id: reminder.id,
        timestamp: reminder.createdAt.toISOString(),
        meetingType: {
          id: reminder.meetingType.id,
          name: reminder.meetingType.name,
        },
        status: reminder.status,
        sendCount: reminder.sendCount,
      });
    }

    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    res.status(200).json({
      recipient: {
        id: recipient.id,
        email: recipient.email,
        status: recipient.status,
        lastSentAt: recipient.lastSentAt?.toISOString() ?? null,
        createdAt: recipient.createdAt.toISOString(),
      },
      timeline,
    });
  } catch (error) {
    next(error);
  }
});

