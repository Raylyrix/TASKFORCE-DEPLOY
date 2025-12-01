/**
 * Data Retention API Routes
 * Endpoints for managing data retention and database cleanup
 */

import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../../middleware/requireUser";
import { dataRetentionService } from "../../services/dataRetentionService";
import { logger } from "../../lib/logger";

export const dataRetentionRouter = Router();

// All routes require authentication
dataRetentionRouter.use(requireUser);

/**
 * GET /api/data-retention/size
 * Get current database size estimate
 */
dataRetentionRouter.get("/size", async (req, res, next) => {
  try {
    const size = await dataRetentionService.getCurrentDatabaseSize();
    res.status(200).json(size);
  } catch (error) {
    logger.error({ error }, "Error getting database size");
    next(error);
  }
});

/**
 * GET /api/data-retention/check
 * Check if database size is approaching limit
 */
dataRetentionRouter.get("/check", async (req, res, next) => {
  try {
    const limitMB = req.query.limitMB ? Number(req.query.limitMB) : 500;
    const status = await dataRetentionService.checkDatabaseSize(limitMB);
    res.status(200).json(status);
  } catch (error) {
    logger.error({ error }, "Error checking database size");
    next(error);
  }
});

/**
 * POST /api/data-retention/cleanup
 * Run data retention cleanup
 */
const cleanupSchema = z.object({
  completedCampaigns: z.number().optional(),
  draftCampaigns: z.number().optional(),
  sentMessages: z.number().optional(),
  failedMessages: z.number().optional(),
  trackingEvents: z.number().optional(),
  calendarCache: z.number().optional(),
  emailDrafts: z.number().optional(),
  oldBookings: z.number().optional(),
  bounceRecords: z.number().optional(),
  complaintRecords: z.number().optional(),
});

dataRetentionRouter.post("/cleanup", async (req, res, next) => {
  try {
    const config = cleanupSchema.parse(req.body);
    const result = await dataRetentionService.runDataRetentionCleanup(config);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid request", issues: error.issues });
      return;
    }
    logger.error({ error }, "Error running data retention cleanup");
    next(error);
  }
});

