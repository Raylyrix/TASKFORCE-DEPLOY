import type { RequestHandler } from "express";
import crypto from "crypto";

import { logger } from "../lib/logger";

/**
 * Security middleware to prevent common attacks
 */

// CSRF token validation
const csrfTokens = new Map<string, { token: string; expiresAt: number }>();
const CSRF_TOKEN_EXPIRY = 30 * 60 * 1000; // 30 minutes

export const csrfProtection: RequestHandler = (req, res, next) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionId = req.headers["x-session-id"] as string;
  const csrfToken = req.headers["x-csrf-token"] as string;

  if (!sessionId || !csrfToken) {
    logger.warn({ ip: req.ip, path: req.path }, "CSRF token missing");
    return res.status(403).json({ error: "CSRF token required" });
  }

  const stored = csrfTokens.get(sessionId);
  if (!stored || stored.token !== csrfToken || Date.now() > stored.expiresAt) {
    logger.warn({ ip: req.ip, path: req.path }, "Invalid CSRF token");
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
};

export const generateCsrfToken = (sessionId: string): string => {
  const token = crypto.randomBytes(32).toString("hex");
  csrfTokens.set(sessionId, {
    token,
    expiresAt: Date.now() + CSRF_TOKEN_EXPIRY,
  });
  return token;
};

// XSS Protection - Sanitize input
export const sanitizeInput = (input: unknown): unknown => {
  if (typeof input === "string") {
    // Remove potentially dangerous characters
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+\s*=/gi, "")
      .trim();
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input && typeof input === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  return input;
};

export const xssProtection: RequestHandler = (req, res, next) => {
  // Sanitize body
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeInput(req.body) as typeof req.body;
  }

  // Note: req.query is read-only in Express, so we can't sanitize it directly
  // Query parameters are already parsed by Express and should be validated in route handlers
  // If sanitization is needed, it should be done per-route using validation libraries like Zod

  next();
};

// Request size limiting
export const requestSizeLimit: RequestHandler = (req, res, next) => {
  const contentLength = parseInt(req.headers["content-length"] || "0", 10);
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  if (contentLength > MAX_SIZE) {
    logger.warn({ ip: req.ip, size: contentLength }, "Request too large");
    return res.status(413).json({ error: "Request entity too large" });
  }

  next();
};

// Security headers
export const securityHeaders: RequestHandler = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // XSS Protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  
  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://www.googleapis.com https://accounts.google.com;"
  );
  
  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions Policy
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
};

// IP whitelist (optional, for admin endpoints)
const ADMIN_IPS = (process.env.ADMIN_IPS || "").split(",").filter(Boolean);

export const ipWhitelist = (allowedIPs: string[] = ADMIN_IPS): RequestHandler => {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "";
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(ip)) {
      logger.warn({ ip, path: req.path }, "IP not whitelisted");
      return res.status(403).json({ error: "Access denied" });
    }
    
    next();
  };
};

// Request ID for tracking
export const requestId: RequestHandler = (req, res, next) => {
  const id = crypto.randomBytes(16).toString("hex");
  req.headers["x-request-id"] = id;
  res.setHeader("X-Request-ID", id);
  next();
};

// Audit logging for sensitive operations
export const auditLog = (action: string, userId?: string, details?: Record<string, unknown>) => {
  logger.info(
    {
      action,
      userId,
      timestamp: new Date().toISOString(),
      ...details,
    },
    "Audit log",
  );
};

