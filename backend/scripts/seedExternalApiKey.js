/* eslint-disable no-console */
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function parseScopes(raw) {
  if (!raw) return ["*"];
  // Allow JSON array or comma-separated
  const trimmed = raw.trim();
  if (!trimmed) return ["*"];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
    } catch {
      // fall through
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const plaintextKey = process.env.SEED_EXTERNAL_API_KEY;
  const email = process.env.SEED_EXTERNAL_API_KEY_EMAIL;
  const name = process.env.SEED_EXTERNAL_API_KEY_NAME || "swap-system";
  const scopes = parseScopes(process.env.SEED_EXTERNAL_API_KEY_SCOPES);
  const rateLimitTier = process.env.SEED_EXTERNAL_API_KEY_RATE_LIMIT_TIER || "enterprise";

  if (!plaintextKey || !email) {
    console.log("[seedExternalApiKey] SEED vars not set; skipping");
    return;
  }

  // Create or reuse the owner user
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      displayName: process.env.SEED_EXTERNAL_API_KEY_DISPLAY_NAME || "Swap Integration",
    },
    select: { id: true, email: true },
  });

  // Replace existing key with the same name for this user (idempotent)
  await prisma.apiKey.deleteMany({ where: { userId: user.id, name } });

  const keyHash = await bcrypt.hash(plaintextKey, 12);
  await prisma.apiKey.create({
    data: {
      userId: user.id,
      keyHash,
      name,
      scopes,
      rateLimitTier,
      ipWhitelist: [],
      isActive: true,
    },
  });

  console.log("[seedExternalApiKey] seeded api key", { email: user.email, name, scopes, rateLimitTier });
}

main()
  .catch((err) => {
    console.error("[seedExternalApiKey] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });

