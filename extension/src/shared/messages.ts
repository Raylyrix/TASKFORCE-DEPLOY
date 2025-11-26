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
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(response as TResponse);
    });
  });


