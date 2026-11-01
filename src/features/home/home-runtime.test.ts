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
  summary: { reviewCount: 0, secondTryCount: 0, newCount: 0, estimatedMinutes: 0, needsAnalysisCount: 0, processingCount: 0, nextPracticeAt: null },
  recentVideos: [],
  masteryDistribution: { tried: 0, reused: 0, owned: 0 },
};

describe("Home next-action decision table", () => {
  it("prioritizes gateway setup over every queued or unanalyzed save", () => {
    expect(selectNextAction({ ...emptyView, hasActiveGateway: false, summary: { ...emptyView.summary, newCount: 3, needsAnalysisCount: 4 } })).toEqual({ kind: "gateway", href: "/settings/model-gateway" });
  });
  it.each([[2, 1, 3, 12], [0, 0, 3, 6], [0, 1, 0, 2]])("starts the whole queue directly when counts are %i/%i/%i", (reviewCount, secondTryCount, newCount, estimatedMinutes) => {
    expect(selectNextAction({ ...emptyView, summary: { ...emptyView.summary, reviewCount, secondTryCount, newCount, estimatedMinutes, needsAnalysisCount: 7 } })).toEqual({ kind: "practice", href: "/practice/session", estimatedMinutes });
  });
  it("links only genuinely unanalyzed saves to the qualified Saved filter", () => {
    expect(selectNextAction({ ...emptyView, summary: { ...emptyView.summary, needsAnalysisCount: 3, processingCount: 9 } })).toEqual({ kind: "saved", href: "/saved?filter=needs-analysis", count: 3 });
  });
  it("does not promote processing or failed saves to the main action", () => {
    expect(selectNextAction({ ...emptyView, summary: { ...emptyView.summary, processingCount: 9 } })).toEqual({ kind: "youtube", href: "https://www.youtube.com/" });
  });
});

describe("Home runtime composition", () => {
  it("consumes the shared uncapped summary without recomputing from Saved or Progress", async () => {
    const data = { summary: { ...emptyView.summary, reviewCount: 101, secondTryCount: 1, newCount: 201, estimatedMinutes: 606 }, recentVideos: [recentVideo, olderVideo].map(video => ({ ...video, practiceCount: 2, needsAnalysisCount: 1 })) };
    const home = vi.fn(async () => data);
    const read = vi.fn(async () => ({ week: { startsAt: NOW, endsAt: NOW }, weeklyAttemptCount: 8, dueCompletionCount: 2, independentReuseCount: 1, duePracticeCount: 1, masteryDistribution: { tried: 4, reused: 2, owned: 1 } }));
    const load = createHomeLoader({ authenticate: async () => ({ ok: true, userId: USER_ID }), today: { home }, progress: { read }, gateways: { listConfigs: async () => [{ state: "active", apiKey: "secret" }] } });
    const result = await load(new Request("https://popcorn.example/home"), NOW);
    expect(result).toEqual({ ok: true, view: { hasActiveGateway: true, summary: data.summary, recentVideos: data.recentVideos, masteryDistribution: { tried: 4, reused: 2, owned: 1 } } });
    expect(home).toHaveBeenCalledExactlyOnceWith(USER_ID, NOW);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  it("never reads private projections before authentication", async () => {
    const home = vi.fn(), read = vi.fn(), listConfigs = vi.fn();
    const load = createHomeLoader({ authenticate: async () => ({ ok: false, reason: "missing" }), today: { home }, progress: { read }, gateways: { listConfigs } });
    await expect(load(new Request("https://popcorn.example/home"), NOW)).resolves.toEqual({ ok: false, reason: "missing" });
    expect(home).not.toHaveBeenCalled(); expect(read).not.toHaveBeenCalled(); expect(listConfigs).not.toHaveBeenCalled();
  });
});
