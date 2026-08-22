import { createRequire } from "node:module";

import { describe, expect, test, vi } from "vitest";

type Session = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number;
  user: { id: string; email: string };
};

type StorageArea = {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  setAccessLevel(input: { accessLevel: string }): Promise<void>;
};

const require = createRequire(import.meta.url);
type PopcornAuth = {
  createAuthClient(input: Record<string, unknown>): {
    signInWithPassword(credentials: { email: string; password: string }): Promise<Session>;
    signOut(input?: { decision?: "discard" }): Promise<{
      pendingCount: number;
      requiresDecision: boolean;
    }>;
    getSession(): Promise<Session | null>;
    getAccessToken(): Promise<string>;
  };
};
type PopcornSyncQueue = {
  createSyncQueue(input: Record<string, unknown>): {
    flushPendingEvents(trigger: string): Promise<{ pending: number }>;
  };
};

require("../../../extension/auth.js");
require("../../../extension/sync-queue.js");
const extensionGlobal = globalThis as typeof globalThis & {
  POPCORN_AUTH: PopcornAuth;
  POPCORN_SYNC_QUEUE: PopcornSyncQueue;
};
const auth = extensionGlobal.POPCORN_AUTH;
const syncQueue = extensionGlobal.POPCORN_SYNC_QUEUE;

function storage(values: Record<string, unknown>, writes: unknown[]): StorageArea {
  return {
    async get(keys) {
      if (keys === null) return { ...values };
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(requested
        .filter((key) => Object.hasOwn(values, key))
        .map((key) => [key, values[key]]));
    },
    async set(items) {
      writes.push(structuredClone(items));
      Object.assign(values, items);
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    },
    async setAccessLevel() {},
  };
}

describe("extension password-auth integration", () => {
  test("a new password session cannot upload or discard another owner's pending saves", async () => {
    const local: Record<string, unknown> = {
      popcorn_pending_events: [
        {
          ownerUserId: "user-a",
          clientEventId: "event-a",
          input: { clientEventId: "event-a", kind: "video" },
          attempts: 0,
          nextAttemptAt: 0,
        },
        {
          ownerUserId: "user-b",
          clientEventId: "event-b",
          input: { clientEventId: "event-b", kind: "video" },
          attempts: 0,
          nextAttemptAt: 0,
        },
      ],
    };
    const session: Record<string, unknown> = {};
    const writes: unknown[] = [];
    const chrome = {
      storage: {
        local: storage(local, writes),
        session: storage(session, writes),
      },
      runtime: {
        id: "meocnghfgmmcnnjiihpcgjnaameioddp",
        getURL: (path: string) =>
          `chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp/${path}`,
      },
      alarms: { create: vi.fn(), clear: vi.fn(async () => true) },
    };
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "access-c",
        refresh_token: "refresh-c",
        expires_in: 3600,
        user: { id: "user-c", email: "c@example.com" },
      }),
    }));
    const client = auth.createAuthClient({
      chrome,
      fetch: fetcher,
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon-key",
      now: () => 1_700_000_000_000,
    });

    const signedIn = await client.signInWithPassword({
      email: "c@example.com",
      password: "correct-horse",
    });
    const apiFetch = vi.fn();
    const queue = syncQueue.createSyncQueue({
      chrome,
      authClient: client,
      apiFetch,
      now: () => 1_700_000_000_000,
      structuredClone,
    });
    const flush = await queue.flushPendingEvents("regained-auth");

    expect(signedIn.user).toEqual({ id: "user-c", email: "c@example.com" });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(flush.pending).toBe(2);
    expect(local.popcorn_pending_events).toHaveLength(2);
    expect(JSON.stringify(writes)).not.toMatch(/correct-horse|password/i);
    await expect(client.signOut()).resolves.toEqual({
      pendingCount: 0,
      requiresDecision: false,
    });
    expect(local.popcorn_pending_events).toHaveLength(2);
  });
});
