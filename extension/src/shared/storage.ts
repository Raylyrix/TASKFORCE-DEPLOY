type StorageArea = "local" | "sync";

const getArea = (area: StorageArea) =>
  area === "local" ? chrome.storage.local : chrome.storage.sync;

const wrapGet = async <T>(area: StorageArea, key: string): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
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

    getArea(area).get([key], (result) => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        // Check if error is due to context invalidation
        if (error.message?.includes("Extension context invalidated") ||
            error.message?.includes("message port closed")) {
          reject(new Error("Extension context invalidated"));
        } else {
          reject(error);
        }
        return;
      }
      resolve(result[key] as T | undefined);
    });
  });

const wrapSet = async <T>(area: StorageArea, key: string, value: T) =>
  new Promise<void>((resolve, reject) => {
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

    getArea(area).set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError;
        // Check if error is due to context invalidation
        if (error.message?.includes("Extension context invalidated") ||
            error.message?.includes("message port closed")) {
          reject(new Error("Extension context invalidated"));
        } else {
          reject(error);
        }
        return;
      }
      resolve();
    });
  });

export const storage = {
  async getLocal<T>(key: string) {
    return wrapGet<T>("local", key);
  },
  async setLocal<T>(key: string, value: T) {
    return wrapSet("local", key, value);
  },
  async getSync<T>(key: string) {
    return wrapGet<T>("sync", key);
  },
  async setSync<T>(key: string, value: T) {
    return wrapSet("sync", key, value);
  },
};


