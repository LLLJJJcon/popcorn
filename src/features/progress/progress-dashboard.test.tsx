import { render, screen, within } from "@testing-library/react";

import { ProgressDashboard } from "@/features/progress/progress-dashboard";

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

describe("Progress dashboard", () => {
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
    expect(screen.getByRole("link", { name: "Practice 1 due expression" })).toHaveAttribute("href", "/practice");
    expect(screen.queryByText(/streak|points|saved total|leaderboard/i)).not.toBeInTheDocument();
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
    expect(screen.getByRole("progressbar", { name: "Tried expressions" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByText("Mastery records your highest evidence, even when a later attempt is weak.")).toBeInTheDocument();
  });

  test("links to Saved as a secondary next step when no Practice is due", () => {
    render(<ProgressDashboard summary={{ ...summary, duePracticeCount: 0 }} />);

    expect(screen.getByRole("link", { name: "Review Saved material" })).toHaveAttribute("href", "/saved");
    expect(screen.queryByRole("link", { name: /Practice .* due expression/ })).not.toBeInTheDocument();
  });
});
