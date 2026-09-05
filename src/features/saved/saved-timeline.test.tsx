import { render, screen, within } from "@testing-library/react";

import type { HomeView } from "@/features/home/home-view";
import { NextAction, selectNextAction } from "@/features/home/next-action";
import {
  groupSavedVideos,
  type SavedItemView,
} from "@/features/saved/api";
import { ProcessingState } from "@/features/saved/processing-state";
import { SavedTimeline } from "@/features/saved/saved-timeline";

const SOURCE_ID = "11111111-1111-4111-8111-111111111111";
const homeView: HomeView = {
  hasActiveGateway: true,
  duePracticeCount: 0,
  unsortedSaveCount: 0,
  recentVideo: null,
  masteryDistribution: { tried: 0, reused: 0, owned: 0 },
};

function item(overrides: Partial<SavedItemView> = {}): SavedItemView {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    kind: "subtitle_row",
    status: "ready",
    capturedAt: "2026-08-16T10:00:00.000Z",
    startSeconds: 42,
    rawText: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    ...overrides,
  };
}

describe("Saved video grouping and timeline", () => {
  it("groups seven saved moments from one video into one card", () => {
    const summaries = groupSavedVideos({
      sources: [{
        id: SOURCE_ID,
        youtubeVideoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }],
      snapshots: [{
        id: "33333333-3333-4333-8333-333333333333",
        sourceId: SOURCE_ID,
        title: "中文访谈",
        channel: "中文频道",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        capturedAt: "2026-08-16T09:00:00.000Z",
      }],
      items: Array.from({ length: 7 }, (_, index) => ({
        ...item({
          id: `22222222-2222-4222-8222-22222222222${index}`,
          startSeconds: index * 5,
          capturedAt: `2026-08-16T10:00:0${index}.000Z`,
        }),
        sourceId: SOURCE_ID,
      })),
      jobs: [],
    });

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ sourceId: SOURCE_ID, savedCount: 7, title: "中文访谈" });
  });

  it("orders by video timestamp, capture time, then stable id while preserving raw text in progressive states", () => {
    render(<SavedTimeline items={[
      item({ id: "c", startSeconds: 42, capturedAt: "2026-08-16T10:00:01.000Z", rawText: "第三条", status: "failed" }),
      item({ id: "b", startSeconds: 10, capturedAt: "2026-08-16T10:00:02.000Z", rawText: "第二条", status: "organizing" }),
      item({ id: "a", startSeconds: 10, capturedAt: "2026-08-16T10:00:01.000Z", rawText: "第一条", status: "organizing" }),
    ]} />);

    const entries = screen.getAllByRole("listitem");
    expect(entries.map((entry) => within(entry).getByTestId("raw-text").textContent)).toEqual([
      "第一条",
      "第二条",
      "第三条",
    ]);
    expect(entries[0]).toHaveTextContent("Organizing");
    expect(entries[2]).toHaveTextContent("Could not organize this save");
  });

  it("explains that unsupported videos require native Simplified Chinese subtitles", () => {
    render(<ProcessingState state="unsupported" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Popcorn needs native Simplified Chinese subtitles for this video",
    );
  });

  it("labels a ready saved moment as Saved without implying analysis readiness", () => {
    render(<SavedTimeline items={[item()]} />);

    const savedMoment = screen.getByRole("listitem");
    expect(within(savedMoment).getByRole("status")).toHaveTextContent(/^Saved$/);
    expect(within(savedMoment).queryByText("Ready to learn.")).not.toBeInTheDocument();
  });
});

describe("Home next action", () => {
  it("shows exactly one action and gives due Practice precedence over unsorted saves", () => {
    const action = selectNextAction({ ...homeView, duePracticeCount: 2, unsortedSaveCount: 7 });
    expect(action).toEqual({ kind: "practice", href: "/practice", count: 2 });

    render(<NextAction action={action} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Practice 2 due expressions/i })).toHaveAttribute(
      "href",
      "/practice",
    );
    expect(screen.queryByRole("link", { name: /Saved/i })).not.toBeInTheDocument();
  });

  it("enforces gateway setup before Saved and then falls back to YouTube", () => {
    expect(selectNextAction({
      ...homeView,
      hasActiveGateway: false,
      unsortedSaveCount: 1,
    })).toEqual({
      kind: "gateway",
      href: "/settings/model-gateway",
    });
    expect(selectNextAction({ ...homeView, unsortedSaveCount: 1 })).toEqual({
      kind: "saved",
      href: "/saved",
      count: 1,
    });
    expect(selectNextAction(homeView)).toEqual({
      kind: "youtube",
      href: "https://www.youtube.com/",
    });
  });
});
