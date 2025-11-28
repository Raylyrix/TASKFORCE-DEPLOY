import cors from "cors";
import express from "express";

import { AppConfig } from "./config/env";
import { logger } from "./lib/logger";
// import { rateLimit } from "./middleware/rateLimit"; // Disabled for now
import { healthCheck, readinessCheck, livenessCheck } from "./middleware/healthCheck";
import { securityHeaders, xssProtection, requestSizeLimit, requestId } from "./middleware/security";
import { auditLogger } from "./middleware/auditLog";
import { router } from "./routes";

export const createApp = () => {
  const app = express();

  // Trust proxy for accurate IP addresses (important for rate limiting)
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, Postman, or Chrome extensions using fetch)
        if (!origin) {
          return callback(null, true);
        }

        const allowedOrigins = [
          "https://taskforce-webapp-production.up.railway.app",
          "https://mail.google.com", // Allow Chrome extension content scripts
          "http://localhost:3000",
          "http://localhost:3001",
          ...(AppConfig.publicUrl ? [AppConfig.publicUrl] : []),
        ];

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        // For Chrome extensions, also allow chrome-extension:// origins
        if (origin.startsWith("chrome-extension://")) {
          return callback(null, true);
        }

        // Reject other origins
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-User-Id",
        "X-Requested-With",
        "Accept",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
      ],
      exposedHeaders: ["X-Request-ID"],
      preflightContinue: false,
      optionsSuccessStatus: 204,
    }),
  );
  app.use(express.json({ limit: "10mb" })); // Increased for email attachments
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Security middleware (order matters!)
  app.use(requestId); // Add request ID for tracking
  app.use(securityHeaders); // Security headers
  app.use(xssProtection); // XSS protection
  app.use(requestSizeLimit); // Request size limiting

  // Redis-based rate limiting - DISABLED FOR NOW
  // app.use(rateLimit);

  // Audit logging for all requests
  app.use(auditLogger);

  app.use("/api", router);

  // Health check endpoints
  app.get("/health", healthCheck);
  app.get("/ready", readinessCheck);
  app.get("/live", livenessCheck);

  app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Better error logging with proper serialization
    let errorMessage = "Unknown error";
    let errorStack: string | undefined;
    let errorName = "Error";

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;
      errorName = error.name;
    } else if (typeof error === "string") {
      errorMessage = error;
    } else if (error && typeof error === "object") {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = String(error);
      }
    } else {
      errorMessage = String(error);
    }

    logger.error(
      {
        error: errorMessage,
        errorName,
        stack: errorStack,
        path: req.path,
        method: req.method,
        userId: req.currentUser?.id,
        ip: req.ip,
      },
      "Unhandled error",
    );

    const message =
      error instanceof Error && AppConfig.nodeEnv !== "production"
        ? error.message
        : "Internal server error";
    res.status(500).json({ error: message });
  });

  return app;
};
