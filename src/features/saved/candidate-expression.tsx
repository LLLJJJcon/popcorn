import type { CandidateExpression } from "@/contracts/knowledge";

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
  onUse,
}: {
  readonly candidate: CandidateExpression;
  readonly canonicalUrl: string;
  readonly disabled: boolean;
  readonly onUse: () => void;
}) {
  return (
    <article>
      <h3 lang="zh-CN">{candidate.expression}</h3>
      <p>{candidate.englishMeaning}</p>
      <p>{candidate.englishExplanation}</p>
      <dl>
        <dt>Tone</dt><dd>{candidate.tone}</dd>
        <dt>Communicative function</dt><dd>{candidate.communicativeFunction}</dd>
        <dt>Register</dt><dd>{candidate.register}</dd>
      </dl>
      <blockquote lang="zh-CN">{candidate.evidenceText}</blockquote>
      <p>
        <a href={youtubeTimeUrl(canonicalUrl, candidate.startSeconds)}>
          Watch at {timestamp(candidate.startSeconds)}
        </a>
      </p>
      {candidate.confidence < 0.7 ? <p>Needs your confirmation</p> : null}
      <button type="button" disabled={disabled} onClick={onUse}>Practice this expression</button>
    </article>
  );
}
