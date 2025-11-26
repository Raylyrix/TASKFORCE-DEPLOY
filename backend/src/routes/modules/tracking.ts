import { Router } from "express";

import { trackingQueue } from "../../queue/trackingQueue";
import { prisma } from "../../lib/prisma";
import { requireUser } from "../../middleware/requireUser";

export const trackingRouter = Router();

const transparentPixel = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

trackingRouter.get("/pixel/:messageLogId", async (req, res, next) => {
  try {
    const { messageLogId } = req.params;

    const messageLog = await prisma.messageLog.findUnique({
      where: { id: messageLogId },
    });

    if (!messageLog) {
      res.status(404).send();
      return;
    }

    // Track open event with metadata
    await trackingQueue.add("track-event", {
      messageLogId,
      eventType: "OPEN",
      occurredAt: new Date().toISOString(),
      meta: {
        userAgent: req.headers["user-agent"],
        ip: req.ip || req.socket.remoteAddress,
        referer: req.headers.referer,
      },
    });

    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, must-revalidate");
    res.setHeader("Content-Length", transparentPixel.length.toString());
    res.status(200).send(transparentPixel);
  } catch (error) {
    next(error);
  }
});

// Click tracking endpoint
trackingRouter.get("/click", async (req, res, next) => {
  try {
    const { url, msg } = req.query;

    if (!url || !msg || typeof url !== "string" || typeof msg !== "string") {
      res.status(400).send("Invalid tracking parameters");
      return;
    }

    const messageLogId = msg;
    const originalUrl = decodeURIComponent(url);

    const messageLog = await prisma.messageLog.findUnique({
      where: { id: messageLogId },
    });

    if (!messageLog) {
      // Still redirect even if message log not found
      res.redirect(originalUrl);
      return;
    }

    // Track click event with metadata
    await trackingQueue.add("track-event", {
      messageLogId,
      eventType: "CLICK",
      occurredAt: new Date().toISOString(),
      meta: {
        url: originalUrl,
        userAgent: req.headers["user-agent"],
        ip: req.ip || req.socket.remoteAddress,
        referer: req.headers.referer,
      },
    });

    // Redirect to original URL
    res.redirect(originalUrl);
  } catch (error) {
    // On error, still try to redirect
    const url = req.query.url;
    if (url && typeof url === "string") {
      try {
        res.redirect(decodeURIComponent(url));
      } catch {
        next(error);
      }
    } else {
      next(error);
    }
  }
});

// Get tracking status for sent emails (for Gmail UI injection)
trackingRouter.get("/sent-emails", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Get all sent messages for this user with tracking events
    const messages = await prisma.messageLog.findMany({
      where: {
        campaign: {
          userId: currentUser.id,
        },
      },
      include: {
        trackingEvents: {
          where: {
            type: "OPEN",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Just need to know if it was opened
        },
        campaign: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000, // Limit to recent messages
    });

    // Map to email -> tracking status
    const trackingMap: Record<string, { opened: boolean; openedAt?: string; subject: string }> = {};

    for (const message of messages) {
      const key = `${message.to.toLowerCase()}|${message.subject}`;
      const hasOpened = message.trackingEvents.length > 0;
      
      if (!trackingMap[key] || (hasOpened && !trackingMap[key].opened)) {
        trackingMap[key] = {
          opened: hasOpened,
          openedAt: hasOpened ? message.trackingEvents[0].createdAt.toISOString() : undefined,
          subject: message.subject,
        };
      }
    }

    res.status(200).json({ tracking: trackingMap });
  } catch (error) {
    next(error);
  }
});

// Get detailed analytics for a campaign or message
trackingRouter.get("/analytics", requireUser, async (req, res, next) => {
  try {
    const currentUser = req.currentUser;
    if (!currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const campaignId = typeof req.query.campaignId === "string" ? req.query.campaignId : undefined;
    const messageLogId = typeof req.query.messageLogId === "string" ? req.query.messageLogId : undefined;

    if (messageLogId) {
      // Get analytics for a single message
      const messageLog = await prisma.messageLog.findFirst({
        where: {
          id: messageLogId,
          campaign: {
            userId: currentUser.id,
          },
        },
        include: {
          trackingEvents: {
            orderBy: {
              createdAt: "desc",
            },
          },
          campaign: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!messageLog) {
        res.status(404).json({ error: "Message not found" });
        return;
      }

      const opens = messageLog.trackingEvents.filter((e) => e.type === "OPEN");
      const clicks = messageLog.trackingEvents.filter((e) => e.type === "CLICK");

      // Calculate engagement score (0-100)
      const engagementScore = messageLog.opens > 0
        ? Math.min(100, Math.round((messageLog.clicks / messageLog.opens) * 50 + (messageLog.opens > 0 ? 50 : 0)))
        : 0;

      res.status(200).json({
        messageLog: {
          id: messageLog.id,
          subject: messageLog.subject,
          to: messageLog.to,
          opens: messageLog.opens,
          clicks: messageLog.clicks,
          engagementScore,
          firstOpenedAt: opens[0]?.createdAt.toISOString(),
          lastOpenedAt: opens[opens.length - 1]?.createdAt.toISOString(),
          firstClickedAt: clicks[0]?.createdAt.toISOString(),
          lastClickedAt: clicks[clicks.length - 1]?.createdAt.toISOString(),
          clickRate: messageLog.opens > 0 ? ((messageLog.clicks / messageLog.opens) * 100).toFixed(2) : "0.00",
        },
        events: messageLog.trackingEvents.map((e) => ({
          type: e.type,
          createdAt: e.createdAt.toISOString(),
          meta: e.meta,
        })),
      });
    } else if (campaignId) {
      // Get analytics for a campaign
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          userId: currentUser.id,
        },
        include: {
          messages: {
            include: {
              trackingEvents: true,
            },
          },
        },
      });

      if (!campaign) {
        res.status(404).json({ error: "Campaign not found" });
        return;
      }

      const totalSent = campaign.messages.filter((m) => m.status === "SENT").length;
      const totalOpens = campaign.messages.reduce((sum, m) => sum + m.opens, 0);
      const totalClicks = campaign.messages.reduce((sum, m) => sum + m.clicks, 0);
      const uniqueOpens = new Set(
        campaign.messages.flatMap((m) =>
          m.trackingEvents.filter((e) => e.type === "OPEN").map((e) => e.messageLogId),
        ),
      ).size;

      const openRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(2) : "0.00";
      const clickRate = totalOpens > 0 ? ((totalClicks / totalOpens) * 100).toFixed(2) : "0.00";
      const clickToOpenRate = totalOpens > 0 ? ((totalClicks / totalOpens) * 100).toFixed(2) : "0.00";

      res.status(200).json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
        },
        metrics: {
          totalSent,
          totalOpens,
          totalClicks,
          uniqueOpens,
          openRate: `${openRate}%`,
          clickRate: `${clickRate}%`,
          clickToOpenRate: `${clickToOpenRate}%`,
        },
        messages: campaign.messages.map((m) => ({
          id: m.id,
          to: m.to,
          subject: m.subject,
          opens: m.opens,
          clicks: m.clicks,
          engagementScore: m.opens > 0
            ? Math.min(100, Math.round((m.clicks / m.opens) * 50 + 50))
            : 0,
          sentAt: m.sendAt?.toISOString(),
        })),
      });
    } else {
      res.status(400).json({ error: "campaignId or messageLogId required" });
    }
  } catch (error) {
    next(error);
  }
});


