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
  test("shows four evidence summaries without collection-volume achievements", () => {
    render(<ProgressDashboard summary={summary} />);

    const metrics = screen.getByRole("list", { name: "Weekly learning evidence" });
    expect(within(metrics).getByText("Attempts this week")).toBeInTheDocument();
    expect(within(metrics).getByText("7")).toBeInTheDocument();
    expect(within(metrics).getByText("Due Practice completed")).toBeInTheDocument();
    expect(within(metrics).getByText("3")).toBeInTheDocument();
    expect(within(metrics).getByText("Independent reuse")).toBeInTheDocument();
    expect(within(metrics).getByText("2")).toBeInTheDocument();
    expect(within(metrics).getByText("Practice due now")).toBeInTheDocument();
    expect(within(metrics).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText(/saved items|streak|health score|leaderboard/i)).not.toBeInTheDocument();
  });

  test("shows only the three mastery states as the current highest evidence", () => {
    render(<ProgressDashboard summary={summary} />);

    const distribution = screen.getByRole("list", { name: "Current mastery distribution" });
    expect(within(distribution).getByText("Tried")).toBeInTheDocument();
    expect(within(distribution).getByText("4")).toBeInTheDocument();
    expect(within(distribution).getByText("Reused")).toBeInTheDocument();
    expect(within(distribution).getByText("2")).toBeInTheDocument();
    expect(within(distribution).getByText("Owned")).toBeInTheDocument();
    expect(within(distribution).getByText("1")).toBeInTheDocument();
  });
});
