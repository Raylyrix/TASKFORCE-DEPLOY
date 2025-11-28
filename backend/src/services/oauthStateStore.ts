import { randomUUID } from "node:crypto";

const STATE_TTL_MS = 5 * 60 * 1000;

type OAuthStatePayload = {
  redirectUri?: string;
};

type OAuthStateEntry = OAuthStatePayload & {
  createdAt: number;
  expiresAt: number;
};

const stateStore = new Map<string, OAuthStateEntry>();

const purgeExpiredStates = () => {
  const now = Date.now();
  for (const [key, entry] of stateStore.entries()) {
    if (entry.expiresAt <= now) {
      stateStore.delete(key);
    }
  }
};

export const oauthStateStore = {
  create(payload: OAuthStatePayload = {}) {
    purgeExpiredStates();
    const state = randomUUID();
    const createdAt = Date.now();
    const entry: OAuthStateEntry = {
      ...payload,
      createdAt,
      expiresAt: createdAt + STATE_TTL_MS,
    };
    stateStore.set(state, entry);
    return { state, expiresAt: entry.expiresAt };
  },
  consume(state: string) {
    purgeExpiredStates();
    const entry = stateStore.get(state);
    if (!entry) {
      return null;
    }
    stateStore.delete(state);
    return entry;
  },
  ttlMs: STATE_TTL_MS,
};


