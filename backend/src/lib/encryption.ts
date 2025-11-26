import crypto from "crypto";

import { AppConfig } from "../config/env";

/**
 * Encryption service for sensitive data
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64; // 512 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  
  // If key is provided as hex, decode it
  if (key.length === 64) {
    return Buffer.from(key, "hex");
  }
  
  // Otherwise, derive key from password using PBKDF2
  const salt = process.env.ENCRYPTION_SALT || "default-salt-change-in-production";
  return crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, "sha512");
};

let encryptionKey: Buffer | null = null;

const getKey = (): Buffer => {
  if (!encryptionKey) {
    encryptionKey = getEncryptionKey();
  }
  return encryptionKey;
};

/**
 * Encrypt sensitive data
 * Returns: base64(IV + Salt + Tag + EncryptedData)
 */
export const encrypt = (text: string): string => {
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive key from master key and salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, "sha512");
    
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(text, "utf8", "base64");
    encrypted += cipher.final("base64");
    
    const tag = cipher.getAuthTag();
    
    // Combine: IV + Salt + Tag + Encrypted
    const combined = Buffer.concat([
      iv,
      salt,
      tag,
      Buffer.from(encrypted, "base64"),
    ]);
    
    return combined.toString("base64");
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Decrypt sensitive data
 */
export const decrypt = (encryptedData: string): string => {
  try {
    const key = getKey();
    const combined = Buffer.from(encryptedData, "base64");
    
    // Extract components
    const iv = combined.subarray(0, IV_LENGTH);
    const salt = combined.subarray(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
    const tag = combined.subarray(IV_LENGTH + SALT_LENGTH, IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);
    
    // Derive key from master key and salt
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, "sha512");
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Hash sensitive data (one-way, for comparison)
 */
export const hash = (text: string): string => {
  return crypto.createHash("sha256").update(text).digest("hex");
};

/**
 * Generate secure random token
 */
export const generateSecureToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};


