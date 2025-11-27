import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().url({ message: "DATABASE_URL must be a valid URL" }).optional(),
  REDIS_URL: z.string().url({ message: "REDIS_URL must be a valid URL" }).optional(),
  BACKEND_PUBLIC_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_EXTENSION_IDS: z
    .string()
    .transform((value) => value.split(",").map((id) => id.trim()).filter(Boolean))
    .optional(),
  SESSION_SECRET: z
    .string()
    .min(16, "SESSION_SECRET must be at least 16 characters long")
    .optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  ENCRYPTION_SALT: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.format();
  throw new Error(`Invalid environment configuration: ${JSON.stringify(formatted, null, 2)}`);
}

const env = parsed.data;
const isProduction = env.NODE_ENV === "production";

const missingSecrets: string[] = [];

const hasRedirectOption =
  Boolean(env.GOOGLE_REDIRECT_URI) || Boolean(env.GOOGLE_EXTENSION_IDS?.length);

if (!env.GOOGLE_CLIENT_ID) missingSecrets.push("GOOGLE_CLIENT_ID");
if (!env.GOOGLE_CLIENT_SECRET) missingSecrets.push("GOOGLE_CLIENT_SECRET");
if (!hasRedirectOption) missingSecrets.push("GOOGLE_REDIRECT_URI or GOOGLE_EXTENSION_IDS");
if (!env.SESSION_SECRET) missingSecrets.push("SESSION_SECRET");
// ENCRYPTION_KEY and ENCRYPTION_SALT are optional but recommended for production

if (missingSecrets.length > 0) {
  const message = `Missing environment variables: ${missingSecrets.join(", ")}`;
  if (isProduction) {
    throw new Error(message);
  } else {
    console.warn(`[env] ${message}. Using development fallbacks.`);
  }
}

export const AppConfig = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 4000),
  databaseUrl: env.DATABASE_URL ?? "",
  redisUrl: env.REDIS_URL ?? "",
  publicUrl: env.BACKEND_PUBLIC_URL ?? `http://localhost:${env.PORT ?? 4000}`,
  google: {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    redirectUri: env.GOOGLE_REDIRECT_URI ?? "",
    extensionIds: env.GOOGLE_EXTENSION_IDS ?? [],
    extensionRedirects:
      env.GOOGLE_EXTENSION_IDS?.map((id) => `https://${id}.chromiumapp.org/oauth2`) ?? [],
  },
  sessionSecret: env.SESSION_SECRET ?? "development-session-secret-change-me",
} as const;
