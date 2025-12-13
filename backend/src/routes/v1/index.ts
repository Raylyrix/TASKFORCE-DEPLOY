import { Router } from "express";

import { campaignsV1Router } from "./campaigns";
import { contactsV1Router } from "./contacts";
import { analyticsV1Router } from "./analytics";
import { apiKeysV1Router } from "./apiKeys";

/**
 * External API v1 Router
 * All routes under /api/v1 require API key authentication
 */
export const v1Router = Router();

// API Key management (uses X-User-Id for creation, but API keys themselves use X-API-Key)
v1Router.use("/api-keys", apiKeysV1Router);

// Core API endpoints (require X-API-Key)
v1Router.use("/campaigns", campaignsV1Router);
v1Router.use("/contacts", contactsV1Router);
v1Router.use("/analytics", analyticsV1Router);

// Health check for API
v1Router.get("/health", (req, res) => {
  res.json({
    success: true,
    data: {
      version: "1.0.0",
      status: "healthy",
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
});





