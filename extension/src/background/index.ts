import { MessageType, type RuntimeMessage } from "../shared/messages";
import {
  clearAuthState,
  getAuthState,
  setAuthState,
  type AuthState,
} from "../shared/auth";
import { DEFAULT_BACKEND_URL, getBackendUrl, setBackendUrl } from "../shared/config";
import type { UserProfile } from "../shared/types";

type AuthStartPayload = {
  interactive?: boolean;
};

const ensureBackendConfigured = async () => {
  const backendUrl = await getBackendUrl();
  if (!backendUrl) {
    await setBackendUrl(DEFAULT_BACKEND_URL);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void ensureBackendConfigured();
});

// Store pending auth state to match callback with request
let pendingAuthState: { state: string; resolve: (value: AuthState) => void; reject: (error: Error) => void } | null = null;

const handleAuthStart = async (payload?: AuthStartPayload) => {
  const backendUrl = await getBackendUrl();

  // Use backend's callback URL without query parameters
  // Google requires exact match, so we can't include ?source=extension
  // The backend will detect it's from extension by checking the tab URL
  const redirectUri = `${backendUrl}/api/auth/google/callback`;

  const startResponse = await fetch(`${backendUrl}/api/auth/google/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ redirectUri }),
  });

  if (!startResponse.ok) {
    throw new Error(`Failed to initialize OAuth: ${await startResponse.text()}`);
  }

  const { url, state } = (await startResponse.json()) as { url: string; state: string };
  
  // Store state for callback matching
  const authPromise = new Promise<AuthState>((resolve, reject) => {
    pendingAuthState = { state, resolve, reject };
    // Timeout after 5 minutes
    setTimeout(() => {
      if (pendingAuthState?.state === state) {
        pendingAuthState = null;
        reject(new Error("Authentication timeout"));
      }
    }, 5 * 60 * 1000);
  });

  // Open OAuth URL in a new tab (service workers can't use window.open)
  chrome.tabs.create(
    {
      url: url,
      active: true,
    },
    (tab) => {
      if (chrome.runtime.lastError || !tab || !tab.id) {
        pendingAuthState = null;
        return;
      }

      // Monitor tab for URL changes to detect callback
      const tabId = tab.id;
      const checkTab = setInterval(() => {
        chrome.tabs.get(tabId, (currentTab) => {
          if (chrome.runtime.lastError || !currentTab) {
            clearInterval(checkTab);
            if (pendingAuthState?.state === state) {
              pendingAuthState.reject(new Error("Authentication tab closed"));
              pendingAuthState = null;
            }
            return;
          }

          // Check if URL contains callback with code and state
          // Check both backend callback and webapp callback (in case of redirect)
          const tabUrl = currentTab.url || "";
          if (tabUrl.includes("/api/auth/google/callback") || tabUrl.includes("/auth/callback")) {
            const url = new URL(tabUrl);
            const callbackCode = url.searchParams.get("code");
            const callbackState = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            if (error) {
              clearInterval(checkTab);
              if (pendingAuthState?.state === state) {
                pendingAuthState.reject(new Error(decodeURIComponent(error)));
                pendingAuthState = null;
              }
              chrome.tabs.remove(tabId);
              return;
            }

            // If we have code and state, and state matches, process it
            // Even if redirected to webapp, we can still extract the code
            if (callbackCode && callbackState && callbackState === state) {
              clearInterval(checkTab);
              // Close the tab
              chrome.tabs.remove(tabId);
              // Handle the callback
              handleAuthCallback(callbackCode, callbackState).catch((err) => {
                if (pendingAuthState?.state === state) {
                  pendingAuthState.reject(err);
                  pendingAuthState = null;
                }
              });
            }
          }
        });
      }, 500);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(checkTab);
        chrome.tabs.get(tabId, (tab) => {
          if (tab) chrome.tabs.remove(tabId);
        });
      }, 5 * 60 * 1000);
    }
  );

  // Return the promise - it will resolve when callback is received
  return authPromise;
};

// Handle auth callback from the callback page
const handleAuthCallback = async (code: string, state: string) => {
  if (!pendingAuthState || pendingAuthState.state !== state) {
    throw new Error("Invalid or expired OAuth state");
  }

  const backendUrl = await getBackendUrl();

  try {
    const exchangeResponse = await fetch(`${backendUrl}/api/auth/google/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, state }),
    });

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();
      throw new Error(`OAuth exchange failed: ${errorText}`);
    }

    const { user } = (await exchangeResponse.json()) as { user: UserProfile };
    const authState: AuthState = { user };
    await setAuthState(authState);
    
    // Resolve the pending auth
    pendingAuthState.resolve(authState);
    pendingAuthState = null;
    
    return authState;
  } catch (error) {
    pendingAuthState.reject(error as Error);
    pendingAuthState = null;
    throw error;
  }
};

const handleAuthStatus = async () => {
  const authState = await getAuthState();
  return authState ?? null;
};

const handleAuthSignOut = async () => {
  await clearAuthState();
};

const handleConfigSet = async (backendUrl: string) => {
  await setBackendUrl(backendUrl);
  return { backendUrl };
};

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    const processMessage = async () => {
      switch (message.type) {
        case MessageType.AuthStart:
          return handleAuthStart(message.payload as AuthStartPayload);
        case MessageType.AuthStatus:
          return handleAuthStatus();
        case MessageType.AuthSignOut:
          return handleAuthSignOut();
        case MessageType.ConfigGet:
          return { backendUrl: await getBackendUrl() };
        case MessageType.ConfigSet:
          return handleConfigSet((message.payload as { backendUrl: string }).backendUrl);
        default:
          throw new Error(`Unhandled message type: ${message.type}`);
      }
    };

    processMessage()
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Background message error", error);
        sendResponse({ error: (error as Error).message });
      });

    return true;
  },
);

// Handle messages from auth callback page
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "AUTH_CALLBACK") {
    handleAuthCallback(message.code, message.state)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error("Auth callback error:", error);
        sendResponse({ error: (error as Error).message });
      });
    return true;
  } else if (message.type === "AUTH_CALLBACK_ERROR") {
    if (pendingAuthState) {
      pendingAuthState.reject(new Error(message.error || "Authentication failed"));
      pendingAuthState = null;
    }
    sendResponse({ success: true });
    return true;
  }
});



