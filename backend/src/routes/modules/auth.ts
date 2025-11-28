import { Router } from "express";
import { z } from "zod";

import { oauthStateStore } from "../../services/oauthStateStore";
import {
  exchangeCodeForTokens,
  fetchGoogleProfile,
  generateAuthUrl,
  googleAuthService,
  upsertGoogleAccount,
} from "../../services/googleAuth";

export const authRouter = Router();

const startSchema = z.object({
  redirectUri: z.string().url().optional(),
});

authRouter.post("/google/start", (req, res, next) => {
  try {
    const { redirectUri } = startSchema.parse(req.body ?? {});
    const fallbackRedirect = googleAuthService.getDefaultExtensionRedirect();
    const effectiveRedirect = redirectUri ?? fallbackRedirect ?? undefined;
    const { state, expiresAt } = oauthStateStore.create({ redirectUri: effectiveRedirect });
    const authUrl = generateAuthUrl(state, effectiveRedirect);

    res.status(200).json({
      url: authUrl,
      state,
      expiresAt,
      scopes: googleAuthService.OAUTH_SCOPES,
    });
  } catch (error) {
    next(error);
  }
});

const exchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().uuid(),
});

// GET callback route - Google redirects here after OAuth
authRouter.get("/google/callback", (req, res) => {
  const { code, state, error } = req.query;
  
  // If there's an error from Google, redirect to webapp with error
  if (error) {
    const webappUrl = process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL 
      ? `https://${process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL}`
      : "https://taskforce-webapp-production.up.railway.app";
    return res.redirect(`${webappUrl}/auth/callback?error=${encodeURIComponent(error as string)}`);
  }

  // Redirect to webapp callback page with code and state
  const webappUrl = process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL 
    ? `https://${process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL}`
    : "https://taskforce-webapp-production.up.railway.app";
  
  const params = new URLSearchParams();
  if (code) params.set("code", code as string);
  if (state) params.set("state", state as string);
  
  res.redirect(`${webappUrl}/auth/callback?${params.toString()}`);
});

authRouter.post("/google/exchange", async (req, res, next) => {
  try {
    const { code, state } = exchangeSchema.parse(req.body ?? {});
    const stateEntry = oauthStateStore.consume(state);

    if (!stateEntry) {
      res.status(400).json({ error: "Invalid or expired OAuth state" });
      return;
    }

    const { client, tokens } = await exchangeCodeForTokens(code, stateEntry.redirectUri);
    const profile = await fetchGoogleProfile(client);
    const { user } = await upsertGoogleAccount(profile, tokens);

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
      },
      state: stateEntry,
    });
  } catch (error) {
    next(error);
  }
});


