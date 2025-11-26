import { storage } from "./storage";
import type { UserProfile } from "./types";

const AUTH_KEY = "authState";

export type AuthState = {
  user: UserProfile;
};

export const getAuthState = async () => storage.getLocal<AuthState>(AUTH_KEY);

export const setAuthState = async (state: AuthState) => storage.setLocal(AUTH_KEY, state);

export const clearAuthState = async () => storage.setLocal<AuthState | null>(AUTH_KEY, null);


