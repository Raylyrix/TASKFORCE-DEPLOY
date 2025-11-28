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
  
  // Detect if this is from extension:
  // - Extension opens OAuth in a new tab directly (no referer or referer is from Google)
  // - Webapp redirects from its own domain (has referer from webapp)
  const referer = req.get("Referer") || "";
  const userAgent = req.get("User-Agent") || "";
  
  // Extension detection: 
  // 1. No referer (direct navigation) OR referer is from Google (OAuth flow)
  // 2. Not from webapp domain
  const isFromGoogle = referer.includes("accounts.google.com") || referer.includes("google.com");
  const isFromWebapp = referer.includes("taskforce-webapp") || referer.includes("railway.app");
  const isExtension = (isFromGoogle || !referer) && !isFromWebapp;
  
  // If there's an error from Google
  if (error) {
    // If from extension, serve error page that communicates with extension
    if (isExtension) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>TaskForce Auth Error</title></head>
        <body>
          <script>
            // Try to send error to extension
            if (window.chrome && chrome.runtime) {
              chrome.runtime.sendMessage(chrome.runtime.id, {
                type: "AUTH_CALLBACK_ERROR",
                error: "${encodeURIComponent(error as string)}"
              });
            }
            setTimeout(() => window.close(), 2000);
          </script>
          <p>Authentication failed. This window will close automatically.</p>
        </body>
        </html>
      `);
    }
    
    // Otherwise redirect to webapp with error
    const webappUrl = process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL 
      ? `https://${process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL}`
      : "https://taskforce-webapp-production.up.railway.app";
    return res.redirect(`${webappUrl}/auth/callback?error=${encodeURIComponent(error as string)}`);
  }

  // If from extension, keep code/state in URL for extension to extract
  // The extension monitors the tab URL and will extract code/state from it
  // We'll serve a simple page that keeps the URL intact
  if (isExtension) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TaskForce Authentication</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #1a73e8; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="spinner"></div>
        <p>Completing authentication...</p>
        <p style="font-size: 12px; color: #666; margin-top: 20px;">This window will close automatically</p>
        <script>
          // Keep the URL with code/state so extension can extract it
          // The extension monitors tab URLs and will detect this
          // Wait a bit then try to close (extension will handle it)
          setTimeout(function() {
            // Extension should have detected by now, but if not, keep page open
            console.log("Auth callback - code and state in URL for extension to extract");
          }, 2000);
        </script>
      </body>
      </html>
    `);
  }

  // Otherwise redirect to webapp callback page with code and state
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


