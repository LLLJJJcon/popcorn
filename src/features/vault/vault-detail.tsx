import Link from "next/link";

import type {
  ExpressionCardView,
  ExpressionSuggestion,
} from "@/server/repositories/review-task-repository";
import styles from "@/features/vault/vault-workspace.module.css";

function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatAttemptDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function VaultDetail({
  card,
  suggestions,
}: {
  readonly card: ExpressionCardView;
  readonly suggestions: readonly ExpressionSuggestion[];
}) {
  return (
    <main className={styles.workspace}>
      <Link className={styles.backLink} href="/vault">← Back to Vault</Link>
      <header className={styles.detailHeader}>
        <div>
          <p className={styles.eyebrow}>Expression detail</p>
          <h1 lang="zh-CN">{card.expression}</h1>
          <p className={styles.detailMeaning}>{card.englishMeaning}</p>
          <p>{card.englishExplanation}</p>
        </div>
        <dl className={styles.detailMeta}>
          <div><dt>Mastery</dt><dd><span className={styles.mastery}>{card.masteryState}</span></dd></div>
          <div><dt>Tone</dt><dd>{card.tone}</dd></div>
          <div><dt>Communicative function</dt><dd>{card.communicativeFunction}</dd></div>
          <div><dt>Register</dt><dd>{card.register}</dd></div>
        </dl>
      </header>

      {card.sourceDeleted ? (
        <section className={styles.paperSection} aria-labelledby="source-heading">
          <h2 id="source-heading">Source</h2>
          <p>Source deleted</p>
          <p>The original source is no longer available, but your Practice attempts remain yours.</p>
        </section>
      ) : card.occurrence ? (
        <section className={styles.paperSection} aria-labelledby="source-heading">
          <p className={styles.eyebrow}>Original evidence</p>
          <h2 id="source-heading">{card.sourceTitle ?? "YouTube source"}</h2>
          <blockquote lang="zh-CN">{card.occurrence.evidenceText}</blockquote>
          <p className={styles.sourceTimestamp}>
            {formatSeconds(card.occurrence.startSeconds)}–{formatSeconds(card.occurrence.endSeconds)}
          </p>
          <a className={styles.textLink} href={card.occurrence.youtubeUrl}>Watch this moment on YouTube</a>
        </section>
      ) : null}

      <section className={styles.paperSection} aria-labelledby="attempts-heading">
        <h2 id="attempts-heading">Attempt history</h2>
        <p>Your attempts stay in the order you submitted them.</p>
        <ol className={styles.attemptList}>
          {card.attempts.map((attempt) => (
            <li key={attempt.id} className={styles.attemptCard}>
              <div className={styles.attemptHeader}>
                <time dateTime={attempt.submittedAt}>{formatAttemptDate(attempt.submittedAt)}</time>
                <span>{attempt.passed ? "Passed" : "Keep practising"}</span>
              </div>
              <p className={styles.attemptResponse} lang="zh-CN">{attempt.responseChinese}</p>
              <dl className={styles.feedbackGrid}>
                <div><dt>Accuracy {attempt.accuracyScore}/5</dt><dd>{attempt.accuracyFeedbackEnglish}</dd></div>
                <div><dt>Naturalness {attempt.naturalnessScore}/5</dt><dd>{attempt.naturalnessFeedbackEnglish}</dd></div>
                <div><dt>Contextual fit {attempt.contextualFitScore}/5</dt><dd>{attempt.contextualFitFeedbackEnglish}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      {suggestions.length > 0 ? (
        <section className={styles.paperSection} aria-labelledby="related-heading">
          <h2 id="related-heading">Related expressions</h2>
          <ul className={styles.relatedList}>
            {suggestions.map((suggestion) => (
              <li key={suggestion.userExpressionId}>
                <Link className={styles.textLink} href={`/vault/${suggestion.userExpressionId}`}>
                  <span lang="zh-CN">{suggestion.expression}</span> — {suggestion.englishMeaning}
                </Link>
                <span className={styles.matchLabel}>{suggestion.match}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
