import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { SavedVideoSummary } from "@/features/saved/api";
import { SavedLibrary } from "@/features/saved/saved-library";

function video(overrides: Partial<SavedVideoSummary> = {}): SavedVideoSummary {
  return {
    sourceId: "11111111-1111-4111-8111-111111111111",
    youtubeVideoId: "dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "A Mandarin interview",
    channel: "Everyday Chinese",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    savedCount: 3,
    latestSavedAt: "2026-08-21T23:30:00.000Z",
    processingState: "ready",
    ...overrides,
  };
}

describe("Saved library", () => {
  it("filters mixed processing states while keeping each video card scan-friendly", async () => {
    render(<SavedLibrary videos={[
      video(),
      video({
        sourceId: "22222222-2222-4222-8222-222222222222",
        youtubeVideoId: "abc123XYZ00",
        canonicalUrl: "https://www.youtube.com/watch?v=abc123XYZ00",
        title: "Still processing",
        channel: "Mandarin Lab",
        thumbnailUrl: "https://i.ytimg.com/vi/abc123XYZ00/hqdefault.jpg",
        savedCount: 1,
        processingState: "organizing",
      }),
    ]} />);

    expect(screen.getByRole("heading", { level: 1, name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ready to learn" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Processing" })).toBeInTheDocument();

    const readyCard = screen.getByRole("article", { name: "A Mandarin interview" });
    expect(within(readyCard).getByRole("img", { name: "A Mandarin interview thumbnail" })).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
    expect(within(readyCard).getByRole("link", { name: "A Mandarin interview" })).toHaveAttribute(
      "href",
      "/saved/11111111-1111-4111-8111-111111111111",
    );
    expect(readyCard).toHaveTextContent("Everyday Chinese");
    expect(readyCard).toHaveTextContent("3 saved moments");
    expect(readyCard).toHaveTextContent("Latest activity Aug 21, 2026");

    await userEvent.click(screen.getByRole("button", { name: "Processing" }));
    expect(screen.queryByRole("article", { name: "A Mandarin interview" })).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Still processing" })).toBeInTheDocument();
  });

  it("omits filter controls when every saved video has the same state", () => {
    render(<SavedLibrary videos={[video(), video({ sourceId: "source-2", title: "Another ready video" })]} />);

    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ready to learn" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Processing" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("explains that the extension is the only capture path when Saved is empty", () => {
    render(<SavedLibrary videos={[]} />);

    expect(screen.getByText(/Save a moment from the Popcorn extension while watching/i)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
