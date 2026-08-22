import type { ExpressionCardView } from "@/server/repositories/review-task-repository";

export function ExpressionCard({ card }: { readonly card: ExpressionCardView }) {
  return (
    <article id={`expression-${card.userExpressionId}`}>
      <h2 lang="zh-CN">{card.expression}</h2>
      <p>{card.englishMeaning}</p>
      <p>{card.englishExplanation}</p>
      <dl>
        <dt>Mastery</dt><dd>{card.masteryState}</dd>
        <dt>Tone</dt><dd>{card.tone}</dd>
        <dt>Communicative function</dt><dd>{card.communicativeFunction}</dd>
        <dt>Register</dt><dd>{card.register}</dd>
      </dl>
      {card.sourceDeleted ? (
        <section aria-label="Original occurrence"><h3>Original occurrence</h3><p>Source deleted</p></section>
      ) : card.occurrence ? (
        <section>
          <h3>Original occurrence</h3>
          <blockquote lang="zh-CN">{card.occurrence.evidenceText}</blockquote>
          <p>{card.occurrence.startSeconds}s–{card.occurrence.endSeconds}s</p>
          <a href={card.occurrence.youtubeUrl}>Watch source on YouTube</a>
        </section>
      ) : null}
      <section>
        <h3>Attempt history</h3>
        {card.attempts.map((attempt) => (
          <article key={attempt.id}>
            <p lang="zh-CN">{attempt.responseChinese}</p>
            <p>{attempt.passed ? "Passed" : "Keep practicing"}</p>
            <p>Accuracy: {attempt.accuracyScore}/5 — {attempt.accuracyFeedbackEnglish}</p>
            <p>Naturalness: {attempt.naturalnessScore}/5 — {attempt.naturalnessFeedbackEnglish}</p>
            <p>Contextual fit: {attempt.contextualFitScore}/5 — {attempt.contextualFitFeedbackEnglish}</p>
          </article>
        ))}
      </section>
    </article>
  );
}
