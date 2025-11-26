import { getAuthState } from "./auth";
import { getBackendUrl } from "./config";

type RequestOptions = RequestInit & {
  headers?: HeadersInit;
  body?: BodyInit | null;
};

const buildHeaders = async (inputHeaders?: HeadersInit) => {
  const headers = new Headers(inputHeaders);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const authState = await getAuthState();
  if (authState?.user) {
    headers.set("X-User-Id", authState.user.id);
  }

  return headers;
};

export const apiClient = {
  async request<TResponse>(path: string, options: RequestOptions = {}) {
    const backendUrl = await getBackendUrl();
    const headers = await buildHeaders(options.headers);

    const response = await fetch(`${backendUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // If 401, clear auth state and throw a more helpful error
      if (response.status === 401) {
        const { clearAuthState } = await import("./auth");
        await clearAuthState();
        const { useExtensionStore } = await import("./store");
        useExtensionStore.getState().setUser(null);
        throw new Error("Authentication expired. Please re-authenticate.");
      }
      const errorText = await response.text();
      throw new Error(errorText || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  },
};


