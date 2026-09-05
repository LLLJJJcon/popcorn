import type { SavedVideoSummary } from "@/features/saved/api";
import { createHomeLoader } from "@/features/home/home-runtime";
import type { HomeView } from "@/features/home/home-view";
import { selectNextAction } from "@/features/home/next-action";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = "2026-09-05T08:00:00.000Z";

const recentVideo: SavedVideoSummary = {
  sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  youtubeVideoId: "recentVid01",
  canonicalUrl: "https://www.youtube.com/watch?v=recentVid01",
  title: "The newest Mandarin interview",
  channel: "Everyday Chinese",
  thumbnailUrl: "https://i.ytimg.com/vi/recentVid01/hqdefault.jpg",
  savedCount: 3,
  latestSavedAt: "2026-09-04T18:00:00.000Z",
  processingState: "organizing",
};

const olderVideo: SavedVideoSummary = {
  ...recentVideo,
  sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  youtubeVideoId: "olderVideo1",
  canonicalUrl: "https://www.youtube.com/watch?v=olderVideo1",
  title: "An older lesson",
  thumbnailUrl: "https://i.ytimg.com/vi/olderVideo1/hqdefault.jpg",
  latestSavedAt: "2026-09-03T18:00:00.000Z",
};

const emptyView: HomeView = {
  hasActiveGateway: true,
  duePracticeCount: 0,
  unsortedSaveCount: 0,
  recentVideo: null,
  masteryDistribution: { tried: 0, reused: 0, owned: 0 },
};

describe("Home next-action decision table", () => {
  it("requires the complete HomeView at the public selector boundary", () => {
    // @ts-expect-error -- gateway state and supporting projections are mandatory decision input.
    selectNextAction({ duePracticeCount: 0, unsortedSaveCount: 0 });

    expect([
      selectNextAction({ ...emptyView, hasActiveGateway: false }).kind,
      selectNextAction({ ...emptyView, duePracticeCount: 1 }).kind,
      selectNextAction({ ...emptyView, unsortedSaveCount: 1 }).kind,
      selectNextAction(emptyView).kind,
    ]).toEqual(["gateway", "practice", "saved", "youtube"]);
  });

  it("makes gateway setup the singular priority over due Practice and unsorted saves", () => {
    expect(selectNextAction({
      ...emptyView,
      hasActiveGateway: false,
      duePracticeCount: 2,
      unsortedSaveCount: 3,
    })).toEqual({ kind: "gateway", href: "/settings/model-gateway" });
  });

  it("selects due Practice before unsorted saves", () => {
    expect(selectNextAction({
      ...emptyView,
      duePracticeCount: 2,
      unsortedSaveCount: 3,
    })).toEqual({ kind: "practice", href: "/practice", count: 2 });
  });

  it("selects Saved when the gateway is active and nothing is due", () => {
    expect(selectNextAction({
      ...emptyView,
      unsortedSaveCount: 3,
    })).toEqual({ kind: "saved", href: "/saved", count: 3 });
  });

  it("returns to YouTube only when no workspace action is waiting", () => {
    expect(selectNextAction(emptyView)).toEqual({
      kind: "youtube",
      href: "https://www.youtube.com/",
    });
  });
});

describe("bounded Home runtime composition", () => {
  it("authenticates once and composes accepted owner-scoped summaries without leaking gateway rows", async () => {
    const authenticate = vi.fn(async () => ({ ok: true as const, userId: USER_ID }));
    const home = vi.fn(async () => ({ duePracticeCount: 2, unsortedSaveCount: 3 }));
    const list = vi.fn(async () => [recentVideo, olderVideo]);
    const read = vi.fn(async () => ({
      week: {
        startsAt: "2026-08-31T00:00:00.000Z",
        endsAt: "2026-09-07T00:00:00.000Z",
      },
      weeklyAttemptCount: 8,
      dueCompletionCount: 2,
      independentReuseCount: 1,
      duePracticeCount: 99,
      masteryDistribution: { tried: 4, reused: 2, owned: 1 },
    }));
    const listConfigs = vi.fn(async () => [{
      state: "active",
      id: "private-gateway-id",
      model: "private-model-name",
      apiKey: "private-api-key",
    }]);
    const loadHome = createHomeLoader({
      authenticate,
      saved: { home, list },
      progress: { read },
      gateways: { listConfigs },
    });

    const result = await loadHome(new Request("https://popcorn.example/home"), NOW);

    expect(authenticate).toHaveBeenCalledOnce();
    expect(home).toHaveBeenCalledExactlyOnceWith(USER_ID, NOW);
    expect(list).toHaveBeenCalledExactlyOnceWith(USER_ID);
    expect(read).toHaveBeenCalledExactlyOnceWith(USER_ID, NOW);
    expect(listConfigs).toHaveBeenCalledExactlyOnceWith(USER_ID);
    expect(result).toEqual({
      ok: true,
      view: {
        hasActiveGateway: true,
        duePracticeCount: 2,
        unsortedSaveCount: 3,
        recentVideo,
        masteryDistribution: { tried: 4, reused: 2, owned: 1 },
      },
    });
    expect(Object.keys(result.ok ? result.view : {}).sort()).toEqual([
      "duePracticeCount",
      "hasActiveGateway",
      "masteryDistribution",
      "recentVideo",
      "unsortedSaveCount",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/private-gateway-id|private-model-name|private-api-key/);
  });

  it("does not read Home repositories for an unauthenticated request", async () => {
    const home = vi.fn();
    const list = vi.fn();
    const read = vi.fn();
    const listConfigs = vi.fn();
    const loadHome = createHomeLoader({
      authenticate: vi.fn(async () => ({ ok: false as const, reason: "missing" as const })),
      saved: { home, list },
      progress: { read },
      gateways: { listConfigs },
    });

    await expect(loadHome(new Request("https://popcorn.example/home"), NOW)).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
    expect(home).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
    expect(listConfigs).not.toHaveBeenCalled();
  });
});
