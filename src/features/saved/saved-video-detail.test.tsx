import { Children, isValidElement, type ElementType, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";

import type { SavedVideoDetail } from "@/features/saved/api";
import { SavedVideoDetailView } from "@/features/saved/saved-video-detail";
import { SavedTimeline } from "@/features/saved/saved-timeline";
import type { DeletionImpact } from "@/server/domain/plan-source-deletion";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const deletionImpact: DeletionImpact = {
  videoSourceId: "11111111-1111-4111-8111-111111111111",
  videoTitle: "中文访谈",
  savedCount: 1,
  affectedExpressionCount: 0,
  mode: "remove_unpracticed_source",
};

function detail(overrides: Partial<SavedVideoDetail> = {}): SavedVideoDetail {
  return {
    sourceId: deletionImpact.videoSourceId,
    youtubeVideoId: "dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    savedCount: 1,
    latestSavedAt: "2026-08-21T00:00:00.000Z",
    processingState: "failed",
    processingErrors: ["Popcorn could not organize this save. Your original saved text is still available."],
    items: [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "subtitle_row",
      status: "failed",
      capturedAt: "2026-08-21T00:00:00.000Z",
      startSeconds: 62,
      rawText: "这个想法挺有意思的",
      englishTranslation: "This idea is pretty interesting.",
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
    }],
    artifacts: [],
    ...overrides,
  };
}

function findElement(root: ReactNode, type: ElementType): ReactElement {
  if (!isValidElement(root)) throw new Error("expected a React element");
  if (root.type === type) return root;
  const children = Children.toArray((root.props as { readonly children?: ReactNode }).children);
  for (const child of children) {
    if (!isValidElement(child)) continue;
    try {
      return findElement(child, type);
    } catch {
      // Continue searching sibling elements.
    }
  }
  throw new Error("element not found");
}

describe("Saved video learning bridge", () => {
  it("keeps original evidence and stored English visible beside a terminal failure", () => {
    render(<SavedVideoDetailView video={detail()} deletionImpact={deletionImpact} />);

    expect(screen.getByRole("link", { name: "Watch on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(screen.getByTestId("raw-text")).toHaveTextContent("这个想法挺有意思的");
    expect(screen.getByText("This idea is pretty interesting.")).toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Analyze" })).toHaveLength(1);
  });

  it.each([
    "youtube-overview-v4-simple",
    "youtube-overview-v5-structured",
  ])("renders a readable %s overview after raw moments without reconstructing source data", (promptVersion) => {
    const { container } = render(<SavedVideoDetailView
      video={detail({
        processingState: "ready",
        processingErrors: [],
        artifacts: [{
          artifactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          savedItemId: null,
          type: "overview",
          promptVersion,
          content: {
            overview: "A conversation about measured reactions.",
            chapters: [{
              title: "Opening reactions",
              summary: "The speakers compare first impressions.",
              timestampSeconds: 12,
              sourceSegmentIds: ["a".repeat(64)],
            }],
            keyQuotes: Array.from({ length: 3 }, (_, index) => ({
              quote: `原文${index}`,
              englishMeaning: `Meaning ${index}`,
              timestampSeconds: index,
              sourceSegmentIds: [String(index + 1).repeat(64)],
            })),
          },
        }],
      })}
      deletionImpact={deletionImpact}
    />);

    expect(screen.getByRole("heading", { name: "Video overview" })).toBeInTheDocument();
    expect(screen.getByText("A conversation about measured reactions.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Opening reactions" })).toBeInTheDocument();
    const raw = screen.getByTestId("raw-text");
    const overview = screen.getByRole("heading", { name: "Video overview" });
    expect(raw.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(container.textContent).not.toMatch(/transcript/i);
  });

  it("does not render an unknown overview artifact version", () => {
    render(<SavedVideoDetailView
      video={detail({
        processingState: "ready",
        processingErrors: [],
        artifacts: [{
          artifactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          savedItemId: null,
          type: "overview",
          promptVersion: "youtube-overview-v999",
          content: {
            overview: "This must remain unavailable.",
            chapters: [],
            keyQuotes: [],
          },
        }],
      })}
      deletionImpact={deletionImpact}
    />);

    expect(screen.queryByRole("heading", { name: "Video overview" })).not.toBeInTheDocument();
    expect(screen.queryByText("This must remain unavailable.")).not.toBeInTheDocument();
  });

  it("falls back to the newest readable schema-valid overview when newer artifacts are unusable", () => {
    render(<SavedVideoDetailView
      video={detail({
        processingState: "ready",
        processingErrors: [],
        artifacts: [
          {
            artifactId: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            savedItemId: null,
            type: "overview",
            promptVersion: "youtube-overview-v5-structured",
            content: {
              overview: "The readable overview remains available.",
              chapters: [],
              keyQuotes: [],
            },
          },
          {
            artifactId: "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            savedItemId: null,
            type: "overview",
            promptVersion: "youtube-overview-v999",
            content: {
              overview: "The unknown overview must not render.",
              chapters: [],
              keyQuotes: [],
            },
          },
          {
            artifactId: "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            savedItemId: null,
            type: "overview",
            promptVersion: "youtube-overview-v5-structured",
            content: { overview: "损坏的 overview", chapters: [], keyQuotes: [] },
          },
        ],
      })}
      deletionImpact={deletionImpact}
    />);

    expect(screen.getByText("The readable overview remains available.")).toBeInTheDocument();
    expect(screen.queryByText("The unknown overview must not render.")).not.toBeInTheDocument();
    expect(screen.queryByText("损坏的 overview")).not.toBeInTheDocument();
  });

  it("does not pass malformed immutable artifact content across the client boundary", () => {
    const video = detail({
      artifacts: [{
        artifactId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        savedItemId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        type: "saved_item_analysis",
        promptVersion: "analyze-saved-item-v1",
        content: {
          candidates: [{ expression: "不完整" }],
          providerBody: "sensitive-provider-body-must-stay-on-server",
        },
      }],
    });

    const tree = SavedVideoDetailView({ video, deletionImpact });
    const timeline = findElement(tree, SavedTimeline);
    const renderAfter = (timeline.props as {
      readonly renderAfter: (item: SavedVideoDetail["items"][number]) => ReactElement;
    }).renderAfter;
    const candidateBoundary = renderAfter(video.items[0]!);

    expect(candidateBoundary.props).toMatchObject({ analysis: { state: "unavailable" } });
    expect(JSON.stringify(candidateBoundary.props)).not.toContain("sensitive-provider-body-must-stay-on-server");
  });
});
