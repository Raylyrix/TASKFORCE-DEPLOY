import type { RequestHandler } from "express";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

/**
 * Audit logging middleware
 * Logs all data access and modifications for security auditing
 */

interface AuditLogEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ip: string;
  userAgent?: string;
  method: string;
  path: string;
  statusCode?: number;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// Store audit logs in memory (in production, use a separate audit log database)
const auditLogs: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 10000; // Keep last 10k logs in memory

export const auditLogger: RequestHandler = (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const duration = Date.now() - startTime;

    const auditEntry: AuditLogEntry = {
      userId: req.currentUser?.id,
      action: req.method,
      resource: req.path.split("/")[2] || "unknown",
      resourceId: req.params.id || req.params.campaignId || req.params.meetingTypeId,
      ip: req.ip || req.socket.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"],
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      metadata: {
        duration,
        query: req.query,
        bodySize: req.headers["content-length"],
      },
      timestamp: new Date(),
    };

    // Log sensitive operations
    if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
      logger.info(auditEntry, "Audit log - Data modification");
    }

    // Store in memory (rotate if needed)
    auditLogs.push(auditEntry);
    if (auditLogs.length > MAX_AUDIT_LOGS) {
      auditLogs.shift();
    }

    return originalJson(body);
  };

  next();
};

/**
 * Get audit logs for a user (admin only)
 */
export const getAuditLogs = async (userId?: string, limit: number = 100) => {
  return auditLogs
    .filter((log) => !userId || log.userId === userId)
    .slice(-limit)
    .reverse();
};

/**
 * Log sensitive data access
 */
export const logDataAccess = (
  userId: string,
  resource: string,
  resourceId: string,
  action: string,
  metadata?: Record<string, unknown>,
) => {
  logger.info(
    {
      userId,
      resource,
      resourceId,
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    },
    "Sensitive data access",
  );
};


