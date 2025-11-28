import { storage } from "./storage";

const BACKEND_URL_KEY = "backendUrl";
// Use production backend URL by default for easy distribution
export const DEFAULT_BACKEND_URL = "https://taskforce-backend-production.up.railway.app";

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

export const getBackendUrl = async () => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, using default backend URL");
    return DEFAULT_BACKEND_URL;
  }

  try {
    const stored = await storage.getSync<string>(BACKEND_URL_KEY);
    return stored ?? DEFAULT_BACKEND_URL;
  } catch (error) {
    // Check if error is due to context invalidation
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Extension context invalidated") || 
        errorMessage.includes("message port closed") ||
        !isExtensionContextValid()) {
      console.warn("[TaskForce] Extension context invalidated, using default backend URL");
      return DEFAULT_BACKEND_URL;
    }
    console.warn("[TaskForce] Failed to get backend URL from storage, using default:", error);
    return DEFAULT_BACKEND_URL;
  }
};

export const setBackendUrl = async (backendUrl: string) => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, cannot set backend URL");
    return;
  }

  try {
    await storage.setSync(BACKEND_URL_KEY, backendUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Extension context invalidated") || 
        errorMessage.includes("message port closed")) {
      console.warn("[TaskForce] Extension context invalidated, cannot set backend URL");
      return;
    }
    throw error;
  }
};


