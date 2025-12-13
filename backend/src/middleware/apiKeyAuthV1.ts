import type { RequestHandler } from "express";
import bcrypt from "bcryptjs";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

/**
 * API Key Authentication for External API (v1)
 * Validates API keys from X-API-Key header
 */

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        userId: string;
        scopes: string[];
        rateLimitTier: string;
        name: string;
      };
    }
  }
}

/**
 * Validate API key from header
 */
export const requireApiKey: RequestHandler = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "MISSING_API_KEY",
          message: "API key required. Provide X-API-Key header.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Find all active API keys for this user (we'll check hash for each)
    // Since we can't query by hash directly, we need to check all active keys
    // This is not ideal for performance, but necessary for security
    // In production, consider using a faster lookup mechanism
    
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        id: true,
        userId: true,
        keyHash: true,
        scopes: true,
        rateLimitTier: true,
        name: true,
        ipWhitelist: true,
      },
    });

    // Check IP whitelist if configured
    const clientIp = req.ip || req.socket.remoteAddress || "";
    
    // Try to match the API key
    let matchedKey: typeof apiKeys[0] | null = null;
    
    for (const key of apiKeys) {
      // Check IP whitelist if configured
      if (key.ipWhitelist && key.ipWhitelist.length > 0) {
        if (!key.ipWhitelist.includes(clientIp)) {
          continue;
        }
      }

      // Verify the API key hash
      try {
        const isValid = await bcrypt.compare(apiKey, key.keyHash);
        if (isValid) {
          matchedKey = key;
          break;
        }
      } catch (error) {
        logger.warn({ error }, "Error comparing API key hash");
        continue;
      }
    }

    if (!matchedKey) {
      logger.warn({ ip: clientIp, path: req.path }, "Invalid API key attempted");
      return res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid or expired API key.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsedAt: new Date() },
    }).catch((error) => {
      // Non-critical error, log but don't fail
      logger.warn({ error, apiKeyId: matchedKey!.id }, "Failed to update API key last used");
    });

    // Attach API key info to request
    req.apiKey = {
      id: matchedKey.id,
      userId: matchedKey.userId,
      scopes: matchedKey.scopes,
      rateLimitTier: matchedKey.rateLimitTier,
      name: matchedKey.name,
    };

    next();
  } catch (error) {
    logger.error({ error }, "API key authentication error");
    return res.status(500).json({
      success: false,
      error: {
        code: "AUTH_ERROR",
        message: "Authentication error occurred.",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  }
};

/**
 * Check if API key has required scope
 */
export const requireScope = (requiredScope: string): RequestHandler => {
  return (req, res, next) => {
    if (!req.apiKey) {
      return res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    if (!req.apiKey.scopes.includes(requiredScope) && !req.apiKey.scopes.includes("*")) {
      return res.status(403).json({
        success: false,
        error: {
          code: "INSUFFICIENT_PERMISSIONS",
          message: `Required scope: ${requiredScope}`,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

/**
 * Optional API key - allows requests with or without API key
 * Useful for endpoints that work for both authenticated and unauthenticated users
 */
export const optionalApiKey: RequestHandler = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"] as string;
  
  if (!apiKey) {
    // No API key provided, continue without authentication
    return next();
  }

  // Try to authenticate if key is provided
  return requireApiKey(req, res, next);
};





