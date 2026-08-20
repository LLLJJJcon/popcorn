import type { EvaluationResult } from "@/contracts/practice";

function Dimension({
  name,
  dimension,
}: {
  readonly name: string;
  readonly dimension: EvaluationResult["accuracy"];
}) {
  return (
    <section>
      <h3>{name}: {dimension.score}/5</h3>
      <p>{dimension.englishFeedback}</p>
    </section>
  );
}

export function EvaluationPanel({ evaluation }: { readonly evaluation: EvaluationResult }) {
  return (
    <section aria-labelledby="practice-feedback-heading">
      <h2 id="practice-feedback-heading">Feedback</h2>
      <p>{evaluation.passed ? "This response passed." : "Keep revising this response."}</p>
      <Dimension name="Accuracy" dimension={evaluation.accuracy} />
      <Dimension name="Naturalness" dimension={evaluation.naturalness} />
      <Dimension name="Contextual fit" dimension={evaluation.contextualFit} />
    </section>
  );
}
