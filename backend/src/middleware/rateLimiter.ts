/**
 * Rate Limiting Middleware
 * Prevents API abuse and server overload
 */

import { rateLimit } from "express-rate-limit";
import { logger } from "../lib/logger";

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    logger.warn(
      { ip: req.ip, path: req.path },
      "Rate limit exceeded for general API",
    );
    res.status(429).json({
      error: "Too many requests",
      message: "Please slow down. Try again in 15 minutes.",
    });
  },
});

/**
 * Strict rate limiter for admin endpoints
 * 30 requests per 15 minutes per IP
 */
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(
      { ip: req.ip, path: req.path },
      "Rate limit exceeded for admin API",
    );
    res.status(429).json({
      error: "Too many requests",
      message: "Admin endpoint rate limit exceeded. Try again in 15 minutes.",
    });
  },
});

/**
 * Campaign creation rate limiter
 * 20 campaigns per hour per user
 */
export const campaignCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 campaign creations per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID instead of IP
    const userId = (req as any).currentUser?.id;
    return userId || req.ip || "anonymous";
  },
  handler: (req, res) => {
    logger.warn(
      { userId: (req as any).currentUser?.id, ip: req.ip },
      "Rate limit exceeded for campaign creation",
    );
    res.status(429).json({
      error: "Too many campaigns created",
      message: "You can only create 20 campaigns per hour. Please try again later.",
    });
  },
});

/**
 * Email sending rate limiter
 * 10 requests per minute for starting campaigns
 */
export const campaignStartRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit to 10 campaign starts per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = (req as any).currentUser?.id;
    return userId || req.ip || "anonymous";
  },
  handler: (req, res) => {
    logger.warn(
      { userId: (req as any).currentUser?.id, ip: req.ip },
      "Rate limit exceeded for campaign start",
    );
    res.status(429).json({
      error: "Too many campaign starts",
      message: "You can only start 10 campaigns per minute. Please wait and try again.",
    });
  },
});

/**
 * Authentication rate limiter
 * 5 attempts per 15 minutes per IP (prevents brute force)
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
  handler: (req, res) => {
    logger.warn(
      { ip: req.ip, path: req.path },
      "Rate limit exceeded for authentication",
    );
    res.status(429).json({
      error: "Too many login attempts",
      message: "Too many failed login attempts. Please try again in 15 minutes.",
    });
  },
});

