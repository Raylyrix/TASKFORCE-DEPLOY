import { google } from "googleapis";
import type { Credentials } from "google-auth-library";
import type { oauth2_v2 } from "googleapis";

import { AppConfig } from "../config/env";
import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

const OAUTH_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets", // Full read/write access for editing sheets
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

const ensureGoogleOAuthConfigured = () => {
  const hasRedirect =
    Boolean(AppConfig.google.redirectUri) ||
    AppConfig.google.extensionRedirects.length > 0;
  if (!AppConfig.google.clientId || !AppConfig.google.clientSecret || !hasRedirect) {
    throw new Error("Google OAuth configuration is incomplete");
  }
};

export const createOAuthClient = (redirectUri?: string) => {
  ensureGoogleOAuthConfigured();
  const resolvedRedirect =
    redirectUri ??
    AppConfig.google.redirectUri ??
    AppConfig.google.extensionRedirects[0];

  if (!resolvedRedirect) {
    throw new Error("No redirect URI available for Google OAuth client");
  }

  return new google.auth.OAuth2(
    AppConfig.google.clientId,
    AppConfig.google.clientSecret,
    resolvedRedirect,
  );
};

export const generateAuthUrl = (state: string, redirectUri?: string) => {
  const client = createOAuthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "offline",
    scope: [...OAUTH_SCOPES],
    include_granted_scopes: true,
    prompt: "consent",
    state,
  });
};

// Helper function to add timeout to promises
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

export const exchangeCodeForTokens = async (code: string, redirectUri?: string) => {
  const client = createOAuthClient(redirectUri);
  // Add timeout to prevent hanging - 10 seconds should be enough for token exchange
  const { tokens } = await withTimeout(
    client.getToken(code),
    10000, // 10 second timeout
    "Exchange OAuth code for tokens"
  );
  client.setCredentials(tokens);

  return { client, tokens };
};

export const fetchGoogleProfile = async (client: ReturnType<typeof createOAuthClient>) => {
  const oauth2 = google.oauth2({
    version: "v2",
    auth: client,
  });

  // Add timeout to prevent hanging - 10 seconds should be enough for profile fetch
  const { data } = await withTimeout(
    oauth2.userinfo.get(),
    10000, // 10 second timeout
    "Fetch Google user profile"
  );
  return data;
};

const calculateExpiryDate = (tokens: Credentials) => {
  if (tokens.expiry_date) {
    return new Date(tokens.expiry_date);
  }

  return new Date(Date.now() + 55 * 60 * 1000);
};

