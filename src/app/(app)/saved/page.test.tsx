import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({
  authenticate: vi.fn(), list: vi.fn(), needsAnalysisVideos: vi.fn(),
  createSavedRuntime: vi.fn(), createTodayPracticeRuntime: vi.fn(),
}));
vi.mock("@/features/saved/api", () => ({ createSavedRuntime: h.createSavedRuntime }));
vi.mock("@/server/today-practice-runtime", () => ({ createTodayPracticeRuntime: h.createTodayPracticeRuntime }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import SavedPage from "./page";

const video = {
  sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", youtubeVideoId: "recentVid01",
  canonicalUrl: "https://www.youtube.com/watch?v=recentVid01", title: "A qualified video", channel: "Chinese",
  thumbnailUrl: "https://i.ytimg.com/vi/recentVid01/hqdefault.jpg", savedCount: 1,
  latestSavedAt: "2026-11-01T00:00:00.000Z", processingState: "ready" as const,
  practiceCount: 0, needsAnalysisCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.authenticate.mockResolvedValue({ ok: true, userId: "owner-id" });
  h.list.mockResolvedValue([{ ...video, title: "Full library video" }]);
  h.needsAnalysisVideos.mockResolvedValue([video]);
  h.createSavedRuntime.mockResolvedValue({ appUrl: "https://popcorn.example", authenticate: h.authenticate, service: { list: h.list } });
  h.createTodayPracticeRuntime.mockResolvedValue({ appUrl: "https://popcorn.example", authenticate: h.authenticate, service: { needsAnalysisVideos: h.needsAnalysisVideos } });
});

describe("Saved URL filter", () => {
  it("awaits searchParams and consumes the full server-qualified needs-analysis list", async () => {
    render(await SavedPage({ searchParams: Promise.resolve({ filter: "needs-analysis" }) }));
    expect(screen.getByRole("article", { name: "A qualified video" })).toBeInTheDocument();
    expect(screen.getByText("Needs analysis")).toBeInTheDocument();
    expect(h.needsAnalysisVideos).toHaveBeenCalledExactlyOnceWith("owner-id", expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/));
    expect(h.list).not.toHaveBeenCalled();
  });

  it.each([undefined, "unknown", ["needs-analysis", "unknown"]])("uses the unchanged full library for an unsupported filter %j", async (filter) => {
    render(await SavedPage({ searchParams: Promise.resolve({ filter }) }));
    expect(screen.getByRole("article", { name: "Full library video" })).toBeInTheDocument();
    expect(h.needsAnalysisVideos).not.toHaveBeenCalled();
  });

  it("authenticates before either filtered or full library reads", async () => {
    h.authenticate.mockResolvedValue({ ok: false, reason: "expired" });
    await expect(SavedPage({ searchParams: Promise.resolve({ filter: "needs-analysis" }) })).rejects.toThrow("redirect:/sign-in");
    expect(h.needsAnalysisVideos).not.toHaveBeenCalled();
    expect(h.list).not.toHaveBeenCalled();
  });

  it("restores the complete All library after returning from the URL filter", async () => {
    h.list.mockResolvedValue([video, { ...video, sourceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Processing video", processingState: "organizing" }]);
    const { rerender } = render(await SavedPage({ searchParams: Promise.resolve({}) }));
    await userEvent.click(screen.getByRole("button", { name: "Processing" }));
    rerender(await SavedPage({ searchParams: Promise.resolve({ filter: "needs-analysis" }) }));
    expect(screen.getByRole("article", { name: "A qualified video" })).toBeInTheDocument();
    rerender(await SavedPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });
});
