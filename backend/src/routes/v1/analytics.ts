import { Router } from "express";

import { requireApiKey, requireScope } from "../../middleware/apiKeyAuthV1";
import { prisma } from "../../lib/prisma";

export const analyticsV1Router = Router();

analyticsV1Router.use(requireApiKey);

// Get user analytics
analyticsV1Router.get("/", requireScope("analytics:read"), async (req, res, next) => {
  try {
    const userId = req.apiKey!.userId;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    // Get campaign stats
    const campaigns = await prisma.campaign.findMany({
      where,
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

    const totalCampaigns = campaigns.length;
    const campaignsByStatus = campaigns.reduce((acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate email stats
    let totalSent = 0;
    let totalOpens = 0;
    let totalClicks = 0;
    let totalBounced = 0;

    campaigns.forEach(campaign => {
      campaign.recipients.forEach(recipient => {
        recipient.messages.forEach(message => {
          if (message.status === "SENT" || message.status === "DELIVERED") {
            totalSent++;
          }
          if (message.status === "BOUNCED") {
            totalBounced++;
          }
          totalOpens += message.opens;
          totalClicks += message.clicks;
        });
      });
    });

    const openRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
    const clickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

    res.json({
      success: true,
      data: {
        campaigns: {
          total: totalCampaigns,
          byStatus: campaignsByStatus,
        },
        emails: {
          sent: totalSent,
          opened: totalOpens,
          clicked: totalClicks,
          bounced: totalBounced,
        },
        rates: {
          openRate: Math.round(openRate * 100) / 100,
          clickRate: Math.round(clickRate * 100) / 100,
          bounceRate: Math.round(bounceRate * 100) / 100,
        },
      },
      meta: {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