export const upsertGoogleCalendarConnection = async ({
  userId,
  profile,
  accessToken,
  refreshToken,
  scope,
  tokenType,
  expiryDate,
}: {
  userId: string;
  profile: oauth2_v2.Schema$Userinfo;
  accessToken: string;
  refreshToken: string;
  scope: string;
  tokenType: string;
  expiryDate: Date;
}) => {
  const externalAccountId = profile.id ?? profile.email ?? userId;
  const authClient = createOAuthClient();
  authClient.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    scope,
    token_type: tokenType,
    expiry_date: expiryDate.getTime(),
  });

  let defaultCalendarId: string | null = null;
  let timeZone: string | null = null;
  let calendarSummary: string | null = null;

  try {
    const calendar = google.calendar({ version: "v3", auth: authClient });
    // Add timeout to prevent hanging - 5 seconds should be enough for calendar metadata
    const primaryCalendar = await withTimeout(
      calendar.calendarList.get({ calendarId: "primary" }),
      5000, // 5 second timeout
      "Fetch primary calendar metadata"
    );
    defaultCalendarId = primaryCalendar.data.id ?? "primary";
    timeZone = primaryCalendar.data.timeZone ?? null;
    calendarSummary = primaryCalendar.data.summary ?? null;
    logger.info({ userId, defaultCalendarId, timeZone }, "Successfully fetched primary calendar metadata");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      { 
        error: errorMessage, 
        userId, 
        scope,
        timeout: errorMessage.includes("timed out"),
      },
      "Failed to fetch primary calendar metadata - calendar scopes may not be granted or API timed out"
    );
    // Check if calendar scopes are in the requested scopes
    const hasCalendarScope = scope.includes("calendar");
    if (!hasCalendarScope) {
      logger.error({ userId, scope }, "Calendar scope not found in OAuth token - calendar connection may not work properly");
    }
    // Continue with default values - authentication should not fail due to calendar issues
    defaultCalendarId = "primary";
  }

  await prisma.calendarConnection.upsert({
    where: {
      userId_externalAccountId: {
        userId,
        externalAccountId,
      },
    },
    create: {
      userId,
      provider: "GOOGLE",
      accountEmail: profile.email ?? "unknown",
      externalAccountId,
      defaultCalendarId: defaultCalendarId ?? undefined,
      timeZone: timeZone ?? undefined,
      accessToken,
      refreshToken,
      scope,
      tokenType,
      expiryDate,
      metadata: {
        primaryCalendar: {
          id: defaultCalendarId ?? "primary",
          summary: calendarSummary,
        },
      },
    },
    update: {
      accountEmail: profile.email ?? "unknown",
      defaultCalendarId: defaultCalendarId ?? undefined,
      timeZone: timeZone ?? undefined,
      accessToken,
      refreshToken,
      scope,
      tokenType,
      expiryDate,
      metadata: {
        primaryCalendar: {
          id: defaultCalendarId ?? "primary",
          summary: calendarSummary,
        },
      },
    },
  });
};

export const upsertGoogleAccount = async (
  profile: oauth2_v2.Schema$Userinfo,
  tokens: Credentials,
) => {
  if (!profile.email) {
    throw new Error("Google user profile did not include an email address");
  }

  const user = await prisma.user.upsert({
    where: { email: profile.email },
    update: {
      displayName: profile.name ?? profile.email,
      pictureUrl: profile.picture,
      updatedAt: new Date(),
    },
    create: {
      email: profile.email,
      displayName: profile.name ?? profile.email,
      pictureUrl: profile.picture ?? undefined,
    },
  });

  const existingCredential = await prisma.oAuthCredential.findUnique({
    where: { userId: user.id },
  });

  const accessToken = tokens.access_token ?? existingCredential?.accessToken;
  const refreshToken = tokens.refresh_token ?? existingCredential?.refreshToken;

  if (!accessToken) {
    throw new Error("Failed to obtain Google access token");
  }
  if (!refreshToken) {
    throw new Error(
      "Missing Google refresh token. Ensure the consent screen includes offline access and the user granted it.",
    );
  }

  const scope = tokens.scope ?? existingCredential?.scope ?? OAUTH_SCOPES.join(" ");
  const tokenType = tokens.token_type ?? existingCredential?.tokenType ?? "Bearer";
  const expiryDate = calculateExpiryDate(tokens);

  if (existingCredential) {
    await prisma.oAuthCredential.update({
      where: { userId: user.id },
      data: {
        accessToken,
        refreshToken,
        scope,
        tokenType,
        expiryDate,
      },
    });
  } else {
    await prisma.oAuthCredential.create({
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
        scope,
        tokenType,
        expiryDate,
      },
    });
  }

  // Queue calendar connection setup as a background job - don't block authentication
  // Calendar connection will be set up in the background automatically
  // Use fire-and-forget pattern - don't await anything
  setImmediate(() => {
    import("../queue/calendarConnectionSetupQueue.js")
      .then(({ calendarConnectionSetupQueue }) => {
        // Don't await - just fire and forget
        calendarConnectionSetupQueue.add(
          "setup-calendar-connection",
          {
            userId: user.id,
            profile: {
              email: profile.email,
              id: profile.id,
              name: profile.name,
              picture: profile.picture,
            },
            accessToken,
            refreshToken,
            scope,
            tokenType,
            expiryDate: expiryDate.toISOString(),
          },
          {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: false,
          }
        ).catch((queueError) => {
          logger.warn(
            { error: queueError, userId: user.id },
            "Failed to add calendar connection setup job to queue"
          );
        });
        logger.info({ userId: user.id }, "Queued calendar connection setup job");
      })
      .catch((error) => {
        // If queue import fails, log and continue - authentication should still succeed
        logger.warn(
          { error: error instanceof Error ? error.message : String(error), userId: user.id },
          "Failed to import calendar connection setup queue - calendar connection will need to be set up manually"
        );
      });
  });

  return { user };
};

