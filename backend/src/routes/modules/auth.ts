import { Router } from "express";
import { z } from "zod";

import { logger } from "../../lib/logger";
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
    
    // Detect source from request origin/referer/headers
    // When webapp calls through Next.js rewrites, we need to check multiple headers
    const origin = req.get("Origin") || "";
    const referer = req.get("Referer") || "";
    const forwardedHost = req.get("X-Forwarded-Host") || "";
    const host = req.get("Host") || "";
    const requestSource = req.get("X-Request-Source"); // Explicit source header from extension
    
    // Detection logic - be precise to avoid misclassification:
    // Priority order:
    // 1. Explicit X-Request-Source header (extension sets this) - HIGHEST PRIORITY
    // 2. Explicit webapp indicators (Origin/Referer/Forwarded-Host from webapp domain)
    // 3. Explicit extension indicators (chrome-extension:// origin)
    // 4. Missing Origin header = likely extension background script
    // 5. Fallback based on Origin header presence
    
    let source: "extension" | "webapp";
    
    // Check for explicit source header (extension sets this) - HIGHEST PRIORITY
    if (requestSource === "extension") {
      logger.info({ requestSource }, "OAuth start - detected extension from X-Request-Source header");
      source = "extension";
    } else {
      // Check multiple indicators for webapp
      const hasWebappOrigin = 
        origin.includes("taskforce-webapp") || 
        origin.includes("railway.app");
      const hasWebappReferer = 
        referer.includes("taskforce-webapp") ||
        referer.includes("railway.app");
      const hasWebappForwardedHost = 
        forwardedHost.includes("taskforce-webapp") ||
        forwardedHost.includes("railway.app");
      
      // Check for explicit extension indicators
      const hasExtensionOrigin = origin.includes("chrome-extension://");
      const hasOriginHeader = origin.length > 0; // Extension background scripts often have no Origin
      
      // Key insight: Extension background script requests have NO Origin header
      // Webapp browser requests DO have an Origin header from the webapp domain
      // So: No Origin header = likely extension, Has Origin from webapp = webapp
      
      // Determine if it's webapp (only if we have POSITIVE indicators)
      const isFromWebapp = 
        hasWebappOrigin ||        // Origin header from webapp domain
        hasWebappReferer ||       // Referer from webapp domain
        hasWebappForwardedHost;   // Forwarded-Host from webapp domain
      
      // Determine if it's extension
      const isFromExtension = 
        hasExtensionOrigin ||     // Explicit chrome-extension:// origin
        (!hasOriginHeader && redirectUri); // No Origin header + redirectUri = background script
      
      // Final determination: explicit indicators take priority
      // Default to extension if we have no clear indicators (safer for extension)
      if (isFromWebapp) {
        source = "webapp";
      } else if (isFromExtension || !hasOriginHeader) {
        source = "extension";
      } else {
        // Fallback: if we have Origin header but can't determine, assume webapp
        // (browser requests have Origin, background scripts don't)
        source = hasOriginHeader ? "webapp" : "extension";
      }
    }
    
    logger.info({ 
      origin, 
      referer, 
      forwardedHost, 
      host,
      redirectUri,
      requestSource,
      source,
      hasWebappOrigin: origin.includes("taskforce-webapp") || origin.includes("railway.app"),
      hasWebappReferer: referer.includes("taskforce-webapp") || referer.includes("railway.app"),
      hasWebappForwardedHost: forwardedHost.includes("taskforce-webapp") || forwardedHost.includes("railway.app"),
      hasOriginHeader: (origin || "").length > 0
    }, "OAuth start - source detection");
    
    const { state, expiresAt } = oauthStateStore.create({ 
      redirectUri: effectiveRedirect,
      source,
    });
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
authRouter.get("/google/callback", async (req, res) => {
  const { code, state, error, source } = req.query;
  
  // Detect if this is from extension using multiple methods:
  // 1. Explicit source=extension query parameter (most reliable)
  // 2. Check redirectUri stored in OAuth state (most accurate - stored when OAuth started)
  // 3. Referer header analysis (fallback - less reliable since Google redirects)
  const referer = req.get("Referer") || "";
  const userAgent = req.get("User-Agent") || "";
  
  // Check for explicit source parameter first
  const hasExplicitSource = source === "extension";
  
  // Check state to determine source (ABSOLUTE TRUTH - stored when OAuth started)
  // This is the SINGLE source of truth - state source field is authoritative
  let detectedSource: "extension" | "webapp" | null = null;
  let stateEntry = null;
  if (state && typeof state === "string") {
    stateEntry = oauthStateStore.peek(state);
    if (stateEntry?.source) {
      detectedSource = stateEntry.source;
      logger.info({ state, source: detectedSource }, "OAuth callback - source from state (ABSOLUTE TRUTH)");
    }
  }
  
  // DETERMINATION: Trust state source absolutely, only use fallback if state is missing/invalid
  let isExtension = false;
  
  if (detectedSource === "webapp") {
    // State explicitly says webapp - ALWAYS treat as webapp, no exceptions
    isExtension = false;
    logger.info({ state, detectedSource }, "OAuth callback - state says webapp, treating as webapp (ABSOLUTE)");
  } else if (detectedSource === "extension") {
    // State explicitly says extension - ALWAYS treat as extension, no exceptions
    isExtension = true;
    logger.info({ state, detectedSource }, "OAuth callback - state says extension, treating as extension (ABSOLUTE)");
  } else {
    // State is missing or invalid - only use fallback in this case
    // This should be rare - state should always have source from OAuth start
    logger.warn({ 
      state, 
      stateEntry: stateEntry ? "exists but no source" : "missing",
      hasExplicitSource: source === "extension"
    }, "OAuth callback - state missing source, using minimal fallback");
    
    // Minimal fallback: only check explicit source parameter
    // Do NOT use unreliable referer/origin headers
    isExtension = source === "extension";
    
    // If still can't determine and state exists, log error
    if (!stateEntry && !isExtension) {
      logger.error({ state, source }, "OAuth callback - cannot determine source, defaulting to webapp");
    }
  }
  
  logger.info({ 
    state, 
    detectedSource,
    isExtension,
    source: source || "none",
    stateHasSource: detectedSource !== null,
    referer: referer || "none",
    origin: req.get("Origin") || "none"
  }, "OAuth callback - final detection (state source is absolute truth)");
  
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

  // If from extension, serve callback page with script that communicates with extension
  // The page includes the auth-callback script that sends code/state to background script
  if (isExtension) {
    const codeParam = code ? encodeURIComponent(code as string) : "";
    const stateParam = state ? encodeURIComponent(state as string) : "";
    
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TaskForce Authentication</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            text-align: center; 
            padding: 40px; 
            background: #f5f5f5;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
          }
          .container {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 400px;
          }
          .spinner { 
            border: 3px solid #f3f3f3; 
            border-top: 3px solid #1a73e8; 
            border-radius: 50%; 
            width: 40px; 
            height: 40px; 
            animation: spin 1s linear infinite; 
            margin: 0 auto 20px; 
          }
          @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
          }
          .error {
            color: #d93025;
            margin-top: 20px;
          }
          .success {
            color: #188038;
            margin-top: 20px;
          }
          #loading { display: block; }
          #error { display: none; }
          #success { display: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="loading">
            <div class="spinner"></div>
            <p>Completing authentication...</p>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">This window will close automatically</p>
          </div>
          <div id="error" class="error">
            <p id="error-message"></p>
          </div>
          <div id="success" class="success">
            <p>Authentication successful! This window will close automatically.</p>
          </div>
        </div>
        <script>
          // Extract code and state from URL
          const urlParams = new URLSearchParams(window.location.search);
          const code = urlParams.get("code");
          const state = urlParams.get("state");
          const error = urlParams.get("error");
          
          const loadingEl = document.getElementById("loading");
          const errorEl = document.getElementById("error");
          const successEl = document.getElementById("success");
          const errorMessageEl = document.getElementById("error-message");
          
          if (error) {
            // Show error
            if (loadingEl) loadingEl.style.display = "none";
            if (errorEl) errorEl.style.display = "block";
            if (errorMessageEl) {
              errorMessageEl.textContent = "Authentication failed: " + decodeURIComponent(error);
            }
            
            // Try to send error to extension
            try {
              if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage(
                  chrome.runtime.id,
                  {
                    type: "AUTH_CALLBACK_ERROR",
                    error: decodeURIComponent(error),
                  },
                  () => {
                    // Close window after a delay
                    setTimeout(() => {
                      window.close();
                    }, 3000);
                  }
                );
              }
            } catch (e) {
              console.error("Failed to send error to extension:", e);
              setTimeout(() => window.close(), 3000);
            }
          } else if (code && state) {
            // Send code and state to background script
            try {
              if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
                chrome.runtime.sendMessage(
                  chrome.runtime.id,
                  {
                    type: "AUTH_CALLBACK",
                    code: code,
                    state: state,
                  },
                  (response) => {
                    if (chrome.runtime.lastError) {
                      console.error("Error sending message:", chrome.runtime.lastError);
                      if (loadingEl) loadingEl.style.display = "none";
                      if (errorEl) errorEl.style.display = "block";
                      if (errorMessageEl) {
                        errorMessageEl.textContent = "Failed to communicate with extension. Please try again.";
                      }
                      return;
                    }
                    
                    if (response && response.error) {
                      // Show error from background
                      if (loadingEl) loadingEl.style.display = "none";
                      if (errorEl) errorEl.style.display = "block";
                      if (errorMessageEl) {
                        errorMessageEl.textContent = response.error;
                      }
                    } else {
                      // Show success
                      if (loadingEl) loadingEl.style.display = "none";
                      if (successEl) successEl.style.display = "block";
                      
                      // Close window after a short delay
                      setTimeout(() => {
                        window.close();
                      }, 2000);
                    }
                  }
                );
              } else {
                // Fallback: if chrome.runtime is not available, keep page open for tab monitoring
                console.log("Auth callback - code and state in URL for extension to extract");
                console.log("Code:", code);
                console.log("State:", state);
              }
            } catch (e) {
              console.error("Failed to send message to extension:", e);
              if (loadingEl) loadingEl.style.display = "none";
              if (errorEl) errorEl.style.display = "block";
              if (errorMessageEl) {
                errorMessageEl.textContent = "Failed to communicate with extension. Please try again.";
              }
            }
          } else {
            // Missing parameters
            if (loadingEl) loadingEl.style.display = "none";
            if (errorEl) errorEl.style.display = "block";
            if (errorMessageEl) {
              errorMessageEl.textContent = "Missing authentication parameters. Please try again.";
            }
          }
        </script>
      </body>
      </html>
    `);
  }

  // For webapp: Handle exchange directly in GET callback to avoid extra round-trip
  // This prevents hanging and simplifies the flow
  const webappUrl = process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL 
    ? `https://${process.env.RAILWAY_SERVICE_TASKFORCE_WEBAPP_URL}`
    : "https://taskforce-webapp-production.up.railway.app";

  if (!code || !state) {
    return res.redirect(`${webappUrl}/auth/callback?error=${encodeURIComponent("Missing authentication parameters")}`);
  }

  // Exchange code for tokens directly in GET callback (for webapp only)
  try {
    const stateEntry = oauthStateStore.consume(state as string);
    if (!stateEntry) {
      logger.warn({ state }, "Invalid or expired OAuth state in webapp callback");
      return res.redirect(`${webappUrl}/auth/callback?error=${encodeURIComponent("Invalid or expired authentication session")}`);
    }

    logger.info({ state }, "Processing webapp OAuth exchange in GET callback");

    // Exchange code for tokens with timeout
    const { client, tokens } = await exchangeCodeForTokens(code as string, stateEntry.redirectUri);
    const profile = await fetchGoogleProfile(client);
    const { user } = await upsertGoogleAccount(profile, tokens);

    logger.info({ userId: user.id, email: user.email }, "Webapp OAuth exchange completed, redirecting to webapp");

    // Redirect to webapp with user info (encoded in URL - will be read by callback page)
    // Note: In production, you might want to use a temporary token/session instead
    const params = new URLSearchParams();
    params.set("success", "true");
    params.set("userId", user.id);
    params.set("email", user.email);
    params.set("displayName", user.displayName || user.email);
    if (user.pictureUrl) {
      params.set("pictureUrl", user.pictureUrl);
    }

    res.redirect(`${webappUrl}/auth/callback?${params.toString()}`);
  } catch (error) {
    logger.error({ error, state }, "Webapp OAuth exchange failed in GET callback");
    const errorMessage = error instanceof Error ? error.message : "Authentication failed";
    res.redirect(`${webappUrl}/auth/callback?error=${encodeURIComponent(errorMessage)}`);
  }
});

