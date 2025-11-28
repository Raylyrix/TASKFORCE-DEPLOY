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
// Track if callback is already being processed to prevent duplicate handling
let isProcessingCallback = false;

const handleAuthStart = async (payload?: AuthStartPayload) => {
  const backendUrl = await getBackendUrl();

  // Use backend's callback URL with source parameter for better detection
  // Note: Google OAuth requires exact redirect URI match, so we can't add query params to redirectUri
  // Instead, we'll add it to the OAuth URL after generation, or rely on referer detection
  // The backend will detect it's from extension by checking referer and source parameter
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
        if (pendingAuthState?.state === state) {
          pendingAuthState.reject(new Error("Failed to open authentication tab"));
          pendingAuthState = null;
        }
        return;
      }

      const tabId = tab.id;
      let tabListener: ((updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo, updatedTab: chrome.tabs.Tab) => void) | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Use chrome.tabs.onUpdated listener for more efficient and reliable detection
      tabListener = (updatedTabId, changeInfo, updatedTab) => {
        // Only process updates for our auth tab
        if (updatedTabId !== tabId) return;
        
        // Wait for the tab to finish loading
        if (changeInfo.status !== "complete" || !updatedTab.url) return;

        const tabUrl = updatedTab.url;
        
        // Check if URL contains callback with code and state
        // Check both backend callback and webapp callback (in case of redirect)
        if (tabUrl.includes("/api/auth/google/callback") || tabUrl.includes("/auth/callback")) {
          try {
            const url = new URL(tabUrl);
            const callbackCode = url.searchParams.get("code");
            const callbackState = url.searchParams.get("state");
            const error = url.searchParams.get("error");

            // Clean up listener and timeout
            if (tabListener) {
              chrome.tabs.onUpdated.removeListener(tabListener);
              tabListener = null;
            }
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            if (error) {
              if (pendingAuthState?.state === state) {
                pendingAuthState.reject(new Error(decodeURIComponent(error)));
                pendingAuthState = null;
              }
              chrome.tabs.remove(tabId).catch(() => {
                // Ignore errors if tab is already closed
              });
              return;
            }

            // If we have code and state, and state matches, process it
            // But only if not already processing (message-based might have handled it first)
            if (callbackCode && callbackState && callbackState === state && !isProcessingCallback) {
              // Wait a moment for callback page script to send message first
              // If message-based communication works, this won't process
              // If not, this serves as fallback
              setTimeout(() => {
                if (!isProcessingCallback && pendingAuthState?.state === state) {
                  // Close the tab
                  chrome.tabs.remove(tabId).catch(() => {
                    // Ignore errors if tab is already closed
                  });
                  
                  // Handle the callback (tab monitoring fallback)
                  handleAuthCallback(callbackCode, callbackState).catch((err) => {
                    if (pendingAuthState?.state === state) {
                      pendingAuthState.reject(err);
                      pendingAuthState = null;
                      isProcessingCallback = false;
                    }
                  });
                } else if (isProcessingCallback) {
                  // Message-based handled it, just close the tab
                  chrome.tabs.remove(tabId).catch(() => {
                    // Ignore errors if tab is already closed
                  });
                }
              }, 500); // Give callback page script 500ms to send message
            } else if (isProcessingCallback) {
              // Callback already being processed via message, just close the tab
              chrome.tabs.remove(tabId).catch(() => {
                // Ignore errors if tab is already closed
              });
            }
          } catch (err) {
            console.error("Error processing auth callback:", err);
            if (pendingAuthState?.state === state) {
              pendingAuthState.reject(new Error("Failed to process authentication callback"));
              pendingAuthState = null;
            }
            // Clean up
            if (tabListener) {
              chrome.tabs.onUpdated.removeListener(tabListener);
              tabListener = null;
            }
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          }
        }
      };

      // Set up the listener
      chrome.tabs.onUpdated.addListener(tabListener);

      // Timeout after 5 minutes
      timeoutId = setTimeout(() => {
        if (tabListener) {
          chrome.tabs.onUpdated.removeListener(tabListener);
          tabListener = null;
        }
        if (pendingAuthState?.state === state) {
          pendingAuthState.reject(new Error("Authentication timeout"));
          pendingAuthState = null;
        }
        chrome.tabs.get(tabId, (tab) => {
          if (tab) {
            chrome.tabs.remove(tabId).catch(() => {
              // Ignore errors if tab is already closed
            });
          }
        });
      }, 5 * 60 * 1000);
    }
  );

  // Return the promise - it will resolve when callback is received
  return authPromise;
};

// Handle auth callback from the callback page
const handleAuthCallback = async (code: string, state: string) => {
  // Prevent duplicate processing
  if (isProcessingCallback) {
    console.log("Callback already being processed, ignoring duplicate");
    return;
  }

  if (!pendingAuthState || pendingAuthState.state !== state) {
    throw new Error("Invalid or expired OAuth state");
  }

  isProcessingCallback = true;
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
    isProcessingCallback = false;
    
    return authState;
  } catch (error) {
    pendingAuthState.reject(error as Error);
    pendingAuthState = null;
    isProcessingCallback = false;
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



