import type { EvaluationResult, PracticeCoaching } from "@/contracts/practice";
import styles from "@/features/practice/practice-workspace.module.css";

type Transition = { readonly from: string; readonly to: string };
type DimensionView = {
  readonly name: "Accuracy" | "Naturalness" | "Context fit";
  readonly guidanceName: "accuracy" | "naturalness" | "context fit";
  readonly result: EvaluationResult["accuracy"];
};

function Dimension({
  name,
  dimension,
  needsWork,
}: {
  readonly name: string;
  readonly dimension: EvaluationResult["accuracy"];
  readonly needsWork: boolean;
}) {
  return (
    <section
      aria-label={`${name} score`}
      className={`${styles.dimension} ${needsWork ? styles.dimensionNeedsWork : ""}`}
      data-outcome={needsWork ? "needs-work" : "on-track"}
    >
      <h3>{name} · {dimension.score}/5</h3>
      <p>{dimension.englishFeedback}</p>
    </section>
  );
}

function evaluationDimensions(evaluation: EvaluationResult): readonly DimensionView[] {
  return [
    { name: "Accuracy", guidanceName: "accuracy", result: evaluation.accuracy },
    { name: "Naturalness", guidanceName: "naturalness", result: evaluation.naturalness },
    { name: "Context fit", guidanceName: "context fit", result: evaluation.contextualFit },
  ];
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
  reviseLabel = "Revise and check again",
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
  readonly reviseLabel?: string;
  readonly onContinue?: () => void;
  readonly onStop: () => void;
}) {
  const dimensions = evaluationDimensions(evaluation);
  const failedDimensions = dimensions.filter(({ result }) => result.score < 3);
  const focus = dimensions.reduce((lowest, dimension) => (
    dimension.result.score < lowest.result.score ? dimension : lowest
  ));
  const feedbackHeading = failedDimensions.length > 0
    ? `Keep practising - ${failedDimensions.length} ${failedDimensions.length === 1 ? "area needs" : "areas need"} work`
    : "Feedback";

  return (
    <section className={styles.feedbackCard} aria-labelledby="practice-feedback-heading">
      <p className={styles.cardEyebrow}>Your feedback</p>
      <h2 id="practice-feedback-heading">{feedbackHeading}</h2>
      <p className={styles.takeaway}>
        {evaluation.passed
          ? "Strong start — your meaning came through."
          : "Not there yet — one focused revision will make this clearer."}
      </p>

      <div className={styles.dimensions}>
        {dimensions.map((dimension) => (
          <Dimension
            key={dimension.name}
            name={dimension.name}
            dimension={dimension.result}
            needsWork={dimension.result.score < 3}
          />
        ))}
      </div>

      <section className={styles.revision} aria-labelledby="revision-heading">
        <h3 id="revision-heading">
          {failedDimensions.length > 0 ? `Focus first: ${focus.name}` : "Try next"}
        </h3>
        <p>
          {focus.result.englishFeedback} Rewrite your sentence once, keeping what works and applying this {focus.guidanceName} feedback.
        </p>
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
        {onRevise ? <button className={styles.secondaryButton} type="button" onClick={onRevise}>{reviseLabel}</button> : null}
        {onContinue ? <button className={styles.primaryButton} type="button" onClick={onContinue}>Continue</button> : null}
        <button className={styles.secondaryButton} type="button" onClick={onStop}>Stop for now</button>
      </div>
    </section>
  );
}
