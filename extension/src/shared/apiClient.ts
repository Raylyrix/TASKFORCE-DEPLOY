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

/**
 * Check if the extension context is still valid
 */
const isExtensionContextValid = (): boolean => {
  try {
    return typeof chrome !== "undefined" && 
           typeof chrome.runtime !== "undefined" && 
           chrome.runtime.id !== undefined;
  } catch {
    return false;
  }
};

export const apiClient = {
  async request<TResponse>(path: string, options: RequestOptions = {}) {
    // Check if extension context is still valid
    if (!isExtensionContextValid()) {
      throw new Error("Extension context invalidated. Please reload the page.");
    }

    let backendUrl: string;
    try {
      backendUrl = await getBackendUrl();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Extension context invalidated") || 
          errorMessage.includes("message port closed") ||
          !isExtensionContextValid()) {
        throw new Error("Extension context invalidated. Please reload the page.");
      }
      throw error;
    }

    let headers: Headers;
    try {
      headers = await buildHeaders(options.headers);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("Extension context invalidated") || 
          errorMessage.includes("message port closed") ||
          !isExtensionContextValid()) {
        throw new Error("Extension context invalidated. Please reload the page.");
      }
      throw error;
    }

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
      
      // Try to parse JSON error response
      let errorMessage: string;
      try {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
        } else {
          const errorText = await response.text();
          errorMessage = errorText || `Request failed with status ${response.status}`;
        }
      } catch {
        errorMessage = `Request failed with status ${response.status}`;
      }
      
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  },
};


