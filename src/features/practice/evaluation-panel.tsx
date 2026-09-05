import type { EvaluationResult, PracticeCoaching } from "@/contracts/practice";
import styles from "@/features/practice/practice-workspace.module.css";

type Transition = { readonly from: string; readonly to: string };

function Dimension({
  name,
  dimension,
}: {
  readonly name: string;
  readonly dimension: EvaluationResult["accuracy"];
}) {
  return (
    <section className={styles.dimension}>
      <h3>{name} · {dimension.score}/5</h3>
      <p>{dimension.englishFeedback}</p>
    </section>
  );
}

function mostUsefulRevision(evaluation: EvaluationResult): string {
  const dimensions = [
    { name: "accuracy", ...evaluation.accuracy },
    { name: "naturalness", ...evaluation.naturalness },
    { name: "context fit", ...evaluation.contextualFit },
  ];
  const focus = dimensions.reduce((lowest, dimension) => (
    dimension.score < lowest.score ? dimension : lowest
  ));
  return `${focus.englishFeedback} Rewrite your sentence once, keeping what works and applying this ${focus.name} feedback.`;
}

function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function EvaluationPanel({
  evaluation,
  coaching,
  evidenceMessage,
  transition = null,
  nextDueAt = null,
  remainingCount = 0,
  onRevise,
  onContinue,
  onStop,
}: {
  readonly evaluation: EvaluationResult;
  readonly coaching: PracticeCoaching | null;
  readonly evidenceMessage: string;
  readonly transition?: Transition | null;
  readonly nextDueAt?: string | null;
  readonly remainingCount?: number;
  readonly onRevise?: () => void;
  readonly onContinue?: () => void;
  readonly onStop: () => void;
}) {
  return (
    <section className={styles.feedbackCard} aria-labelledby="practice-feedback-heading">
      <p className={styles.cardEyebrow}>Your feedback</p>
      <h2 id="practice-feedback-heading">Feedback</h2>
      <p className={styles.takeaway}>
        {evaluation.passed
          ? "Strong start — your meaning came through."
          : "Not there yet — one focused revision will make this clearer."}
      </p>

      <div className={styles.dimensions}>
        <Dimension name="Accuracy" dimension={evaluation.accuracy} />
        <Dimension name="Naturalness" dimension={evaluation.naturalness} />
        <Dimension name="Context fit" dimension={evaluation.contextualFit} />
      </div>

      <section className={styles.revision} aria-labelledby="revision-heading">
        <h3 id="revision-heading">Try next</h3>
        <p>{mostUsefulRevision(evaluation)}</p>
      </section>

      {coaching ? (
        <section aria-labelledby="natural-revision-heading">
          <h3 id="natural-revision-heading">Natural revision</h3>
          <p className={styles.naturalRevision} lang="zh-CN">{coaching.naturalRevisionChinese}</p>
        </section>
      ) : null}

      <section className={styles.recorded} aria-labelledby="recorded-heading">
        <h3 id="recorded-heading">Practice recorded</h3>
        <p>{evidenceMessage}</p>
        {transition ? <p>Mastery moved from {transition.from} to {transition.to}.</p> : null}
        {nextDueAt ? <p>Next due {formatDueDate(nextDueAt)}.</p> : null}
        {remainingCount > 0 ? <p>{remainingCount} left in this session</p> : null}
      </section>

      <div className={styles.buttonRow}>
        {onRevise ? <button className={styles.secondaryButton} type="button" onClick={onRevise}>Revise once</button> : null}
        {onContinue ? <button className={styles.primaryButton} type="button" onClick={onContinue}>Continue</button> : null}
        <button className={styles.secondaryButton} type="button" onClick={onStop}>Stop for now</button>
      </div>
    </section>
  );
}
