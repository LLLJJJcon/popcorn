import { render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { HomeDashboard } from "./home-dashboard";
import type { HomeView } from "./home-view";

const view: HomeView = {
  hasActiveGateway: true,
  summary: { reviewCount: 2, secondTryCount: 1, newCount: 3, estimatedMinutes: 12, needsAnalysisCount: 4, processingCount: 2, nextPracticeAt: "2026-09-06T01:00:00.000Z" },
  recentVideos: Array.from({ length: 3 }, (_, index) => ({ sourceId: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`, youtubeVideoId: `recentVid0${index}`, canonicalUrl: `https://www.youtube.com/watch?v=recentVid0${index}`, title: `Interview ${index}`, channel: "Everyday Chinese", thumbnailUrl: `https://i.ytimg.com/vi/recentVid0${index}/hqdefault.jpg`, savedCount: index + 1, latestSavedAt: "2026-09-04T18:00:00.000Z", processingState: "ready" as const, practiceCount: index === 0 ? 3 : 0, needsAnalysisCount: index === 1 ? 2 : 0 })),
  masteryDistribution: { tried: 4, reused: 2, owned: 1 },
};

describe("Home today's learning", () => {
  it("offers one primary session action, exact counters and preserved mastery", () => {
    const { container } = render(<HomeDashboard view={view} />);
    expect(screen.getByRole("link", { name: "Start today's practice" })).toHaveAttribute("href", "/practice/session");
    expect(screen.getByText("about 12 min")).toBeInTheDocument();
    expect(container.querySelectorAll('[class*="primaryAction"]')).toHaveLength(1);
    const groups = screen.getByRole("list", { name: "Today's practice" });
    for (const [label, count, href, description] of [
      ["Reviews", "2", "/practice#reviews", "Due for review — use a Vault expression again in a new situation."],
      ["Second tries", "1", "/practice#second-tries", "Not in your Vault yet — one more try with a fresh question."],
      ["New expressions", "3", "/practice#new-expressions", "Analyzed from your saves — practice it for the first time."],
    ]) {
      const link = within(groups).getByRole("link", { name: new RegExp(label) });
      expect(link).toHaveAttribute("href", href); expect(link).toHaveTextContent(count); expect(link).toHaveTextContent(description);
    }
    expect(screen.getByText("2 saves are still processing")).toBeInTheDocument();
    expect(screen.queryByText("Your learning workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("Most useful now")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Mastery snapshot" })).toHaveTextContent("Tried4Reused2Owned1");
    expect(screen.getByRole("link", { name: "View Progress" })).toHaveAttribute("class", expect.stringContaining("secondary"));
  });

  it("renders three compact recent videos with actionable counts and a bottom Saved button", () => {
    render(<HomeDashboard view={view} />);
    const recent = screen.getByRole("list", { name: "Recent Saved videos" });
    expect(within(recent).getAllByRole("listitem")).toHaveLength(3);
    expect(within(recent).getByRole("link", { name: "Interview 0" })).toHaveAttribute("href", "/saved/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0");
    expect(within(recent).getByText("3 ready to practice")).toBeInTheDocument();
    expect(within(recent).getByText("2 saves need analysis")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View all Saved videos" })).toHaveAttribute("href", "/saved");
  });

  it("keeps zero groups visible and gray while offering YouTube and a local future date", () => {
    render(<HomeDashboard view={{ ...view, summary: { ...view.summary, reviewCount: 0, secondTryCount: 0, newCount: 0, needsAnalysisCount: 0, processingCount: 0 }, recentVideos: [] }} />);
    expect(screen.getByRole("link", { name: "Watch something on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/");
    const groups = screen.getByRole("list", { name: "Today's practice" });
    expect(within(groups).getAllByRole("link")).toHaveLength(3);
    for (const item of within(groups).getAllByRole("listitem")) { expect(item).toHaveTextContent("0"); expect(item).toHaveAttribute("class", expect.stringContaining("emptyCount")); }
    expect(screen.getByText(/Next practice:/)).toBeInTheDocument();
  });

  it("offers qualified Analyze and omits an unavailable next date", () => {
    render(<HomeDashboard view={{ ...view, summary: { ...view.summary, reviewCount: 0, secondTryCount: 0, newCount: 0, needsAnalysisCount: 4, nextPracticeAt: null } }} />);
    expect(screen.getByRole("link", { name: "Analyze 4 saves" })).toHaveAttribute("href", "/saved?filter=needs-analysis");
    expect(screen.queryByText(/Next practice:/)).not.toBeInTheDocument();
  });

  it("defers date formatting until the browser is mounted instead of emitting server UTC dates", () => {
    const html = renderToString(<HomeDashboard view={{ ...view, summary: { ...view.summary, reviewCount: 0, secondTryCount: 0, newCount: 0, needsAnalysisCount: 0 } }} />);
    expect(html).not.toContain("Sep 6, 2026");
    expect(html).toContain('dateTime="2026-09-06T01:00:00.000Z"');
  });
});
