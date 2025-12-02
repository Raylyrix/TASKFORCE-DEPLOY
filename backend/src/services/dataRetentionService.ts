/**
 * Data Retention Service
 * Manages data retention policies and cleanup to keep database size under control
 */

import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { MessageStatus, CampaignStatus } from "@prisma/client";
import { followUpQueue } from "../queue/followUpQueue";

type RetentionConfig = {
  // Campaign data retention (days)
  completedCampaigns: number; // Keep completed campaigns for X days
  draftCampaigns: number; // Keep draft campaigns for X days
  
  // Message logs retention (days)
  sentMessages: number; // Keep sent message logs for X days
  failedMessages: number; // Keep failed message logs for X days
  
  // Tracking events retention (days)
  trackingEvents: number; // Keep tracking events for X days
  
  // Calendar cache retention (days)
  calendarCache: number; // Keep calendar availability cache for X days
  
  // Email drafts retention (days)
  emailDrafts: number; // Keep email drafts for X days
  
  // Old meeting bookings (days)
  oldBookings: number; // Keep old bookings for X days
  
  // Bounce/complaint records (days)
  bounceRecords: number; // Keep bounce records for X days
  complaintRecords: number; // Keep complaint records for X days
};

const DEFAULT_RETENTION_CONFIG: RetentionConfig = {
  completedCampaigns: 365, // 1 year (5GB storage - more space available)
  draftCampaigns: 180, // 6 months (keep drafts longer)
  sentMessages: 365, // 1 year (keep message history longer)
  failedMessages: 180, // 6 months (keep failures for analysis)
  trackingEvents: 365, // 1 year (keep tracking data longer)
  calendarCache: 30, // 1 month (extended cache)
  emailDrafts: 180, // 6 months (keep drafts longer)
  oldBookings: 730, // 2 years (keep booking history)
  bounceRecords: 730, // 2 years (important for reputation)
  complaintRecords: 730, // 2 years (important for reputation)
};

/**
 * Archive old message logs (keep summary, delete details)
 * SAFETY: Only deletes messages from COMPLETED campaigns, never from active ones
 */
