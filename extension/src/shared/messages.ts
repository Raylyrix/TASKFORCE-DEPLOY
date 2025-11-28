export enum MessageType {
  AuthStart = "AUTH_START",
  AuthStatus = "AUTH_STATUS",
  AuthSignOut = "AUTH_SIGN_OUT",
  ConfigGet = "CONFIG_GET",
  ConfigSet = "CONFIG_SET",
}

export type RuntimeMessage<TPayload = unknown> = {
  type: MessageType;
  payload?: TPayload;
};

export type AuthStatusResponse = {
  user?: {
    id: string;
    email: string;
    displayName?: string | null;
    pictureUrl?: string | null;
  };
};

export type AuthStartResponse = AuthStatusResponse & {
  state?: {
    redirectUri?: string;
  };
};

export type ConfigGetResponse = {
  backendUrl: string;
};

export const sendRuntimeMessage = <TResponse = void, TPayload = unknown>(
  message: RuntimeMessage<TPayload>,
) =>
  new Promise<TResponse>((resolve, reject) => {
    // Check if extension context is still valid
    try {
      if (typeof chrome === "undefined" || 
          typeof chrome.runtime === "undefined" || 
          chrome.runtime.id === undefined) {
        reject(new Error("Extension context invalidated"));
        return;
      }
    } catch {
      reject(new Error("Extension context invalidated"));
      return;
    }

    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        // Check if error is due to context invalidation
        if (error.message?.includes("Extension context invalidated") ||
            error.message?.includes("message port closed") ||
            error.message?.includes("Could not establish connection")) {
          reject(new Error("Extension context invalidated"));
        } else {
          reject(error);
        }
        return;
      }
      resolve(response as TResponse);
    });
  });


