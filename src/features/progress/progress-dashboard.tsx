import type { ProgressSummary } from "@/features/progress/schema";

export function ProgressDashboard({ summary }: { readonly summary: ProgressSummary }) {
  const metrics = [
    ["Attempts this week", summary.weeklyAttemptCount],
    ["Due Practice completed", summary.dueCompletionCount],
    ["Independent reuse", summary.independentReuseCount],
    ["Practice due now", summary.duePracticeCount],
  ] as const;
  const mastery = [
    ["Tried", summary.masteryDistribution.tried],
    ["Reused", summary.masteryDistribution.reused],
    ["Owned", summary.masteryDistribution.owned],
  ] as const;

  return (
    <>
      <section aria-labelledby="weekly-evidence-heading">
        <h2 id="weekly-evidence-heading">This week</h2>
        <ul aria-label="Weekly learning evidence">
          {metrics.map(([label, value]) => <li key={label}><span>{label}</span> <strong>{value}</strong></li>)}
        </ul>
      </section>
      <section aria-labelledby="mastery-distribution-heading">
        <h2 id="mastery-distribution-heading">Current mastery</h2>
        <p>Your highest demonstrated evidence, separate from recent Practice performance.</p>
        <ul aria-label="Current mastery distribution">
          {mastery.map(([label, value]) => <li key={label}><span>{label}</span> <strong>{value}</strong></li>)}
        </ul>
      </section>
    </>
  );
}
