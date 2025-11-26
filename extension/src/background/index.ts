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

const launchWebAuthFlow = (url: string, interactive = true) =>
  new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive }, (redirectUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!redirectUrl) {
        reject(new Error("No redirect URL returned from auth flow"));
        return;
      }
      resolve(redirectUrl);
    });
  });

const parseAuthRedirect = (redirectUrl: string) => {
  const url = new URL(redirectUrl);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    throw new Error("Missing authorization code or state");
  }

  return { code, state };
};

const handleAuthStart = async (payload?: AuthStartPayload) => {
  const backendUrl = await getBackendUrl();

  const redirectUri = chrome.identity.getRedirectURL("oauth2");

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
  const redirectUrl = await launchWebAuthFlow(url, payload?.interactive ?? true);
  const { code, state: returnedState } = parseAuthRedirect(redirectUrl);

  if (state !== returnedState) {
    throw new Error("OAuth state mismatch");
  }

  const exchangeResponse = await fetch(`${backendUrl}/api/auth/google/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, state }),
  });

  if (!exchangeResponse.ok) {
    throw new Error(`OAuth exchange failed: ${await exchangeResponse.text()}`);
  }

  const { user } = (await exchangeResponse.json()) as { user: UserProfile };
  const authState: AuthState = { user };
  await setAuthState(authState);
  return authState;
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


