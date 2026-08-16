import type {
  SavedItem,
  SavedItemInput,
  TranscriptSegment,
  VideoSnapshot,
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

export function makeVideoSnapshot(overrides: Partial<VideoSnapshot> = {}): VideoSnapshot {
  return {
    id: "00000000-0000-4000-8000-000000000011",
    userId: "00000000-0000-4000-8000-000000000002",
    sourceId: "00000000-0000-4000-8000-000000000001",
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: 213,
    description: "一段中文访谈。",
    transcriptLanguage: "zh-CN",
    transcriptHash: "c".repeat(64),
    capturedAt: "2026-08-16T10:00:00.000Z",
    createdAt: "2026-08-16T10:00:01.000Z",
    ...overrides,
  };
}

export function makeTranscriptSegment(
  overrides: Partial<TranscriptSegment> = {},
): TranscriptSegment {
  return {
    id: "seg-42",
    userId: "00000000-0000-4000-8000-000000000002",
    snapshotId: "00000000-0000-4000-8000-000000000011",
    language: "zh-CN",
    position: 42,
    startSeconds: 42,
    endSeconds: 48,
    originalChinese: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    createdAt: "2026-08-16T10:00:02.000Z",
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

export function makeVideoSavedItemInput(
  overrides: Partial<Extract<SavedItemInput, { kind: "video" }>> = {},
): Extract<SavedItemInput, { kind: "video" }> {
  return {
    clientEventId: "00000000-0000-4000-8000-000000000102",
    youtubeVideoId: "dQw4w9WgXcQ",
    kind: "video",
    capturedAt: "2026-08-16T10:00:00.000Z",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    durationSeconds: 213,
    description: "一段中文访谈。",
    currentTimeSeconds: 42,
    requestNativeSnapshot: true,
    ...overrides,
  };
}

export function makeSavedVideoItem(
  overrides: Partial<Extract<SavedItem, { kind: "video" }>> = {},
): Extract<SavedItem, { kind: "video" }> {
  return {
    ...makeVideoSavedItemInput(),
    id: "00000000-0000-4000-8000-000000000103",
    userId: "00000000-0000-4000-8000-000000000002",
    sourceId: "00000000-0000-4000-8000-000000000001",
    snapshotId: null,
    status: "saved",
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}
