import type { RequestHandler } from "express";
import crypto from "crypto";

import { logger } from "../lib/logger";
import { getRedis } from "../lib/redis";

/**
 * API Key Authentication
 * For additional security, require API keys for sensitive operations
 */

const API_KEYS = new Map<string, { userId: string; permissions: string[]; createdAt: Date }>();

/**
 * Generate API key for a user
 */
export const generateApiKey = (userId: string, permissions: string[] = ["read", "write"]): string => {
  const key = `tf_${crypto.randomBytes(32).toString("hex")}`;
  API_KEYS.set(key, {
    userId,
    permissions,
    createdAt: new Date(),
  });
  return key;
};

/**
 * Validate API key
 */
export const validateApiKey = (apiKey: string): { userId: string; permissions: string[] } | null => {
  const keyData = API_KEYS.get(apiKey);
  if (!keyData) {
    return null;
  }
  return {
    userId: keyData.userId,
    permissions: keyData.permissions,
  };
};

/**
 * API Key authentication middleware
 * Optional - can be enabled for additional security
 */
export const apiKeyAuth: RequestHandler = (req, res, next) => {
  // Skip if API key auth is not enabled
  if (process.env.REQUIRE_API_KEY !== "true") {
    return next();
  }

  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    logger.warn({ ip: req.ip, path: req.path }, "API key missing");
    return res.status(401).json({ error: "API key required" });
  }

  const keyData = validateApiKey(apiKey);
  if (!keyData) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid API key");
    return res.status(401).json({ error: "Invalid API key" });
  }

  // Attach user info to request
  req.apiKeyUser = keyData;

  next();
};

/**
 * Request signing for additional security
 * Validates request signature to prevent tampering
 */
export const requestSigning: RequestHandler = (req, res, next) => {
  // Skip for GET requests
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const signature = req.headers["x-signature"] as string;
  const timestamp = req.headers["x-timestamp"] as string;

  if (!signature || !timestamp) {
    // Optional - only enforce if enabled
    if (process.env.REQUIRE_REQUEST_SIGNING === "true") {
      return res.status(401).json({ error: "Request signature required" });
    }
    return next();
  }

  // Validate timestamp (prevent replay attacks)
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes

  if (Math.abs(now - requestTime) > MAX_AGE) {
    logger.warn({ ip: req.ip }, "Request timestamp expired");
    return res.status(401).json({ error: "Request expired" });
  }

  // Verify signature
  const secret = process.env.REQUEST_SIGNING_SECRET;
  if (!secret) {
    return next(); // Skip if not configured
  }

  const body = JSON.stringify(req.body);
  const message = `${req.method}${req.path}${timestamp}${body}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  if (signature !== expectedSignature) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid request signature");
    return res.status(401).json({ error: "Invalid request signature" });
  }

  next();
};


