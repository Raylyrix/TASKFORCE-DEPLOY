import { storage } from "./storage";

const BACKEND_URL_KEY = "backendUrl";
// Use production backend URL by default for easy distribution
export const DEFAULT_BACKEND_URL = "https://taskforce-backend-production.up.railway.app";

export const getBackendUrl = async () => {
  const stored = await storage.getSync<string>(BACKEND_URL_KEY);
  return stored ?? DEFAULT_BACKEND_URL;
};

export const setBackendUrl = async (backendUrl: string) => {
  await storage.setSync(BACKEND_URL_KEY, backendUrl);
};


