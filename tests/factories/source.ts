import type {
  SavedItemInput,
  VideoSource,
} from "@/contracts";

export function makeVideoSource(overrides: Partial<VideoSource> = {}): VideoSource {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000002",
    youtubeVideoId: "dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

export function makeSavedItemInput(
  overrides: Partial<Extract<SavedItemInput, { kind: "subtitle_selection" }>> = {},
): Extract<SavedItemInput, { kind: "subtitle_selection" }> {
  return {
    clientEventId: "00000000-0000-4000-8000-000000000101",
    youtubeVideoId: "dQw4w9WgXcQ",
    kind: "subtitle_selection",
    capturedAt: "2026-08-16T10:00:00.000Z",
    startSeconds: 42,
    endSeconds: 48,
    originalChinese: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    segmentIds: ["seg-42"],
    startOffset: 0,
    endOffset: 9,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
    ...overrides,
  };
}
