import { render, screen, within } from "@testing-library/react";

import { HomeDashboard } from "@/features/home/home-dashboard";
import type { HomeView } from "@/features/home/home-view";

const view: HomeView = {
  hasActiveGateway: false,
  duePracticeCount: 2,
  unsortedSaveCount: 3,
  recentVideo: {
    sourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    youtubeVideoId: "recentVid01",
    canonicalUrl: "https://www.youtube.com/watch?v=recentVid01",
    title: "The newest Mandarin interview",
    channel: "Everyday Chinese",
    thumbnailUrl: "https://i.ytimg.com/vi/recentVid01/hqdefault.jpg",
    savedCount: 3,
    latestSavedAt: "2026-09-04T18:00:00.000Z",
    processingState: "organizing",
  },
  masteryDistribution: { tried: 4, reused: 2, owned: 1 },
};

describe("Home dashboard", () => {
  it("keeps mastery and the deterministic recent Saved video visible behind one primary gateway action", () => {
    const { container } = render(<HomeDashboard view={view} />);

    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up model gateway" })).toHaveAttribute(
      "href",
      "/settings/model-gateway",
    );
    expect(container.querySelectorAll('[class*="primaryAction"]')).toHaveLength(1);

    const mastery = screen.getByRole("list", { name: "Mastery snapshot" });
    expect(within(mastery).getByText("Tried")).toBeInTheDocument();
    expect(within(mastery).getByText("4")).toBeInTheDocument();
    expect(within(mastery).getByText("Reused")).toBeInTheDocument();
    expect(within(mastery).getByText("2")).toBeInTheDocument();
    expect(within(mastery).getByText("Owned")).toBeInTheDocument();
    expect(within(mastery).getByText("1")).toBeInTheDocument();

    const recent = screen.getByRole("article", { name: "Most recently saved video" });
    expect(within(recent).getByRole("link", { name: "The newest Mandarin interview" })).toHaveAttribute(
      "href",
      "/saved/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
    expect(recent).toHaveTextContent("Everyday Chinese");
    expect(recent).toHaveTextContent("3 saved moments");
    expect(recent).toHaveTextContent("Organizing this save.");
    expect(screen.getByRole("link", { name: "View all Saved videos" })).toHaveAttribute("href", "/saved");
  });

  it("renders the YouTube fallback as the only primary action and a useful empty Saved state", () => {
    const { container } = render(<HomeDashboard view={{
      ...view,
      hasActiveGateway: true,
      duePracticeCount: 0,
      unsortedSaveCount: 0,
      recentVideo: null,
    }} />);

    expect(screen.getByRole("link", { name: "Continue watching on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/",
    );
    expect(container.querySelectorAll('[class*="primaryAction"]')).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Your next save starts on YouTube" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Saved" })).toHaveAttribute("href", "/saved");
  });
});
