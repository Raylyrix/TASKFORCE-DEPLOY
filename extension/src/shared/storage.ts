type StorageArea = "local" | "sync";

const getArea = (area: StorageArea) =>
  area === "local" ? chrome.storage.local : chrome.storage.sync;

const wrapGet = async <T>(area: StorageArea, key: string): Promise<T | undefined> =>
  new Promise((resolve, reject) => {
    getArea(area).get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result[key] as T | undefined);
    });
  });

const wrapSet = async <T>(area: StorageArea, key: string, value: T) =>
  new Promise<void>((resolve, reject) => {
    getArea(area).set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
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


