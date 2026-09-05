import Link from "next/link";

import type { ProgressSummary } from "@/features/progress/schema";
import styles from "./progress-dashboard.module.css";

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

  const masteryTotal = mastery.reduce((total, [, value]) => total + value, 0);

  return <div className={styles.dashboard}>
    <header className={styles.pageHeader}>
      <p className={styles.eyebrow}>Progress</p>
      <h1 id="progress-heading">Your Mandarin in use</h1>
      <p>Recent Practice and the strongest evidence you have built for each expression.</p>
      {summary.duePracticeCount > 0 ? (
        <Link className={styles.primaryAction} href="/practice">
          Practice {summary.duePracticeCount} due {summary.duePracticeCount === 1 ? "expression" : "expressions"}
        </Link>
      ) : (
        <p className={styles.secondaryAction}>
          Nothing is due right now. <Link href="/saved">Review Saved material</Link> when you are ready for another expression.
        </p>
      )}
    </header>

    <section className={styles.metricSection} aria-labelledby="weekly-evidence-heading">
      <h2 id="weekly-evidence-heading">This week</h2>
      <ul className={styles.metricGrid} aria-label="Weekly learning evidence">
        {metrics.map(([label, value]) => <li key={label} className={styles.metricCard}>
          <span>{label}</span>
          <strong>{value}</strong>
        </li>)}
      </ul>
    </section>

    <section className={styles.masterySection} aria-labelledby="mastery-distribution-heading">
      <div>
        <h2 id="mastery-distribution-heading">Current mastery</h2>
        <p>Mastery records your highest evidence, even when a later attempt is weak.</p>
      </div>
      <ul className={styles.masteryList} aria-label="Current mastery distribution">
        {mastery.map(([label, value]) => <li key={label} className={styles.masteryRow}>
          <div className={styles.masteryLabel}><span>{label}</span><strong>{value}</strong></div>
          <div
            aria-label={`${label} expressions`}
            aria-valuemax={Math.max(1, masteryTotal)}
            aria-valuemin={0}
            aria-valuenow={value}
            className={styles.masteryBar}
            role="progressbar"
          >
            <span style={{ width: `${masteryTotal === 0 ? 0 : (value / masteryTotal) * 100}%` }} />
          </div>
        </li>)}
      </ul>
    </section>
  </div>;
}
