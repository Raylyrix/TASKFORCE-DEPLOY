import { Router } from "express";

import { logger } from "../../lib/logger";
import { requireUser } from "../../middleware/requireUser";
import { googleAuthService } from "../../services/googleAuth";

export const healthRouter = Router();

healthRouter.get("/", (req, res) => {
  logger.debug({ path: req.path }, "Health check requested");
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get("/google", requireUser, async (req, res, next) => {
  try {
    if (!req.currentUser) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const status = await googleAuthService.verifyGoogleApis(req.currentUser.id);
    res.status(200).json({
      status: "ok",
      services: status,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

