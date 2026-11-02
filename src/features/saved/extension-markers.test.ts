import { describe, expect, it } from "vitest";

import {
  createExtensionSavedMarkersHandler,
  toSavedMarkers,
  type SavedMarkerRepository,
} from "./extension-markers";

const USER = "00000000-0000-4000-8000-000000000001";
const VIDEO = "TBNYkgulgaY";

describe("extension saved markers", () => {
  it("collects saved rows by segment and start, and player moments by second", () => {
    expect(toSavedMarkers(VIDEO, [
      { kind: "subtitle_row", startSeconds: 3, payload: { segmentId: "seg-3", startSeconds: 3 } },
      { kind: "subtitle_row", startSeconds: 3, payload: { segmentId: "seg-3", startSeconds: 3 } },
      { kind: "player_moment", startSeconds: 41.7, payload: { capturedSecond: 41.7 } },
      { kind: "subtitle_row", startSeconds: null, payload: null },
    ])).toEqual({
      youtubeVideoId: VIDEO,
      segmentIds: ["seg-3"],
      rowStartSeconds: [3],
      capturedSeconds: [41],
    });
  });

  it("reads only the signed-in user's markers for a valid video", async () => {
    const calls: [string, string][] = [];
    const repository: SavedMarkerRepository = {
      async list(userId, videoId) {
        calls.push([userId, videoId]);
        return [{ kind: "subtitle_row", startSeconds: 4, payload: { segmentId: "seg-4", startSeconds: 4 } }];
      },
    };
    const handler = createExtensionSavedMarkersHandler({
      authenticate: async () => ({ ok: true, userId: USER, client: { ownerUserId: USER, rpc: async () => ({ data: null, error: null }) } }),
      repository,
      requestId: () => "request-1",
    });

    const response = await handler(new Request(`http://localhost/api/v1/extension/saved/markers?videoId=${VIDEO}`));

    expect(response.status).toBe(200);
    expect(calls).toEqual([[USER, VIDEO]]);
    expect((await response.json()).data.segmentIds).toEqual(["seg-4"]);
  });

  it("requires a session and a valid video ID", async () => {
    const repository: SavedMarkerRepository = { list: async () => { throw new Error("must not read"); } };
    const signedOut = createExtensionSavedMarkersHandler({
      authenticate: async () => ({ ok: false, reason: "missing" }),
      repository,
      requestId: () => "request-2",
    });
    expect((await signedOut(new Request(`http://localhost/m?videoId=${VIDEO}`))).status).toBe(401);

    const signedIn = createExtensionSavedMarkersHandler({
      authenticate: async () => ({ ok: true, userId: USER, client: { ownerUserId: USER, rpc: async () => ({ data: null, error: null }) } }),
      repository,
      requestId: () => "request-3",
    });
    expect((await signedIn(new Request("http://localhost/m?videoId=bad"))).status).toBe(400);
  });
});
