import { readFileSync } from "node:fs";

import { render, screen, within } from "@testing-library/react";

import { ProgressDashboard } from "@/features/progress/progress-dashboard";

const globalCss = readFileSync("src/app/globals.css", "utf8");
const dashboardCss = readFileSync("src/features/progress/progress-dashboard.module.css", "utf8");

const summary = {
  week: {
    startsAt: "2026-08-17T00:00:00.000Z",
    endsAt: "2026-08-24T00:00:00.000Z",
  },
  weeklyAttemptCount: 7,
  dueCompletionCount: 3,
  independentReuseCount: 2,
  duePracticeCount: 1,
  masteryDistribution: { tried: 4, reused: 2, owned: 1 },
} as const;

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => hex.match(/[a-f\d]{2}/gi)!.map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }).reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

function paletteValue(name: string): string {
  return new RegExp(`${name}:\\s*(#[a-f\\d]{6})`, "i").exec(globalCss)?.[1] ?? "";
}

function ruleColor(className: string, property: "background" | "color"): string {
  const value = Array.from(dashboardCss.matchAll(new RegExp(`\\.${className}[^\\{]*\\{([^}]*)}`, "gs")))
    .map((match) => new RegExp(`${property}:\\s*var\\((--[a-z-]+)\\)`).exec(match[1])?.[1])
    .find((candidate) => candidate !== undefined) ?? "";
  return paletteValue(value);
}

describe("Progress dashboard", () => {
  test("uses 4.5:1-or-better palette pairings for normal CTA and eyebrow text", () => {
    expect(contrastRatio(ruleColor("primaryAction", "color"), ruleColor("primaryAction", "background"))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(ruleColor("eyebrow", "color"), paletteValue("--cream"))).toBeGreaterThanOrEqual(4.5);
  });

  test("presents four compact evidence summaries and a due Practice action", () => {
    render(<ProgressDashboard summary={summary} />);

    expect(screen.getByRole("heading", { name: "Your Mandarin in use" })).toBeVisible();
    const metrics = screen.getByRole("list", { name: "Weekly learning evidence" });
    expect(within(metrics).getByText("Attempts this week")).toBeInTheDocument();
    expect(within(metrics).getByText("7")).toBeInTheDocument();
    expect(within(metrics).getByText("Due Practice completed")).toBeInTheDocument();
    expect(within(metrics).getByText("3")).toBeInTheDocument();
    expect(within(metrics).getByText("Independent reuse")).toBeInTheDocument();
    expect(within(metrics).getByText("2")).toBeInTheDocument();
    expect(within(metrics).getByText("Practice due now")).toBeInTheDocument();
    expect(within(metrics).getByText("1")).toBeInTheDocument();
    expect(within(metrics).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Practice 1 due expression" })).toHaveAttribute("href", "/practice");
    expect(screen.queryByText(/streak|points|saved total|saved items|collection total|health score|leaderboard|percentage|trend/i)).not.toBeInTheDocument();
  });

  test("shows three labeled mastery bars as current highest evidence", () => {
    render(<ProgressDashboard summary={summary} />);

    const distribution = screen.getByRole("list", { name: "Current mastery distribution" });
    expect(within(distribution).getByText("Tried")).toBeInTheDocument();
    expect(within(distribution).getByText("4")).toBeInTheDocument();
    expect(within(distribution).getByText("Reused")).toBeInTheDocument();
    expect(within(distribution).getByText("2")).toBeInTheDocument();
    expect(within(distribution).getByText("Owned")).toBeInTheDocument();
    expect(within(distribution).getByText("1")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(3);
    ([
      ["Tried", 4],
      ["Reused", 2],
      ["Owned", 1],
    ] as const).forEach(([label, value]) => {
      const bar = screen.getByRole("progressbar", { name: `${label} expressions` });
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "7");
      expect(bar).toHaveAttribute("aria-valuenow", String(value));
    });
    expect(screen.getByText("Mastery records your highest evidence, even when a later attempt is weak.")).toBeInTheDocument();
  });

  test("links to Saved as a secondary next step when no Practice is due", () => {
    render(<ProgressDashboard summary={{ ...summary, duePracticeCount: 0 }} />);

    expect(screen.getByRole("link", { name: "Review Saved material" })).toHaveAttribute("href", "/saved");
    expect(screen.queryByRole("link", { name: /Practice .* due expression/ })).not.toBeInTheDocument();
  });
});
