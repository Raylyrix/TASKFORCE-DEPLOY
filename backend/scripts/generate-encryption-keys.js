#!/usr/bin/env node

/**
 * Generate encryption keys for TaskForce
 * Run this script to generate secure encryption keys for your .env file
 */

const crypto = require("crypto");

console.log("\n🔐 TaskForce Encryption Key Generator\n");
console.log("=" .repeat(50));
console.log("\nAdd these to your .env file:\n");

// Generate 32-byte (256-bit) encryption key
const encryptionKey = crypto.randomBytes(32).toString("hex");
console.log(`ENCRYPTION_KEY=${encryptionKey}`);

// Generate 16-byte salt
const encryptionSalt = crypto.randomBytes(16).toString("hex");
console.log(`ENCRYPTION_SALT=${encryptionSalt}`);

console.log("\n" + "=".repeat(50));
console.log("\n✅ Keys generated successfully!");
console.log("\n⚠️  IMPORTANT:");
console.log("   - Keep these keys SECRET and NEVER commit them to git");
console.log("   - Store them securely (use a password manager)");
console.log("   - If keys are lost, encrypted data cannot be recovered");
console.log("   - Use different keys for development and production\n");


