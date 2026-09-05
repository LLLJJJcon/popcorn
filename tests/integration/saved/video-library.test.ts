import {
  createSavedLibraryHttpHandlers,
  createSavedLibraryService,
  groupSavedVideos,
  type SavedLibraryRepository,
  type SavedLibraryRows,
} from "@/features/saved/api";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const SOURCE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SNAPSHOT_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function rows(): SavedLibraryRows {
  return {
    sources: [{
      id: SOURCE_A,
      userId: USER_A,
      youtubeVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    }],
    snapshots: [{
      id: SNAPSHOT_A,
      userId: USER_A,
      sourceId: SOURCE_A,
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      capturedAt: "2026-08-16T09:00:00.000Z",
    }],
    items: Array.from({ length: 7 }, (_, index) => ({
      id: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${index}`,
      userId: USER_A,
      sourceId: SOURCE_A,
      snapshotId: SNAPSHOT_A,
      youtubeVideoId: "dQw4w9WgXcQ",
      kind: "subtitle_row",
      status: index === 0 ? "organizing" : "ready",
      capturedAt: `2026-08-16T10:00:0${index}.000Z`,
      startSeconds: index * 4,
      payload: {
        originalChinese: `原文${index}`,
        englishTranslation: `Translation ${index}`,
        segmentId: `seg-${index}`,
      },
    })),
    artifacts: [{
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      userId: USER_A,
      sourceId: SOURCE_A,
      savedItemId: null,
      type: "overview",
      promptVersion: "overview-v1",
      content: { summary: "A bounded overview", chapters: [{ title: "Start", startSeconds: 0 }] },
      createdAt: "2026-08-16T10:10:00.000Z",
    }],
    jobs: [{
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      userId: USER_A,
      sourceId: SOURCE_A,
      savedItemId: null,
      type: "generate_overview",
      status: "succeeded",
      errorCode: null,
      createdAt: "2026-08-16T10:09:00.000Z",
    }],
    evidence: Array.from({ length: 7 }, (_, index) => ({
      id: `seg-${index}`,
      userId: USER_A,
      snapshotId: SNAPSHOT_A,
      originalChinese: `原文${index}`,
      englishTranslation: `Translation ${index}`,
      startSeconds: index * 4,
      endSeconds: index * 4 + 2,
    })),
  };
}

function repository(data = rows()): SavedLibraryRepository & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async list(userId) {
      calls.push(`list:${userId}`);
      return data;
    },
    async detail(userId, sourceId) {
      calls.push(`detail:${userId}:${sourceId}`);
      return sourceId === SOURCE_A ? data : null;
    },
    async home(userId, now) {
      calls.push(`home:${userId}:${now}`);
      return { duePracticeCount: 0, unsortedSaveCount: 7 };
    },
  };
}

describe("owner-scoped Saved video library", () => {
  it("uses ascending latest saved-item ID before source ID when latest activity times tie", () => {
    const summaries = groupSavedVideos({
      sources: [
        { id: "source-with-later-source-id", youtubeVideoId: "laterSrc01", canonicalUrl: "https://www.youtube.com/watch?v=laterSrc01" },
        { id: "source-with-ascending-latest-item-id", youtubeVideoId: "earlyItem1", canonicalUrl: "https://www.youtube.com/watch?v=earlyItem1" },
      ],
      snapshots: [],
      items: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sourceId: "source-with-later-source-id",
          kind: "subtitle_row",
          status: "ready",
          capturedAt: "2026-08-21T00:00:00.000Z",
          startSeconds: 1,
          rawText: "后",
          englishTranslation: null,
          youtubeUrl: "https://www.youtube.com/watch?v=laterSrc01&t=1s",
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceId: "source-with-ascending-latest-item-id",
          kind: "subtitle_row",
          status: "ready",
          capturedAt: "2026-08-21T00:00:00.000Z",
          startSeconds: 1,
          rawText: "先",
          englishTranslation: null,
          youtubeUrl: "https://www.youtube.com/watch?v=earlyItem1&t=1s",
        },
      ],
      jobs: [],
    });

    expect(summaries.map(({ sourceId }) => sourceId)).toEqual([
      "source-with-ascending-latest-item-id",
      "source-with-later-source-id",
    ]);
    expect(JSON.stringify(summaries)).not.toMatch(/latestItemId|aaaaaaaa|bbbbbbbb/);
  });

  it("does not let source ID override the saved-item tie-break", () => {
    const summaries = groupSavedVideos({
      sources: [
        { id: "source-a", youtubeVideoId: "sourceA0001", canonicalUrl: "https://www.youtube.com/watch?v=sourceA0001" },
        { id: "source-z", youtubeVideoId: "sourceZ0001", canonicalUrl: "https://www.youtube.com/watch?v=sourceZ0001" },
      ],
      snapshots: [],
      items: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          sourceId: "source-a",
          kind: "subtitle_row",
          status: "ready",
          capturedAt: "2026-08-21T00:00:00.000Z",
          startSeconds: 1,
          rawText: "后",
          englishTranslation: null,
          youtubeUrl: "https://www.youtube.com/watch?v=sourceA0001&t=1s",
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          sourceId: "source-z",
          kind: "subtitle_row",
          status: "ready",
          capturedAt: "2026-08-21T00:00:00.000Z",
          startSeconds: 1,
          rawText: "先",
          englishTranslation: null,
          youtubeUrl: "https://www.youtube.com/watch?v=sourceZ0001&t=1s",
        },
      ],
      jobs: [],
    });

    expect(summaries.map(({ sourceId }) => sourceId)).toEqual(["source-z", "source-a"]);
  });

  it("groups seven saves into one list DTO without any transcript or raw payload", async () => {
    const repo = repository();
    const result = await createSavedLibraryService(repo).list(USER_A);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sourceId: SOURCE_A, savedCount: 7 });
    expect(repo.calls).toEqual([`list:${USER_A}`]);
    expect(JSON.stringify(result)).not.toMatch(/transcript|原文|Translation|payload/i);
  });

  it("returns only bounded saved evidence and stored artifacts in deterministic timeline order", async () => {
    const detail = await createSavedLibraryService(repository()).detail(USER_A, SOURCE_A);

    expect(detail?.items).toHaveLength(7);
    expect(detail?.items.map((entry) => entry.startSeconds)).toEqual([0, 4, 8, 12, 16, 20, 24]);
    expect(detail?.items[0]).toMatchObject({ rawText: "原文0", englishTranslation: "Translation 0" });
    expect(detail?.artifacts).toEqual([{
      artifactId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      savedItemId: null,
      type: "overview",
      promptVersion: "overview-v1",
      content: { summary: "A bounded overview", chapters: [{ title: "Start", startSeconds: 0 }] },
    }]);
    expect(JSON.stringify(detail)).not.toContain("seg-6\",\"userId");
  });

  it("does not publish a detail alert for a terminal job while preserving the saved material", async () => {
    const base = rows();
    const terminal = {
      ...base,
      jobs: [{
        ...base.jobs[0]!,
        status: "terminal_failed",
        errorCode: "PROVIDER_UNAVAILABLE",
      }],
    };

    const detail = await createSavedLibraryService(repository(terminal)).detail(USER_A, SOURCE_A);

    expect(detail?.processingState).toBe("failed");
    expect(detail?.processingErrors).toEqual([]);
    expect(detail?.items[0]).toMatchObject({ rawText: "原文0", englishTranslation: "Translation 0" });
  });

  it("uses only same-snapshot evidence that contains a player moment timestamp", async () => {
    const base = rows();
    const snapshotB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbc";
    const playerItems = [
      { id: "player-at-start", snapshotId: SNAPSHOT_A, startSeconds: 10 },
      { id: "player-before-next", snapshotId: SNAPSHOT_A, startSeconds: 13.999 },
      { id: "player-at-next", snapshotId: SNAPSHOT_A, startSeconds: 14 },
      { id: "player-other-snapshot", snapshotId: snapshotB, startSeconds: 10 },
    ].map(({ id, snapshotId, startSeconds }) => ({
      id,
      userId: USER_A,
      sourceId: SOURCE_A,
      snapshotId,
      youtubeVideoId: "dQw4w9WgXcQ",
      kind: "player_moment",
      status: "ready",
      capturedAt: "2026-08-16T10:20:00.000Z",
      startSeconds,
      payload: {},
    }));
    const detailRows = {
      ...base,
      snapshots: [...base.snapshots, {
        id: snapshotB,
        userId: USER_A,
        sourceId: SOURCE_A,
        title: "另一份快照",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        capturedAt: "2026-08-16T09:01:00.000Z",
      }],
      items: playerItems,
      evidence: [{
        id: "same-snapshot-segment",
        userId: USER_A,
        snapshotId: SNAPSHOT_A,
        originalChinese: "同一快照的字幕",
        englishTranslation: "Same snapshot subtitle.",
        startSeconds: 10,
        endSeconds: 14,
      }],
    };

    const detail = await createSavedLibraryService(repository(detailRows)).detail(USER_A, SOURCE_A);

    expect(detail?.items.map(({ id, rawText, englishTranslation, youtubeUrl }) => ({ id, rawText, englishTranslation, youtubeUrl }))).toEqual([
      {
        id: "player-at-start",
        rawText: "同一快照的字幕",
        englishTranslation: "Same snapshot subtitle.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      },
      {
        id: "player-other-snapshot",
        rawText: "Saved video moment",
        englishTranslation: null,
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
      },
      {
        id: "player-before-next",
        rawText: "同一快照的字幕",
        englishTranslation: "Same snapshot subtitle.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=13s",
      },
      {
        id: "player-at-next",
        rawText: "Saved video moment",
        englishTranslation: null,
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=14s",
      },
    ]);
  });

  it("fails closed when a repository leaks another owner's detail", async () => {
    const repo = repository();
    const service = createSavedLibraryService(repo);

    await expect(service.detail(USER_B, SOURCE_A)).resolves.toBeNull();
    expect(repo.calls).toEqual([`detail:${USER_B}:${SOURCE_A}`]);
  });

  it("isolates an orphaned same-source artifact while preserving the raw saved material", async () => {
    const base = rows();
    const malformed = { ...base, artifacts: [{
      ...base.artifacts[0]!,
      savedItemId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      type: "saved_item_analysis",
      promptVersion: "analyze-saved-item-v1",
      content: { candidates: [{ expression: "不完整" }], providerBody: "private" },
    }] };

    const detail = await createSavedLibraryService(repository(malformed)).detail(USER_A, SOURCE_A);

    expect(detail?.items).toHaveLength(7);
    expect(detail?.items[0]).toMatchObject({ rawText: "原文0", englishTranslation: "Translation 0" });
    expect(detail?.artifacts).toEqual([]);
    expect(JSON.stringify(detail)).not.toContain("private");
  });

  it.each([
    ["another owner", { userId: USER_B }],
    ["another source", { sourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }],
  ])("fails closed when a published artifact belongs to %s", async (_label, override) => {
    const base = rows();
    const leaked = { ...base, artifacts: [{ ...base.artifacts[0]!, ...override }] };

    await expect(createSavedLibraryService(repository(leaked)).detail(USER_A, SOURCE_A)).resolves.toBeNull();
  });

  it("maps web sessions to no-store envelopes and never calls detail for an expired session", async () => {
    const repo = repository();
    const service = createSavedLibraryService(repo);
    const handlers = createSavedLibraryHttpHandlers({
      authenticate: async () => ({ ok: false, reason: "expired" }),
      service,
      requestId: () => "request-safe",
    });

    const response = await handlers.detail(
      new Request(`https://popcorn.example/api/v1/saved/${SOURCE_A}`),
      SOURCE_A,
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "SESSION_EXPIRED" },
      requestId: "request-safe",
    });
    expect(repo.calls).toEqual([]);
  });
});