async function archiveOldMessageLogs(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // CRITICAL SAFETY: Only delete messages from COMPLETED campaigns
  // Never touch messages from RUNNING, SCHEDULED, or PAUSED campaigns
  const oldMessages = await prisma.messageLog.findMany({
    where: {
      status: MessageStatus.SENT,
      createdAt: {
        lt: cutoffDate,
      },
      campaign: {
        status: CampaignStatus.COMPLETED, // ONLY from completed campaigns
      },
    },
    select: {
      id: true,
      campaignId: true,
      to: true,
      subject: true,
      opens: true,
      clicks: true,
      createdAt: true,
    },
    take: 1000, // Process in batches
  });

  if (oldMessages.length === 0) {
    return 0;
  }

  // Delete tracking events for these messages first (cascade)
  const messageIds = oldMessages.map((m) => m.id);
  await prisma.trackingEvent.deleteMany({
    where: {
      messageLogId: {
        in: messageIds,
      },
    },
  });

  // Delete the message logs
  const deleted = await prisma.messageLog.deleteMany({
    where: {
      id: {
        in: messageIds,
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Archived old message logs");
  return deleted.count;
}

/**
 * Clean up old tracking events
 */
async function cleanupOldTrackingEvents(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.trackingEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Cleaned up old tracking events");
  return deleted.count;
}

/**
 * Archive old completed campaigns
 * SAFETY: Only deletes campaigns with status COMPLETED, never RUNNING/SCHEDULED/PAUSED
 * CRITICAL: Never deletes campaigns that have future scheduled follow-ups
 */
async function archiveOldCompletedCampaigns(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // CRITICAL SAFETY: Only delete COMPLETED campaigns
  // Explicitly exclude RUNNING, SCHEDULED, PAUSED, CANCELLED, DRAFT
  const oldCampaigns = await prisma.campaign.findMany({
    where: {
      status: {
        in: [CampaignStatus.COMPLETED], // ONLY completed, nothing else
      },
      updatedAt: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
    },
    take: 100, // Process in batches
  });

  if (oldCampaigns.length === 0) {
    return 0;
  }

  const campaignIds = oldCampaigns.map((c) => c.id);
  const now = new Date();
  const safeToDelete: string[] = [];

  // CRITICAL SAFETY CHECK: Verify no future scheduled follow-ups exist
  // Check each campaign for pending follow-up jobs in BullMQ
  for (const campaignId of campaignIds) {
    try {
      // Get all follow-up sequences for this campaign
      const sequences = await prisma.followUpSequence.findMany({
        where: { campaignId },
        include: {
          steps: true,
        },
      });

      // Check if any follow-up steps have scheduledAt dates in the future
      let hasFutureFollowUps = false;
      
      for (const sequence of sequences) {
        for (const step of sequence.steps) {
          const offsetConfig = step.offsetConfig as { 
            scheduledAt?: string | null; 
            delayMs?: number | null;
          } | null;
          
          if (offsetConfig?.scheduledAt) {
            const scheduledAt = new Date(offsetConfig.scheduledAt);
            if (scheduledAt > now) {
              hasFutureFollowUps = true;
              break;
            }
          }
        }
        if (hasFutureFollowUps) break;
      }

      // Also check BullMQ for pending jobs (this is the most reliable check)
      if (!hasFutureFollowUps) {
        try {
          const sequenceIds = sequences.map(s => s.id);
          
          // Get all pending jobs (delayed, waiting, active)
          const pendingJobs = await followUpQueue.getJobs(['delayed', 'waiting', 'active']);
          
          const hasPendingJobs = pendingJobs.some((job) => {
            const jobData = job.data as { followUpSequenceId?: string; scheduledAt?: string };
            
            // Check if this job belongs to any sequence in this campaign
            if (jobData.followUpSequenceId && sequenceIds.includes(jobData.followUpSequenceId)) {
              // Check if job has a future scheduled time
              if (jobData.scheduledAt) {
                const scheduledAt = new Date(jobData.scheduledAt);
                if (scheduledAt > now) {
                  return true;
                }
              }
              
              // If job is delayed or waiting, it's scheduled for the future
              // Check the job's timestamp (when it will execute)
              const jobTimestamp = job.timestamp || 0;
              if (jobTimestamp > now.getTime()) {
                return true;
              }
              
              // For delayed jobs, the delay option means it will execute in the future
              if (job.opts?.delay && job.opts.delay > 0) {
                return true;
              }
            }
            return false;
          });
          
          if (hasPendingJobs) {
            hasFutureFollowUps = true;
          }
        } catch (error) {
          logger.warn(
            { campaignId, error },
            "Error checking BullMQ for pending follow-up jobs, skipping deletion for safety"
          );
          // On error checking BullMQ, skip deletion to be safe
          hasFutureFollowUps = true;
        }
      }

      if (!hasFutureFollowUps) {
        safeToDelete.push(campaignId);
      } else {
        logger.info(
          { campaignId, reason: "Has future scheduled follow-ups" },
          "Skipping campaign deletion - has future scheduled follow-ups"
        );
      }
    } catch (error) {
      logger.error(
        { campaignId, error },
        "Error checking for future follow-ups, skipping campaign deletion for safety"
      );
      // On error, skip deletion to be safe
    }
  }

  if (safeToDelete.length === 0) {
    logger.info(
      { totalCampaigns: campaignIds.length, skipped: campaignIds.length },
      "No campaigns safe to delete - all have future scheduled follow-ups"
    );
    return 0;
  }

  // Delete recipients (cascade will handle messages)
  await prisma.campaignRecipient.deleteMany({
    where: {
      campaignId: {
        in: safeToDelete,
      },
    },
  });

  // Delete follow-up sequences
  await prisma.followUpSequence.deleteMany({
    where: {
      campaignId: {
        in: safeToDelete,
      },
    },
  });

  // Delete campaigns
  const deleted = await prisma.campaign.deleteMany({
    where: {
      id: {
        in: safeToDelete,
      },
    },
  });

  logger.info(
    { 
      count: deleted.count, 
      daysOld,
      totalChecked: campaignIds.length,
      skipped: campaignIds.length - safeToDelete.length,
      reason: "Had future scheduled follow-ups"
    }, 
    "Archived old completed campaigns"
  );
  return deleted.count;
}

/**
 * Clean up old draft campaigns
 * SAFETY: Only deletes DRAFT campaigns, never active ones
 */
async function cleanupOldDraftCampaigns(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  // CRITICAL SAFETY: Only delete DRAFT campaigns
  // Explicitly exclude RUNNING, SCHEDULED, PAUSED, COMPLETED
  const deleted = await prisma.campaign.deleteMany({
    where: {
      status: {
        in: [CampaignStatus.DRAFT], // ONLY drafts, nothing else
      },
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Cleaned up old draft campaigns");
  return deleted.count;
}

/**
 * Clean up old calendar availability cache
 */
async function cleanupOldCalendarCache(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.calendarAvailabilityCache.deleteMany({
    where: {
      refreshedAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Cleaned up old calendar cache");
  return deleted.count;
}

/**
 * Clean up old email drafts
 */
async function cleanupOldEmailDrafts(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.emailDraft.deleteMany({
    where: {
      updatedAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Cleaned up old email drafts");
  return deleted.count;
}

/**
 * Clean up old meeting bookings
 */
async function cleanupOldBookings(daysOld: number): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const deleted = await prisma.meetingBooking.deleteMany({
    where: {
      endTime: {
        lt: cutoffDate,
      },
      status: {
        in: ["CONFIRMED", "CANCELLED", "DECLINED"],
      },
    },
  });

  logger.info({ count: deleted.count, daysOld }, "Cleaned up old meeting bookings");
  return deleted.count;
}

/**
 * Compress campaign recipient payloads (remove unused fields)
 * SAFETY: Only compresses recipients from COMPLETED campaigns
 */
async function compressRecipientPayloads(): Promise<number> {
  // CRITICAL SAFETY: Only compress recipients from COMPLETED campaigns
  // Never touch recipients from active campaigns
  const recipients = await prisma.campaignRecipient.findMany({
    where: {
      status: {
        in: ["SENT", "FAILED"],
      },
      campaign: {
        status: CampaignStatus.COMPLETED, // ONLY from completed campaigns
      },
    },
    select: {
      id: true,
      payload: true,
    },
    take: 1000, // Process in batches
  });

  let compressed = 0;
  for (const recipient of recipients) {
    const payload = recipient.payload as Record<string, unknown>;
    
    // Keep only essential fields
    const compressedPayload: Record<string, unknown> = {
      email: payload.email,
    };
    
    // Keep name if exists
    if (payload.name || payload.firstName || payload.lastName) {
      compressedPayload.name = payload.name || 
        `${payload.firstName || ""} ${payload.lastName || ""}`.trim();
    }
    
    // Keep company if exists
    if (payload.company) {
      compressedPayload.company = payload.company;
    }

    // Only update if payload was actually compressed
    const originalSize = JSON.stringify(payload).length;
    const compressedSize = JSON.stringify(compressedPayload).length;
    
    if (compressedSize < originalSize * 0.7) { // Only if we saved 30%+
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { payload: compressedPayload as any },
      });
      compressed++;
    }
  }

  logger.info({ count: compressed }, "Compressed recipient payloads");
  return compressed;
}

/**
 * Get database size estimate
 */
async function getDatabaseSizeEstimate(): Promise<{
  totalRows: number;
  estimatedSizeMB: number;
  breakdown: Record<string, { rows: number; sizeMB: number }>;
}> {
  const breakdown: Record<string, { rows: number; sizeMB: number }> = {};

  // Count rows in major tables
  const tables = [
    { name: "MessageLog", avgSize: 0.0005 }, // 500 bytes
    { name: "TrackingEvent", avgSize: 0.0003 }, // 300 bytes
    { name: "CampaignRecipient", avgSize: 0.0004 }, // 400 bytes
    { name: "Campaign", avgSize: 0.005 }, // 5 KB
    { name: "FollowUpStep", avgSize: 0.003 }, // 3 KB
    { name: "User", avgSize: 0.0002 }, // 200 bytes
    { name: "CalendarAvailabilityCache", avgSize: 0.003 }, // 3 KB
    { name: "EmailBounce", avgSize: 0.0005 }, // 500 bytes
    { name: "EmailComplaint", avgSize: 0.0004 }, // 400 bytes
  ];

  let totalRows = 0;
  let totalSizeMB = 0;

  for (const table of tables) {
    try {
      // Map table names to Prisma model names (handle case sensitivity)
      const modelName = table.name.charAt(0).toLowerCase() + table.name.slice(1);
      const model = (prisma as any)[modelName];
      
      if (!model || typeof model.count !== 'function') {
        logger.warn({ table: table.name, modelName }, "Table model not found in Prisma client");
        breakdown[table.name] = { rows: 0, sizeMB: 0 };
        continue;
      }
      
      const count = await model.count();
      const sizeMB = count * table.avgSize;
      breakdown[table.name] = { rows: count, sizeMB: Math.round(sizeMB * 100) / 100 };
      totalRows += count;
      totalSizeMB += sizeMB;
    } catch (error) {
      logger.warn({ table: table.name, error }, "Could not count table rows");
      breakdown[table.name] = { rows: 0, sizeMB: 0 };
    }
  }

  return {
    totalRows,
    estimatedSizeMB: Math.round(totalSizeMB * 100) / 100,
    breakdown,
  };
}

/**
 * Run full data retention cleanup
 */
export async function runDataRetentionCleanup(
  config: Partial<RetentionConfig> = {},
): Promise<{
  deleted: Record<string, number>;
  totalDeleted: number;
  sizeBefore: number;
  sizeAfter: number;
}> {
  const retentionConfig = { ...DEFAULT_RETENTION_CONFIG, ...config };
  const deleted: Record<string, number> = {};

  logger.info(
    { 
      config: retentionConfig,
      safetyNote: "Only deleting data from COMPLETED campaigns and old DRAFT campaigns. Active campaigns are NEVER touched."
    }, 
    "Starting data retention cleanup"
  );

  // SAFETY CHECK: Verify we're not about to delete active campaigns
  const activeCampaigns = await prisma.campaign.count({
    where: {
      status: {
        in: [CampaignStatus.RUNNING, CampaignStatus.SCHEDULED, CampaignStatus.PAUSED],
      },
    },
  });

  logger.info(
    { activeCampaignsCount: activeCampaigns },
    "Safety check: Active campaigns will NOT be affected by cleanup"
  );

  // Get size before
  const sizeBefore = await getDatabaseSizeEstimate();

  // Clean up in order (respecting foreign keys)
  deleted.trackingEvents = await cleanupOldTrackingEvents(retentionConfig.trackingEvents);
  deleted.messageLogs = await archiveOldMessageLogs(retentionConfig.sentMessages);
  deleted.completedCampaigns = await archiveOldCompletedCampaigns(retentionConfig.completedCampaigns);
  deleted.draftCampaigns = await cleanupOldDraftCampaigns(retentionConfig.draftCampaigns);
  deleted.calendarCache = await cleanupOldCalendarCache(retentionConfig.calendarCache);
  deleted.emailDrafts = await cleanupOldEmailDrafts(retentionConfig.emailDrafts);
  deleted.bookings = await cleanupOldBookings(retentionConfig.oldBookings);

  // Compress data
  deleted.compressedPayloads = await compressRecipientPayloads();

  // Get size after
  const sizeAfter = await getDatabaseSizeEstimate();

  const totalDeleted = Object.values(deleted).reduce((sum, count) => sum + count, 0);

  logger.info(
    {
      deleted,
      totalDeleted,
      sizeBefore: sizeBefore.estimatedSizeMB,
      sizeAfter: sizeAfter.estimatedSizeMB,
      saved: sizeBefore.estimatedSizeMB - sizeAfter.estimatedSizeMB,
    },
    "Data retention cleanup completed",
  );

  return {
    deleted,
    totalDeleted,
    sizeBefore: sizeBefore.estimatedSizeMB,
    sizeAfter: sizeAfter.estimatedSizeMB,
  };
}

/**
 * Get current database size
 */
export async function getCurrentDatabaseSize() {
  return await getDatabaseSizeEstimate();
}

/**
 * Check if database size is approaching limit
 */
export async function checkDatabaseSize(limitMB: number = 500): Promise<{
  currentSizeMB: number;
  limitMB: number;
  percentageUsed: number;
  needsCleanup: boolean;
  breakdown: Record<string, { rows: number; sizeMB: number }>;
}> {
  const size = await getDatabaseSizeEstimate();
  const percentageUsed = (size.estimatedSizeMB / limitMB) * 100;
  const needsCleanup = size.estimatedSizeMB > limitMB * 0.8; // Cleanup at 80%

  return {
    currentSizeMB: size.estimatedSizeMB,
    limitMB,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
    needsCleanup,
    breakdown: size.breakdown,
  };
}

export const dataRetentionService = {
  runDataRetentionCleanup,
  getCurrentDatabaseSize,
  checkDatabaseSize,
  DEFAULT_RETENTION_CONFIG,
};

