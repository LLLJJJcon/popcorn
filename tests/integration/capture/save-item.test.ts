import { describe, expect, test, vi } from "vitest";

import type { SavedItemInput } from "@/contracts";
import {
  CaptureSaveError,
  createCaptureSave,
  createSavedItemHandler,
  type CaptureRepository,
} from "@/server/domain/capture-save";
import {
  createSavedItemRepository,
  type CaptureRpcClient,
} from "@/server/repositories/saved-item-repository";

const USER_A = "00000000-0000-4000-8000-000000000002";
const USER_B = "00000000-0000-4000-8000-000000000003";
const SOURCE_A = "00000000-0000-4000-8000-000000000201";
const SAVE_A = "00000000-0000-4000-8000-000000000202";
const VIDEO_ID = "dQw4w9WgXcQ";
const CAPTURED_AT = "2026-08-16T10:00:00.000Z";

const common = (clientEventId: string) => ({
  clientEventId,
  youtubeVideoId: VIDEO_ID,
  capturedAt: CAPTURED_AT,
});

const variants: SavedItemInput[] = [
  {
    ...common("00000000-0000-4000-8000-000000000101"),
    kind: "video",
    canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    durationSeconds: 213,
    description: "一段中文访谈。",
    currentTimeSeconds: 42,
    requestNativeSnapshot: true,
  },
  {
    ...common("00000000-0000-4000-8000-000000000102"),
    kind: "player_moment",
    capturedSecond: 39,
  },
  {
    ...common("00000000-0000-4000-8000-000000000103"),
    kind: "subtitle_row",
    segmentId: "seg-42",
    originalChinese: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
  {
    ...common("00000000-0000-4000-8000-000000000104"),
    kind: "subtitle_selection",
    originalChinese: "太离谱了",
    englishTranslation: "That is absurd.",
    segmentIds: ["seg-42", "seg-43"],
    startSeconds: 42,
    endSeconds: 48,
    startOffset: 2,
    endOffset: 7,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
  {
    ...common("00000000-0000-4000-8000-000000000105"),
    kind: "key_quote",
    exactQuote: "这也太离谱了吧。",
    quoteSeconds: 44,
    segmentIds: ["seg-42"],
  },
  {
    ...common("00000000-0000-4000-8000-000000000106"),
    kind: "ai_explanation",
    selectedChinese: "太离谱了",
    englishExplanation: "An informal reaction meaning something is absurd.",
    segmentIds: ["seg-42"],
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
];

const expectedPayloads = [
  {
    canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    durationSeconds: 213,
    description: "一段中文访谈。",
    currentTimeSeconds: 42,
    requestNativeSnapshot: true,
  },
  { capturedSecond: 39 },
  {
    segmentId: "seg-42",
    originalChinese: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
  {
    originalChinese: "太离谱了",
    englishTranslation: "That is absurd.",
    segmentIds: ["seg-42", "seg-43"],
    startSeconds: 42,
    endSeconds: 48,
    startOffset: 2,
    endOffset: 7,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
  { exactQuote: "这也太离谱了吧。", quoteSeconds: 44, segmentIds: ["seg-42"] },
  {
    selectedChinese: "太离谱了",
    englishExplanation: "An informal reaction meaning something is absurd.",
    segmentIds: ["seg-42"],
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  },
];

describe("captureSave", () => {
  test("maps all six exact variants once to the frozen RPC boundary", async () => {
    const capture = vi.fn(async () => ({
      videoSourceId: SOURCE_A,
      savedItemId: SAVE_A,
      status: "saved" as const,
    }));
    const repository: CaptureRepository = { capture };
    const captureSave = createCaptureSave(repository);

    for (const input of variants) {
      await expect(captureSave(USER_A, input)).resolves.toEqual({
        videoSourceId: SOURCE_A,
        savedItemId: SAVE_A,
        status: "saved",
      });
    }

    expect(capture).toHaveBeenCalledTimes(6);
    variants.forEach((input, index) => {
      expect(capture.mock.calls[index]).toEqual([
        USER_A,
        {
          p_youtube_video_id: VIDEO_ID,
          p_client_event_id: input.clientEventId,
          p_kind: input.kind,
          p_captured_at: CAPTURED_AT,
          p_start_seconds: [42, 39, 42, 42, 44, 42][index],
          p_payload: expectedPayloads[index],
        },
      ]);
    });
  });

  test("rejects invalid or out-of-scope input before the RPC and imports no Provider", async () => {
    const repository: CaptureRepository = { capture: vi.fn() };
    const captureSave = createCaptureSave(repository);
    for (const invalid of [
      { ...variants[0], youtubeVideoId: "short" },
      { ...variants[0], canonicalUrl: "https://example.com/watch?v=dQw4w9WgXcQ" },
      { ...variants[3], endOffset: 2 },
      { ...variants[3], segmentIds: Array.from({ length: 33 }, (_, index) => `seg-${index}`) },
      { ...variants[5], englishExplanation: "只有中文" },
      { ...common("00000000-0000-4000-8000-000000000109"), kind: "text", text: "hello" },
      { ...common("00000000-0000-4000-8000-000000000110"), kind: "image", url: "https://example.com/a.png" },
    ]) {
      await expect(captureSave(USER_A, invalid)).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    }
    expect(repository.capture).not.toHaveBeenCalled();
  });

  test("uses one owner-bound capture_saved_item RPC and rejects cross-user scope/results", async () => {
    const rpc = vi.fn(async (name: "capture_saved_item", args: unknown) => {
      expect(name).toBe("capture_saved_item");
      expect(args).toBeDefined();
      return {
        data: [{ video_source_id: SOURCE_A, saved_item_id: SAVE_A, status: "saved" }],
        error: null,
      };
    });
    const client: CaptureRpcClient = { ownerUserId: USER_A, rpc };
    const repository = createSavedItemRepository(client);
    const captureSave = createCaptureSave(repository);

    await expect(captureSave(USER_A, variants[0])).resolves.toMatchObject({ status: "saved" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe("capture_saved_item");
    await expect(captureSave(USER_B, variants[0])).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rpc).toHaveBeenCalledTimes(1);

    const wrongOwner = createSavedItemRepository({ ...client, ownerUserId: USER_B });
    await expect(createCaptureSave(wrongOwner)(USER_A, variants[0])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("preserves RPC idempotency identities without any Provider dependency", async () => {
    const ids = new Map<string, string>();
    const provider = vi.fn(() => {
      throw new Error("Provider must not be called");
    });
    const repository: CaptureRepository = {
      capture: vi.fn(async (userId, args) => {
        const key = `${userId}:${args.p_client_event_id}`;
        if (!ids.has(key)) ids.set(key, `saved-${ids.size + 1}`);
        return { videoSourceId: `${userId}-source`, savedItemId: ids.get(key)!, status: "saved" as const };
      }),
    };
    const captureSave = createCaptureSave(repository);
    const first = await captureSave(USER_A, variants[1]);
    const replay = await captureSave(USER_A, variants[1]);
    const distinct = await captureSave(USER_A, { ...variants[1], clientEventId: "00000000-0000-4000-8000-000000000111" });
    const otherUser = await captureSave(USER_B, variants[1]);

    expect(replay).toEqual(first);
    expect(distinct.savedItemId).not.toBe(first.savedItemId);
    expect(otherUser.savedItemId).not.toBe(first.savedItemId);
    expect(provider).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/saved-items", () => {
  test("returns bounded auth, validation, and retryable RPC errors", async () => {
    const request = (body: unknown, authorization?: string) =>
      new Request("https://app.popcorn.test/api/v1/saved-items", {
        method: "POST",
        headers: authorization ? { authorization, "content-type": "application/json" } : { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    const validContext = { ok: true as const, userId: USER_A, client: {} };
    const capture = vi.fn(async () => ({ videoSourceId: SOURCE_A, savedItemId: SAVE_A, status: "saved" as const }));

    const missing = createSavedItemHandler({ authenticate: async () => ({ ok: false, reason: "missing" }), capture, requestId: () => "req-missing" });
    expect(await (await missing(request(variants[0]))).json()).toMatchObject({ ok: false, error: { code: "AUTH_REQUIRED", retryable: false } });

    const expired = createSavedItemHandler({ authenticate: async () => ({ ok: false, reason: "expired" }), capture, requestId: () => "req-expired" });
    expect(await (await expired(request(variants[0], "Bearer expired"))).json()).toMatchObject({ ok: false, error: { code: "SESSION_EXPIRED", retryable: false } });

    const handler = createSavedItemHandler({ authenticate: async () => validContext, capture, requestId: () => "req-valid" });
    const invalid = await handler(request({ ...variants[0], youtubeVideoId: "invalid" }, "Bearer token"));
    expect(await invalid.json()).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED", retryable: false } });
    expect(capture).not.toHaveBeenCalled();

    const failing = createSavedItemHandler({
      authenticate: async () => validContext,
      capture: async () => { throw new CaptureSaveError("SYNC_RETRYING", true); },
      requestId: () => "req-rpc",
    });
    const failureBody = await (await failing(request(variants[0], "Bearer token"))).json();
    expect(failureBody).toEqual({ ok: false, error: { code: "SYNC_RETRYING", message: "Save could not be synchronized.", retryable: true }, requestId: "req-rpc" });
    expect(JSON.stringify(failureBody)).not.toMatch(/service|sql|provider|job payload/i);
  });
});
