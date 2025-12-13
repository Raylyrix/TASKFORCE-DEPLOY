import { Router } from "express";
import { z } from "zod";

import { requireUser } from "../../middleware/requireUser";
import { apiKeyService } from "../../services/apiKeyService";

export const apiKeysV1Router = Router();

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).default(["*"]),
  rateLimitTier: z.enum(["free", "starter", "professional", "enterprise"]).default("free"),
  expiresAt: z.string().datetime().optional().nullable(),
  ipWhitelist: z.array(z.string()).default([]),
});

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(z.string()).optional(),
  rateLimitTier: z.enum(["free", "starter", "professional", "enterprise"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  ipWhitelist: z.array(z.string()).optional(),
});

// List API keys (requires user auth via X-User-Id)
apiKeysV1Router.get("/", requireUser, async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const apiKeys = await apiKeyService.listApiKeys(userId);

    res.json({
      success: true,
      data: apiKeys,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get API key details
apiKeysV1Router.get("/:id", requireUser, async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const apiKeyId = req.params.id;

    const apiKey = await apiKeyService.getApiKey(apiKeyId, userId);

    res.json({
      success: true,
      data: apiKey,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create API key
apiKeysV1Router.post("/", requireUser, async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const body = createApiKeySchema.parse(req.body);

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

    const { key, apiKeyId } = await apiKeyService.generateApiKey(
      userId,
      body.name,
      body.scopes,
      body.rateLimitTier,
      expiresAt,
      body.ipWhitelist,
    );

    // Return the plaintext key (only shown once!)
    res.status(201).json({
      success: true,
      data: {
        id: apiKeyId,
        key, // ⚠️ Only returned once - user must save this!
        name: body.name,
        scopes: body.scopes,
        rateLimitTier: body.rateLimitTier,
        expiresAt: body.expiresAt,
        ipWhitelist: body.ipWhitelist,
        createdAt: new Date().toISOString(),
      },
      meta: {
        timestamp: new Date().toISOString(),
        warning: "Save this API key now. It will not be shown again.",
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update API key
apiKeysV1Router.put("/:id", requireUser, async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const apiKeyId = req.params.id;
    const body = updateApiKeySchema.parse(req.body);

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.scopes !== undefined) updateData.scopes = body.scopes;
    if (body.rateLimitTier !== undefined) updateData.rateLimitTier = body.rateLimitTier;
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.ipWhitelist !== undefined) updateData.ipWhitelist = body.ipWhitelist;

    const apiKey = await apiKeyService.updateApiKey(apiKeyId, userId, updateData);

    res.json({
      success: true,
      data: apiKey,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Revoke API key
apiKeysV1Router.delete("/:id", requireUser, async (req, res, next) => {
  try {
    const userId = req.currentUser!.id;
    const apiKeyId = req.params.id;

    await apiKeyService.revokeApiKey(apiKeyId, userId);

    res.json({
      success: true,
      data: { message: "API key revoked successfully" },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});





