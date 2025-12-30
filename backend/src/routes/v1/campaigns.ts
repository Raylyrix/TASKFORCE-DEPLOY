import { Router } from "express";
import { z } from "zod";

import { requireApiKey, requireScope } from "../../middleware/apiKeyAuthV1";
import { campaignEngine } from "../../services/campaignEngine";
import { prisma } from "../../lib/prisma";

export const campaignsV1Router = Router();

// All routes require API key authentication
campaignsV1Router.use(requireApiKey);

const createCampaignSchema = z.object({
  name: z.string().min(1),
  recipients: z.object({
    emailField: z.string().min(1),
    rows: z.array(z.record(z.string(), z.string())).min(1),
  }),
  strategy: z.object({
    startAt: z.string().datetime().optional(),
    delayMsBetweenEmails: z.number().int().min(0).default(30_000),
    trackOpens: z.boolean().optional().default(true),
    trackClicks: z.boolean().optional().default(true),
    template: z.object({
      subject: z.string().min(1),
      html: z.string().min(1),
      attachments: z.array(z.object({
        filename: z.string(),
        content: z.string(), // base64
        contentType: z.string().optional(),
      })).optional().default([]),
    }),
  }).optional(),
  folderId: z.string().optional(),
});

// List campaigns
campaignsV1Router.get("/", requireScope("campaigns:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string | undefined;
    const folderId = req.query.folderId as string | undefined;

    const where: any = { userId };
    if (status) where.status = status;
    if (folderId) where.folderId = folderId;

    const [campaigns, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          scheduledSendAt: true,
          recipients: {
            select: {
              id: true,
              email: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);

    res.json({
      success: true,
      data: campaigns.map(c => ({
        ...c,
        recipientCount: c.recipients.length,
        recipients: undefined, // Don't include full recipient list in list view
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get campaign
campaignsV1Router.get("/:id", requireScope("campaigns:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        recipients: {
          select: {
            id: true,
            email: true,
            status: true,
            createdAt: true,
            lastSentAt: true,
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: campaign,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create campaign
campaignsV1Router.post("/", requireScope("campaigns:write"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const body = createCampaignSchema.parse(req.body);

    const recipients = body.recipients.rows
      .map((row) => {
        const email = row[body.recipients.emailField]?.trim();
        if (!email) return null;
        return { email, payload: row };
      })
      .filter((entry): entry is { email: string; payload: Record<string, string> } => Boolean(entry));

    if (recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "No valid recipients found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    const strategy = body.strategy ? {
      startAt: body.strategy.startAt || new Date().toISOString(),
      delayMsBetweenEmails: body.strategy.delayMsBetweenEmails || 30_000,
      trackOpens: body.strategy.trackOpens ?? true,
      trackClicks: body.strategy.trackClicks ?? true,
      template: body.strategy.template,
    } : {
      startAt: new Date().toISOString(),
      delayMsBetweenEmails: 30_000,
      trackOpens: true,
      trackClicks: true,
      template: {
        subject: "Untitled Campaign",
        html: "<p>Hello {{email}}</p>",
        attachments: [],
      },
    };

    const campaign = await campaignEngine.createCampaign({
      userId,
      name: body.name,
      recipients,
      strategy,
      folderId: body.folderId,
    });

    res.status(201).json({
      success: true,
      data: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        recipientCount: campaign.recipients.length,
        createdAt: campaign.createdAt.toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Schedule campaign
campaignsV1Router.post("/:id/schedule", requireScope("campaigns:write"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;
    // Backward/forward compatible scheduling:
    // - Allow empty body => schedule at campaign.strategy.startAt (or now)
    // - Accept sendAt as alias (common client field)
    // - Never throw ZodError to the global handler (it returns 500); return 400 instead.
    const scheduleParse = z.object({
      startAt: z.string().datetime().optional(),
      sendAt: z.string().datetime().optional(),
    }).safeParse(req.body ?? {});

    if (!scheduleParse.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid schedule payload. Expected { startAt?: ISO datetime } or { sendAt?: ISO datetime }",
        },
        meta: {
          issues: scheduleParse.error.issues,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Verify ownership
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Determine schedule time
    const fromRequest = scheduleParse.data.startAt || scheduleParse.data.sendAt || null;
    const fromStrategy = (() => {
      try {
        const s = campaign.sendStrategy as any;
        const candidate = typeof s?.startAt === "string" ? s.startAt : null;
        if (!candidate) return null;
        const d = new Date(candidate);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
      } catch {
        return null;
      }
    })();

    const startAt = fromRequest || fromStrategy || new Date().toISOString();

    await campaignEngine.scheduleCampaign(campaignId, startAt);

    res.json({
      success: true,
      data: {
        campaignId,
        status: "scheduled",
        startAt,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Pause campaign
campaignsV1Router.post("/:id/pause", requireScope("campaigns:write"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    await campaignEngine.pauseCampaign(campaignId);

    res.json({
      success: true,
      data: {
        campaignId,
        status: "paused",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Resume campaign (schedule with current time)
campaignsV1Router.post("/:id/resume", requireScope("campaigns:write"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    await campaignEngine.scheduleCampaign(campaignId, new Date().toISOString());

    res.json({
      success: true,
      data: {
        campaignId,
        status: "scheduled",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Cancel campaign
campaignsV1Router.post("/:id/cancel", requireScope("campaigns:write"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    await campaignEngine.cancelCampaign(campaignId);

    res.json({
      success: true,
      data: {
        campaignId,
        status: "cancelled",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get campaign analytics
campaignsV1Router.get("/:id/analytics", requireScope("analytics:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const campaignId = req.params.id;

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        recipients: {
          include: {
            messages: {
              select: {
                status: true,
                opens: true,
                clicks: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Campaign not found",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    const totalRecipients = campaign.recipients.length;
    const sent = campaign.recipients.filter(r => r.status === "SENT").length;
    const failed = campaign.recipients.filter(r => r.status === "FAILED").length;
    const unsubscribed = campaign.recipients.filter(r => r.status === "UNSUBSCRIBED").length;
    const bounced = campaign.recipients.filter(r => r.status === "BOUNCED").length;

    let totalOpens = 0;
    let totalClicks = 0;
    campaign.recipients.forEach(r => {
      r.messages.forEach(m => {
        totalOpens += m.opens;
        totalClicks += m.clicks;
      });
    });

    const openRate = sent > 0 ? (totalOpens / sent) * 100 : 0;
    const clickRate = sent > 0 ? (totalClicks / sent) * 100 : 0;
    const deliveryRate = totalRecipients > 0 ? (sent / totalRecipients) * 100 : 0;

    res.json({
      success: true,
      data: {
        totalRecipients,
        sent,
        failed,
        opened: totalOpens,
        clicked: totalClicks,
        unsubscribed,
        bounced,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