authRouter.post("/google/exchange", async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    logger.info({ timestamp: new Date().toISOString() }, "Starting OAuth exchange");
    
    const { code, state } = exchangeSchema.parse(req.body ?? {});
    const stateEntry = oauthStateStore.consume(state);

    if (!stateEntry) {
      logger.warn({ state }, "Invalid or expired OAuth state");
      res.status(400).json({ error: "Invalid or expired OAuth state" });
      return;
    }

    logger.info({ elapsed: Date.now() - startTime }, "Exchanging code for tokens");
    const { client, tokens } = await exchangeCodeForTokens(code, stateEntry.redirectUri);
    logger.info({ elapsed: Date.now() - startTime }, "Tokens exchanged, fetching profile");

    const profile = await fetchGoogleProfile(client);
    logger.info({ elapsed: Date.now() - startTime, email: profile.email }, "Profile fetched, upserting account");

    const { user } = await upsertGoogleAccount(profile, tokens);
    logger.info({ elapsed: Date.now() - startTime, userId: user.id }, "Account upserted, authentication complete");

    res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
      },
      state: stateEntry,
    });
    
    logger.info({ elapsed: Date.now() - startTime, userId: user.id }, "OAuth exchange completed successfully");
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error({ error, elapsed }, "OAuth exchange failed");
    next(error);
  }
});


