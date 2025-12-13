import crypto from "crypto";
import bcrypt from "bcryptjs";

import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";

/**
 * API Key Service
 * Handles generation, validation, and management of API keys
 */

const API_KEY_PREFIX = "tf_live_";
const API_KEY_LENGTH = 32; // bytes

/**
 * Generate a new API key
 * Returns the plaintext key (only shown once) and the hashed version for storage
 */
export async function generateApiKey(
  userId: string,
  name: string,
  scopes: string[] = ["*"],
  rateLimitTier: string = "free",
  expiresAt?: Date,
  ipWhitelist: string[] = [],
): Promise<{ key: string; apiKeyId: string }> {
  // Generate random key
  const randomBytes = crypto.randomBytes(API_KEY_LENGTH);
  const keySuffix = randomBytes.toString("hex");
  const plaintextKey = `${API_KEY_PREFIX}${keySuffix}`;

  // Hash the key for storage
  const keyHash = await bcrypt.hash(plaintextKey, 12);

  // Store in database
  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      keyHash,
      name,
      scopes,
      rateLimitTier,
      expiresAt,
      ipWhitelist,
      isActive: true,
    },
  });

  logger.info({ userId, apiKeyId: apiKey.id, name }, "API key generated");

  return {
    key: plaintextKey, // Only returned once!
    apiKeyId: apiKey.id,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(apiKeyId: string, userId: string): Promise<void> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId, // Ensure user owns this key
    },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { isActive: false },
  });

  logger.info({ userId, apiKeyId }, "API key revoked");
}

/**
 * List API keys for a user
 */
export async function listApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      scopes: true,
      rateLimitTier: true,
      ipWhitelist: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get API key details (without the actual key)
 */
export async function getApiKey(apiKeyId: string, userId: string) {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      rateLimitTier: true,
      ipWhitelist: true,
      lastUsedAt: true,
      expiresAt: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  return apiKey;
}

/**
 * Update API key metadata
 */
export async function updateApiKey(
  apiKeyId: string,
  userId: string,
  data: {
    name?: string;
    scopes?: string[];
    rateLimitTier?: string;
    ipWhitelist?: string[];
    expiresAt?: Date | null;
  },
) {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  });

  if (!apiKey) {
    throw new Error("API key not found");
  }

  return prisma.apiKey.update({
    where: { id: apiKeyId },
    data,
  });
}

// Export as service object
export const apiKeyService = {
  generateApiKey,
  revokeApiKey,
  listApiKeys,
  getApiKey,
  updateApiKey,
};

