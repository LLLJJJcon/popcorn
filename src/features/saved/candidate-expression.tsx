import type { CandidateExpression } from "@/contracts/knowledge";
import styles from "./saved-workspace.module.css";

function timestamp(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(whole / 3_600);
  const minutes = Math.floor((whole % 3_600) / 60);
  const remainder = whole % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function youtubeTimeUrl(canonicalUrl: string, seconds: number) {
  const url = new URL(canonicalUrl);
  url.searchParams.set("t", `${Math.max(0, Math.floor(seconds))}s`);
  return url.toString();
}

export function CandidateExpressionCard({
  candidate,
  canonicalUrl,
  disabled,
  activating,
  onUse,
}: {
  readonly candidate: CandidateExpression;
  readonly canonicalUrl: string;
  readonly disabled: boolean;
  readonly activating: boolean;
  readonly onUse: () => void;
}) {
  return (
    <article className={styles.candidateCard}>
      <p className={styles.candidateEyebrow}>Chinese expression to practice</p>
      <h4 lang="zh-CN">{candidate.expression}</h4>
      <p className={styles.candidateMeaning}>{candidate.englishMeaning}</p>
      <p className={styles.candidateExplanation}>{candidate.englishExplanation}</p>
      <dl className={styles.candidateDetails}>
        <div><dt>Tone</dt><dd>{candidate.tone}</dd></div>
        <div><dt>Function</dt><dd>{candidate.communicativeFunction}</dd></div>
        <div><dt>Register</dt><dd>{candidate.register}</dd></div>
      </dl>
      <blockquote className={styles.candidateEvidence} lang="zh-CN">{candidate.evidenceText}</blockquote>
      {candidate.confidence < 0.7 ? <p className={styles.candidateNotice}>Needs your confirmation</p> : null}
      <div className={styles.candidateActions}>
        <a className={styles.watchAction} href={youtubeTimeUrl(canonicalUrl, candidate.startSeconds)}>
          Watch at {timestamp(candidate.startSeconds)} on YouTube
        </a>
        <button className={styles.practiceAction} type="button" disabled={disabled} onClick={onUse}>
          {activating ? "Opening practice…" : "Practice this expression"}
        </button>
      </div>
    </article>
  );
}
