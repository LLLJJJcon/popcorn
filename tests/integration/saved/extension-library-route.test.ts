import { describe, expect, test, vi } from "vitest";

import { createExtensionSavedLibraryHandler } from "@/app/api/v1/extension/saved/route";
import {
  createSavedLibraryService,
  type SavedLibraryRepository,
  type SavedLibraryRows,
} from "@/features/saved/api";
import type { CaptureAuthentication } from "@/server/repositories/video-source-repository";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SOURCE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SNAPSHOT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function ownerRows(userId: string): SavedLibraryRows {
  return {
    sources: [{
      id: SOURCE_A,
      userId,
      youtubeVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }],
    snapshots: [{
      id: SNAPSHOT_A,
      userId,
      sourceId: SOURCE_A,
      title: "Owner A video",
      channel: "Owner A channel",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      capturedAt: "2026-08-22T09:00:00.000Z",
    }],
    items: [{
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      userId,
      sourceId: SOURCE_A,
      snapshotId: SNAPSHOT_A,
      youtubeVideoId: "dQw4w9WgXcQ",
      kind: "subtitle_row",
      status: "organizing",
      capturedAt: "2026-08-22T10:00:00.000Z",
      startSeconds: 42,
      payload: { originalChinese: "private transcript payload" },
    }],
    artifacts: [],
    jobs: [],
    evidence: [],
  };
}

function repository() {
  const calls: string[] = [];
  const value: SavedLibraryRepository = {
    async list(userId) {
      calls.push(`list:${userId}`);
      return ownerRows(userId);
    },
    async detail() {
      throw new Error("detail must not be called by the extension list route");
    },
    async home() {
      throw new Error("home must not be called by the extension list route");
    },
  };
  return { value, calls };
}

function bearerAuthenticator(request: Request): Promise<CaptureAuthentication> {
  const authorization = request.headers.get("authorization");
  if (!authorization) return Promise.resolve({ ok: false, reason: "missing" });
  if (authorization !== "Bearer owner-a") {
    return Promise.resolve({ ok: false, reason: "expired" });
  }
  return Promise.resolve({ ok: true, userId: USER_A, client: {} as never });
}

describe("GET /api/v1/extension/saved", () => {
  test.each([
    ["missing", undefined, "AUTH_REQUIRED"],
    ["expired", "Bearer expired", "SESSION_EXPIRED"],
  ])("rejects a %s bearer session without querying Saved", async (_name, authorization, code) => {
    const repo = repository();
    const handler = createExtensionSavedLibraryHandler({
      authenticate: bearerAuthenticator,
      service: createSavedLibraryService(repo.value),
      requestId: () => "request-auth",
    });
    const response = await handler(new Request("https://app.popcorn.local/api/v1/extension/saved", {
      headers: authorization ? { authorization } : undefined,
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code,
        message: code === "AUTH_REQUIRED"
          ? "Sign in to view Saved."
          : "Your session expired. Sign in again.",
        retryable: false,
      },
      requestId: "request-auth",
    });
    expect(repo.calls).toEqual([]);
  });

  test("uses only the verified owner and returns bounded summaries in a no-store envelope", async () => {
    const repo = repository();
    const authenticate = vi.fn(bearerAuthenticator);
    const handler = createExtensionSavedLibraryHandler({
      authenticate,
      service: createSavedLibraryService(repo.value),
      requestId: () => "request-owner",
    });
    const request = new Request(
      `https://app.popcorn.local/api/v1/extension/saved?userId=${USER_B}`,
      { headers: { authorization: "Bearer owner-a", "x-user-id": USER_B } },
    );

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(repo.calls).toEqual([`list:${USER_A}`]);
    expect(authenticate).toHaveBeenCalledWith(request);
    expect(body).toEqual({
      ok: true,
      data: [{
        sourceId: SOURCE_A,
        youtubeVideoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "Owner A video",
        channel: "Owner A channel",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        savedCount: 1,
        latestSavedAt: "2026-08-22T10:00:00.000Z",
        processingState: "organizing",
      }],
      requestId: "request-owner",
    });
    expect(JSON.stringify(body)).not.toMatch(/private transcript payload|userId|x-user-id/i);
  });
});
