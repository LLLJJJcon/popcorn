import { describe, expect, test, vi } from "vitest";

import { CaptureSaveError, createSyncHandler } from "@/server/domain/capture-save";

const USER_A = "00000000-0000-4000-8000-000000000002";
const VIDEO_ID = "dQw4w9WgXcQ";

const event = (index: number) => ({
  clientEventId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  youtubeVideoId: VIDEO_ID,
  kind: "player_moment",
  capturedAt: "2026-08-16T10:00:00.000Z",
  capturedSecond: 42,
});

const request = (events: unknown[]) =>
  new Request("https://app.popcorn.test/api/v1/extension/sync", {
    method: "POST",
    headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });

describe("POST /api/v1/extension/sync", () => {
  test("accepts exactly 1-50 events and preserves ordered partial results", async () => {
    const capture = vi.fn(async (_userId: string, input: unknown) => {
      const id = (input as { clientEventId: string }).clientEventId;
      if (id.endsWith("000003")) throw new CaptureSaveError("SYNC_RETRYING", true);
      return { videoSourceId: "00000000-0000-4000-8000-000000000201", savedItemId: id, status: "saved" as const };
    });
    const handler = createSyncHandler({
      authenticate: async () => ({ ok: true, userId: USER_A, client: {} }),
      capture,
      requestId: () => "req-batch",
    });
    const mixed = [event(1), { ...event(2), capturedSecond: -1 }, event(3), event(4)];
    const response = await handler(request(mixed));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.results.map((result: { clientEventId: string | null }) => result.clientEventId)).toEqual(mixed.map((item) => item.clientEventId));
    expect(body.data.results.map((result: { ok: boolean; error?: { code: string } }) => result.ok ? "saved" : result.error?.code)).toEqual([
      "saved",
      "VALIDATION_FAILED",
      "SYNC_RETRYING",
      "saved",
    ]);
    expect(capture).toHaveBeenCalledTimes(3);

    const fifty = await handler(request(Array.from({ length: 50 }, (_, index) => event(index + 100))));
    expect(fifty.status).toBe(200);
    expect((await fifty.json()).data.results).toHaveLength(50);
    for (const invalidSize of [[], Array.from({ length: 51 }, (_, index) => event(index + 200))]) {
      const invalid = await handler(request(invalidSize));
      expect(invalid.status).toBe(400);
      expect(await invalid.json()).toMatchObject({ ok: false, error: { code: "VALIDATION_FAILED", retryable: false } });
    }
  });

  test("retries partial batches idempotently and reports every event again", async () => {
    const stored = new Map<string, string>();
    let failSecond = true;
    const capture = vi.fn(async (_userId: string, input: unknown) => {
      const id = (input as { clientEventId: string }).clientEventId;
      if (id === event(2).clientEventId && failSecond) {
        failSecond = false;
        throw new CaptureSaveError("SYNC_RETRYING", true);
      }
      if (!stored.has(id)) stored.set(id, `00000000-0000-4000-9000-${String(stored.size + 1).padStart(12, "0")}`);
      return { videoSourceId: "00000000-0000-4000-8000-000000000201", savedItemId: stored.get(id)!, status: "saved" as const };
    });
    const handler = createSyncHandler({
      authenticate: async () => ({ ok: true, userId: USER_A, client: {} }),
      capture,
      requestId: () => "req-retry",
    });
    const events = [event(1), event(2), event(3)];

    const first = await (await handler(request(events))).json();
    const retry = await (await handler(request(events))).json();

    expect(first.data.results).toHaveLength(3);
    expect(retry.data.results).toHaveLength(3);
    expect(first.data.results[0].data.savedItemId).toBe(retry.data.results[0].data.savedItemId);
    expect(first.data.results[2].data.savedItemId).toBe(retry.data.results[2].data.savedItemId);
    expect(first.data.results[1]).toMatchObject({ ok: false, error: { code: "SYNC_RETRYING" } });
    expect(retry.data.results[1]).toMatchObject({ ok: true, data: { status: "saved" } });
  });

  test("preserves parseable client IDs for invalid events and rejects oversized bodies before capture", async () => {
    const capture = vi.fn();
    const handler = createSyncHandler({
      authenticate: async () => ({ ok: true, userId: USER_A, client: {} }),
      capture,
      requestId: () => "req-invalid",
    });
    const validId = event(9).clientEventId;
    const invalid = await (await handler(request([{ clientEventId: validId, kind: "url", url: "https://example.com" }, { kind: "screenshot" }]))).json();
    expect(invalid.data.results).toEqual([
      { clientEventId: validId, ok: false, error: { code: "VALIDATION_FAILED", message: "Invalid saved event.", retryable: false } },
      { clientEventId: null, ok: false, error: { code: "VALIDATION_FAILED", message: "Invalid saved event.", retryable: false } },
    ]);
    expect(capture).not.toHaveBeenCalled();

    const oversized = new Request("https://app.popcorn.test/api/v1/extension/sync", {
      method: "POST",
      headers: { authorization: "Bearer token", "content-type": "application/json" },
      body: "x".repeat(2_100_000),
    });
    const response = await handler(oversized);
    expect(response.status).toBe(400);
    expect(capture).not.toHaveBeenCalled();
  });
});
