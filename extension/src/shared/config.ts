import { storage } from "./storage";

const BACKEND_URL_KEY = "backendUrl";
export const DEFAULT_BACKEND_URL = "http://localhost:3000";

export const getBackendUrl = async () => {
  const stored = await storage.getSync<string>(BACKEND_URL_KEY);
  return stored ?? DEFAULT_BACKEND_URL;
};

export const setBackendUrl = async (backendUrl: string) => {
  await storage.setSync(BACKEND_URL_KEY, backendUrl);
};


