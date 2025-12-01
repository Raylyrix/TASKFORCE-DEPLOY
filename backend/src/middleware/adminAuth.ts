/**
 * Admin Authentication Middleware
 * Verifies that the user is an admin (rayvicalraylyrix@gmail.com)
 */

import type { Request, Response, NextFunction } from "express";
import { requireUser } from "./requireUser";
import { logger } from "../lib/logger";

// Extend Express Request type to include currentUser
declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        email: string;
        displayName?: string | null;
        pictureUrl?: string | null;
      };
    }
  }
}

const ADMIN_EMAIL = "rayvicalraylyrix@gmail.com";

/**
 * Middleware to require admin access
 * Must be used after requireUser middleware
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // First ensure user is authenticated
    await new Promise<void>((resolve, reject) => {
      requireUser(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check if user is admin
    const user = (req as any).currentUser;
    
    if (!user || !user.email) {
      res.status(401).json({ error: "Unauthorized: User not found" });
      return;
    }

    if (user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      logger.warn(
        { email: user.email, attemptedEndpoint: req.path },
        "Non-admin user attempted to access admin endpoint"
      );
      res.status(403).json({ 
        error: "Forbidden: Admin access required",
        message: "This endpoint requires administrator privileges"
      });
      return;
    }

    // User is admin, proceed
    logger.info({ email: user.email, endpoint: req.path }, "Admin access granted");
    next();
  } catch (error) {
    logger.error({ error }, "Error in admin authentication");
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};

/**
 * Check if a user is an admin (helper function)
 */
export const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

