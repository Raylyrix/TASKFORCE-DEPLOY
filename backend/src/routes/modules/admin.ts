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
 * Get real-time system metrics with customizable time periods
 * Query params: period=24h|7d|30d|90d|365d (default: 30d)
 */
adminRouter.get("/metrics", async (req, res, next) => {
  try {
    // Parse time period from query params
    const period = req.query.period as string || "30d";
    const periodMap: Record<string, number> = {
      "24h": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "180d": 180,
      "365d": 365,
    };
    
    const daysToLookback = periodMap[period] || 30;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToLookback);

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

    // Get new users in period
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: cutoffDate,
        },
      },
    });

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
        createdAt: true,
        _count: {
          select: {
            campaigns: true,
            scheduledEmails: true,
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

    // Get users by email sent count
    const userEmailStats = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        _count: {
          select: {
            campaigns: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    });

    // Get message counts per user
    const userMessageCounts = await prisma.$queryRaw<Array<{ userId: string; email: string; messageCount: bigint; campaignCount: bigint }>>`
      SELECT 
        u.id as "userId",
        u.email,
        COUNT(DISTINCT ml.id)::bigint as "messageCount",
        COUNT(DISTINCT c.id)::bigint as "campaignCount"
      FROM "User" u
      LEFT JOIN "Campaign" c ON c."userId" = u.id
      LEFT JOIN "MessageLog" ml ON ml."campaignId" = c.id
      GROUP BY u.id, u.email
      ORDER BY "messageCount" DESC
      LIMIT 50
    `;

    // Get campaign growth over time (customizable period)
    const dailyCampaigns = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "Campaign"
      WHERE "createdAt" >= ${cutoffDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyMessages = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "MessageLog"
      WHERE "createdAt" >= ${cutoffDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const dailyTrackingEvents = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "TrackingEvent"
      WHERE "createdAt" >= ${cutoffDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Get new users over time
    const dailyNewUsers = await prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT 
        DATE("createdAt")::text as date,
        COUNT(*)::bigint as count
      FROM "User"
      WHERE "createdAt" >= ${cutoffDate}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    res.status(200).json({
      period: {
        selected: period,
        days: daysToLookback,
        startDate: cutoffDate.toISOString(),
        endDate: new Date().toISOString(),
      },
      overview: {
        totalUsers,
        newUsers,
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
        scheduledEmailCount: user._count.scheduledEmails,
        createdAt: user.createdAt,
      })),
      userEmailStats: userMessageCounts.map((stat) => ({
        userId: stat.userId,
        email: stat.email,
        totalEmailsSent: Number(stat.messageCount),
        totalCampaigns: Number(stat.campaignCount),
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
        dailyNewUsers: dailyNewUsers.map((item) => ({
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
 * GET /api/admin/failed-scheduled-emails
 * Get all failed scheduled emails
 */
adminRouter.get("/failed-scheduled-emails", async (req, res, next) => {
  try {
    const failedEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: "FAILED",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        scheduledAt: "desc",
      },
      take: 100,
    });

    res.status(200).json({
      failedEmails: failedEmails.map((email) => ({
        id: email.id,
        to: email.to,
        subject: email.subject,
        scheduledAt: email.scheduledAt,
        error: email.error,
        user: email.user,
        createdAt: email.createdAt,
      })),
      count: failedEmails.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching failed scheduled emails");
    next(error);
  }
});

/**
 * POST /api/admin/restart-scheduled-email/:id
 * Restart a failed scheduled email
 */
adminRouter.post("/restart-scheduled-email/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const scheduledEmail = await prisma.scheduledEmail.findUnique({
      where: { id },
    });

    if (!scheduledEmail) {
      res.status(404).json({ error: "Scheduled email not found" });
      return;
    }

    if (scheduledEmail.status !== "FAILED") {
      res.status(400).json({ 
        error: "Can only restart failed emails",
        currentStatus: scheduledEmail.status,
      });
      return;
    }

    // Update status to PENDING and reset error
    await prisma.scheduledEmail.update({
      where: { id },
      data: {
        status: "PENDING",
        error: null,
        sentAt: null,
      },
    });

    logger.info(
      {
        scheduledEmailId: id,
        adminEmail: (req as any).currentUser?.email,
        to: scheduledEmail.to,
        subject: scheduledEmail.subject,
      },
      "Admin restarted failed scheduled email"
    );

    res.status(200).json({
      success: true,
      message: "Scheduled email restarted successfully",
      scheduledEmail: {
        id,
        to: scheduledEmail.to,
        subject: scheduledEmail.subject,
        scheduledAt: scheduledEmail.scheduledAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Error restarting scheduled email");
    next(error);
  }
});

/**
 * POST /api/admin/restart-all-failed-emails
 * Restart all failed scheduled emails
 */
adminRouter.post("/restart-all-failed-emails", async (req, res, next) => {
  try {
    const result = await prisma.scheduledEmail.updateMany({
      where: {
        status: "FAILED",
      },
      data: {
        status: "PENDING",
        error: null,
        sentAt: null,
      },
    });

    logger.info(
      {
        count: result.count,
        adminEmail: (req as any).currentUser?.email,
      },
      "Admin restarted all failed scheduled emails"
    );

    res.status(200).json({
      success: true,
      message: `Restarted ${result.count} failed scheduled emails`,
      count: result.count,
    });
  } catch (error) {
    logger.error({ error }, "Error restarting all failed emails");
    next(error);
  }
});

/**
 * GET /api/admin/user-stats
 * Get detailed user statistics including emails sent per user
 */
adminRouter.get("/user-stats", async (req, res, next) => {
  try {
    // Get users with detailed stats
    const userStats = await prisma.$queryRaw<Array<{
      userId: string;
      email: string;
      displayName: string | null;
      createdAt: Date;
      totalCampaigns: bigint;
      totalEmailsSent: bigint;
      totalEmailsFailed: bigint;
      totalScheduledEmails: bigint;
      lastCampaignDate: Date | null;
    }>>`
      SELECT 
        u.id as "userId",
        u.email,
        u."displayName",
        u."createdAt",
        COUNT(DISTINCT c.id)::bigint as "totalCampaigns",
        COUNT(DISTINCT CASE WHEN ml.status = 'SENT' THEN ml.id END)::bigint as "totalEmailsSent",
        COUNT(DISTINCT CASE WHEN ml.status = 'FAILED' THEN ml.id END)::bigint as "totalEmailsFailed",
        COUNT(DISTINCT se.id)::bigint as "totalScheduledEmails",
        MAX(c."createdAt") as "lastCampaignDate"
      FROM "User" u
      LEFT JOIN "Campaign" c ON c."userId" = u.id
      LEFT JOIN "MessageLog" ml ON ml."campaignId" = c.id
      LEFT JOIN "ScheduledEmail" se ON se."userId" = u.id
      GROUP BY u.id, u.email, u."displayName", u."createdAt"
      ORDER BY "totalEmailsSent" DESC
    `;

    res.status(200).json({
      users: userStats.map((stat) => ({
        userId: stat.userId,
        email: stat.email,
        displayName: stat.displayName,
        createdAt: stat.createdAt,
        totalCampaigns: Number(stat.totalCampaigns),
        totalEmailsSent: Number(stat.totalEmailsSent),
        totalEmailsFailed: Number(stat.totalEmailsFailed),
        totalScheduledEmails: Number(stat.totalScheduledEmails),
        lastCampaignDate: stat.lastCampaignDate,
      })),
      totalUsers: userStats.length,
    });
  } catch (error) {
    logger.error({ error }, "Error fetching user stats");
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

