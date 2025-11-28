import { storage } from "./storage";
import type { UserProfile } from "./types";

const AUTH_KEY = "authState";

export type AuthState = {
  user: UserProfile;
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

export const getAuthState = async () => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, cannot get auth state");
    return undefined;
  }

  try {
    return await storage.getLocal<AuthState>(AUTH_KEY);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Extension context invalidated") || 
        errorMessage.includes("message port closed")) {
      console.warn("[TaskForce] Extension context invalidated, cannot get auth state");
      return undefined;
    }
    throw error;
  }
};

export const setAuthState = async (state: AuthState) => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, cannot set auth state");
    return;
  }

  try {
    await storage.setLocal(AUTH_KEY, state);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Extension context invalidated") || 
        errorMessage.includes("message port closed")) {
      console.warn("[TaskForce] Extension context invalidated, cannot set auth state");
      return;
    }
    throw error;
  }
};

export const clearAuthState = async () => {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    console.warn("[TaskForce] Extension context invalidated, cannot clear auth state");
    return;
  }

  try {
    await storage.setLocal<AuthState | null>(AUTH_KEY, null);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Extension context invalidated") || 
        errorMessage.includes("message port closed")) {
      console.warn("[TaskForce] Extension context invalidated, cannot clear auth state");
      return;
    }
    throw error;
  }
};


