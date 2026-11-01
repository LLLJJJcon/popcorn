// @vitest-environment node
import { createSavedLibraryService, type SavedLibraryRows } from "./api";
const userId = "11111111-1111-4111-8111-111111111111";
const sourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const snapshotId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const savedItemId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function rows(): SavedLibraryRows { return {
  sources: [{ id: sourceId, userId, youtubeVideoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }],
  snapshots: [{ id: snapshotId, userId, sourceId, title: "中文视频", channel: "频道", thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg", capturedAt: "2026-11-01T00:00:00Z" }],
  items: [{ id: savedItemId, userId, sourceId, snapshotId, youtubeVideoId: "dQw4w9WgXcQ", kind: "player_moment", status: "ready", capturedAt: "2026-11-01T00:00:00Z", startSeconds: 15, payload: { capturedSecond: 15 } }],
  artifacts: [], jobs: [],
  evidence: Array.from({ length: 7 }, (_, index) => ({ id: `s${index}`, userId, snapshotId, originalChinese: index === 3 ? "这杯咖啡高得要命" : `字幕第${index}行`, englishTranslation: null, startSeconds: index * 4, endSeconds: index * 4 + 2 })),
}; }
async function detail(data: SavedLibraryRows) { return createSavedLibraryService({ list: async () => data, detail: async () => data }).detail(userId, sourceId); }
it("uses preceding line for a player moment in a gap with a 3-before / 2-after context", async () => {
  const value = await detail(rows());
  expect(value?.items[0]).toMatchObject({ rawText: "这杯咖啡高得要命", targetSegments: [{ id: "s3", text: "这杯咖啡高得要命", startSeconds: 12, endSeconds: 14 }], contextBefore: ["字幕第0行", "字幕第1行", "字幕第2行"], contextAfter: ["字幕第4行", "字幕第5行"] });
});
it("reads persisted moment target as the source of truth", async () => {
  const original = rows();
  const data = { ...original, items: [{ ...original.items[0]!, payload: { capturedSecond: 15, resolvedSegmentId: "s3", originalChinese: "持久化的原句", startSeconds: 12, endSeconds: 14, contextBefore: ["之前"], contextAfter: ["之后"] } }] };
  const value = await detail(data);
  expect(value?.items[0]).toMatchObject({ rawText: "持久化的原句", targetSegments: [{ id: "s3", text: "持久化的原句" }], contextBefore: ["之前"], contextAfter: ["之后"] });
});