export const getAuthorizedClientForUser = async (userId: string) => {
  const credential = await prisma.oAuthCredential.findUnique({
    where: { userId },
  });

  if (!credential) {
    throw new Error("No Google credentials found for user");
  }

  const client = createOAuthClient();
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    scope: credential.scope,
    token_type: credential.tokenType,
    expiry_date: credential.expiryDate.getTime(),
  });

  const needsRefresh = credential.expiryDate.getTime() - Date.now() < 60_000;

  if (needsRefresh) {
    try {
      const { credentials } = await client.refreshAccessToken();
      const updatedExpiry = calculateExpiryDate(credentials);

      await prisma.oAuthCredential.update({
        where: { userId },
        data: {
          accessToken: credentials.access_token ?? credential.accessToken,
          refreshToken: credentials.refresh_token ?? credential.refreshToken,
          scope: credentials.scope ?? credential.scope,
          tokenType: credentials.token_type ?? credential.tokenType,
          expiryDate: updatedExpiry,
        },
      });

      client.setCredentials({
        access_token: credentials.access_token ?? credential.accessToken,
        refresh_token: credentials.refresh_token ?? credential.refreshToken,
        scope: credentials.scope ?? credential.scope,
        token_type: credentials.token_type ?? credential.tokenType,
        expiry_date: updatedExpiry.getTime(),
      });
    } catch (error) {
      logger.error({ error, userId }, "Failed to refresh Google access token");
      throw error;
    }
  }

  return client;
};

const verifyGmailAccess = async (userId: string) => {
  try {
    const client = await getAuthorizedClientForUser(userId);
    const gmail = google.gmail({ version: "v1", auth: client });
    await gmail.users.labels.list({ userId: "me" });
    return { status: "ok" as const };
  } catch (error) {
    logger.error({ error, userId }, "Gmail verification failed");
    return { status: "error" as const, message: (error as Error).message };
  }
};

const verifySheetsAccess = async (userId: string) => {
  const sheetSource = await prisma.sheetSource.findFirst({
    where: { userId },
    select: { spreadsheetId: true },
  });

  if (!sheetSource) {
    return { status: "skipped" as const, message: "No sheet sources found" };
  }

  try {
    const client = await getAuthorizedClientForUser(userId);
    const sheets = google.sheets({ version: "v4", auth: client });
    await sheets.spreadsheets.get({
      spreadsheetId: sheetSource.spreadsheetId,
      includeGridData: false,
    });
    return { status: "ok" as const };
  } catch (error) {
    logger.error({ error, userId }, "Sheets verification failed");
    return { status: "error" as const, message: (error as Error).message };
  }
};

const getDefaultExtensionRedirect = () => AppConfig.google.extensionRedirects[0] ?? null;

const verifyGoogleApis = async (userId: string) => {
  const gmail = await verifyGmailAccess(userId);
  const sheets = await verifySheetsAccess(userId);
  return { gmail, sheets };
};

export const googleAuthService = {
  OAUTH_SCOPES,
  createOAuthClient,
  generateAuthUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  upsertGoogleAccount,
  getAuthorizedClientForUser,
  getDefaultExtensionRedirect,
  verifyGoogleApis,
};

