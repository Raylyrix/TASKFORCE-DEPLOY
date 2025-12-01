/**
 * Admin API Routes
 * Admin dashboard endpoints for metrics and data management
 */

import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../../middleware/adminAuth";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";
import { dataRetentionService } from "../../services/dataRetentionService";
import { CampaignStatus, MessageStatus, RecipientStatus } from "@prisma/client";

export const adminRouter = Router();

// All routes require admin access
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/metrics
 * Get real-time system metrics
 */
adminRouter.get("/metrics", async (req, res, next) => {
  try {
    // Get total counts
    const [
      totalUsers,
      totalCampaigns,
      totalRecipients,
      totalMessages,
      totalTrackingEvents,
      activeCampaigns,
      runningCampaigns,
      scheduledCampaigns,
      pausedCampaigns,
      completedCampaigns,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.campaign.count(),
      prisma.campaignRecipient.count(),
      prisma.messageLog.count(),
      prisma.trackingEvent.count(),
      prisma.campaign.count({
        where: {
          status: {
            in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED],
          },
        },
      }),
      prisma.campaign.count({
        where: { status: CampaignStatus.RUNNING },
      }),
      prisma.campaign.count({
        where: { status: CampaignStatus.SCHEDULED },
      }),
      prisma.campaign.count({
        where: { status: CampaignStatus.PAUSED },
      }),
      prisma.campaign.count({
        where: { status: CampaignStatus.COMPLETED },
      }),
    ]);

    // Get message status breakdown
    const messageStatusBreakdown = await prisma.messageLog.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get recipient status breakdown
    const recipientStatusBreakdown = await prisma.campaignRecipient.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get tracking event breakdown
    const trackingEventBreakdown = await prisma.trackingEvent.groupBy({
      by: ["type"],
      _count: true,
    });

    // Get database size estimate
    const dbSize = await dataRetentionService.getCurrentDatabaseSize();

    // Get recent activity (last 24 hours)
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    const [
      messagesLast24h,
      trackingEventsLast24h,
      campaignsCreatedLast24h,
    ] = await Promise.all([
      prisma.messageLog.count({
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      }),
      prisma.trackingEvent.count({
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      }),
      prisma.campaign.count({
        where: {
          createdAt: {
            gte: last24Hours,
          },
        },
      }),
    ]);

    // Get top users by campaign count
    const topUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: {
        campaigns: {
          _count: "desc",
        },
      },
      take: 10,
    });

    // Get campaign growth over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyCampaigns = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "Campaign"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyMessages = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "MessageLog"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyTrackingEvents = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "TrackingEvent"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    res.status(200).json({
      overview: {
        totalUsers,
        totalCampaigns,
        totalRecipients,
        totalMessages,
        totalTrackingEvents,
        activeCampaigns,
        databaseSizeMB: dbSize.estimatedSizeMB,
        totalRows: dbSize.totalRows,
      },
      campaignStatus: {
        running: runningCampaigns,
        scheduled: scheduledCampaigns,
        paused: pausedCampaigns,
        completed: completedCampaigns,
        active: activeCampaigns,
      },
      messageStatus: messageStatusBreakdown.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recipientStatus: recipientStatusBreakdown.reduce(
        (acc, item) => {
          acc[item.status] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      trackingEvents: trackingEventBreakdown.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      recentActivity: {
        messagesLast24h,
        trackingEventsLast24h,
        campaignsCreatedLast24h,
      },
      topUsers: topUsers.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        campaignCount: user._count.campaigns,
      })),
      charts: {
        dailyCampaigns: dailyCampaigns.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
        dailyMessages: dailyMessages.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
        dailyTrackingEvents: dailyTrackingEvents.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
      },
      databaseBreakdown: dbSize.breakdown,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching admin metrics");
    next(error);
  }
});

/**
 * GET /api/admin/active-campaigns
 * Get list of active campaigns (for safety verification)
 */
adminRouter.get("/active-campaigns", async (req, res, next) => {
  try {
    const activeCampaigns = await prisma.campaign.findMany({
      where: {
        status: {
          in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED],
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        userId: true,
        createdAt: true,
        updatedAt: true,
        scheduledSendAt: true,
        _count: {
          select: {
            recipients: true,
            messages: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    res.status(200).json({
      activeCampaigns,
      count: activeCampaigns.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching active campaigns");
    next(error);
  }
});

/**
 * POST /api/admin/delete-data
 * Safely delete old data (never touches active campaigns)
 */
const deleteDataSchema = z.object({
  completedCampaigns: z.number().optional(),
  draftCampaigns: z.number().optional(),
  sentMessages: z.number().optional(),
  trackingEvents: z.number().optional(),
  calendarCache: z.number().optional(),
  emailDrafts: z.number().optional(),
  oldBookings: z.number().optional(),
  confirmActiveCampaigns: z.boolean().optional(), // Safety confirmation
});

adminRouter.post("/delete-data", async (req, res, next) => {
  try {
    const config = deleteDataSchema.parse(req.body);

    // SAFETY CHECK: Verify active campaigns won't be affected
    const activeCampaigns = await prisma.campaign.count({
      where: {
        status: {
          in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED],
        },
      },
    });

    logger.info(
      {
        config,
        activeCampaignsCount: activeCampaigns,
        adminEmail: (req as any).currentUser?.email,
      },
      "Admin delete data request"
    );

    // Run cleanup with safety guarantees
    const result = await dataRetentionService.runDataRetentionCleanup(config);

    // Verify active campaigns still exist after cleanup
    const activeCampaignsAfter = await prisma.campaign.count({
      where: {
        status: {
          in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED],
        },
      },
    });

    if (activeCampaignsAfter !== activeCampaigns) {
      logger.error(
        {
          before: activeCampaigns,
          after: activeCampaignsAfter,
        },
        "CRITICAL: Active campaigns count changed after cleanup!"
      );
      res.status(500).json({
        error: "Safety check failed: Active campaigns were affected",
        message: "Cleanup was aborted. No data was deleted.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Data deleted safely. Active campaigns were not affected.",
      result,
      safetyCheck: {
        activeCampaignsBefore: activeCampaigns,
        activeCampaignsAfter,
        verified: activeCampaignsAfter === activeCampaigns,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", issues: error.issues });
      return;
    }
    logger.error({ error }, "Error deleting data");
    next(error);
  }
});

/**
 * GET /api/admin/database-size
 * Get current database size and breakdown
 */
adminRouter.get("/database-size", async (req, res, next) => {
  try {
    const size = await dataRetentionService.getCurrentDatabaseSize();
    const check = await dataRetentionService.checkDatabaseSize(500);

    res.status(200).json({
      ...size,
      status: check,
    });
  } catch (error) {
    logger.error({ error }, "Error getting database size");
    next(error);
  }
});

/**
 * GET /api/admin/is-admin
 * Check if current user is admin
 */
adminRouter.get("/is-admin", async (req, res) => {
  // If this endpoint is reached, user is admin (middleware verified)
  res.status(200).json({
    isAdmin: true,
    email: (req as any).currentUser?.email,
  });
});

