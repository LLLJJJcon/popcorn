import Link from "next/link";
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

const functionLabels: Record<string, string> = { emphasize: "Emphasize", complain: "Complain", praise: "Praise", react: "React", explain_sum_up: "Explain · Sum up", concede_contrast: "Concede · Contrast", suggest: "Suggest", connect_ideas: "Connect ideas", describe: "Describe", other: "Other" };
const settingLabels: Record<string, string> = { casual_chat: "Casual chat", daily_errands: "Daily errands", work_school: "Work & school", formal_writing: "Formal writing & speeches", online_social: "Online posts" };

function CandidatePracticeAction({candidate,disabled,activating,onUse}:{readonly candidate:CandidateExpression;readonly disabled:boolean;readonly activating:boolean;readonly onUse:()=>void}) {
  const state=candidate.practiceState;
  if(state?.status==="promoted" && state.removedFromVault) return <span className={styles.subtleMessage}>Removed from Vault</span>;
  if(state?.status==="promoted") return <Link className={styles.practiceAction} href={`/vault/${state.userExpressionId}`}>In your Vault</Link>;
  const label=state?.status==="practicing"?"Continue":state?.status==="removed"?"Practice":candidate.suitability==="not_expression"?"Practice anyway":"Practice this expression";
  return <>{state?.status==="practicing"?<span className={styles.subtleMessage}>Practicing · Not in Vault yet</span>:state?.status==="removed"?<span className={styles.subtleMessage}>Removed from practice</span>:null}<button className={styles.practiceAction} type="button" disabled={disabled} onClick={onUse}>{activating?"Opening practice…":label}</button></>;
}

export function CandidateExpressionCard({
  candidate,
  canonicalUrl,
  disabled,
  activating,
  onUse,
  deleteAction,
}: {
  readonly candidate: CandidateExpression;
  readonly canonicalUrl: string;
  readonly disabled: boolean;
  readonly activating: boolean;
  readonly onUse: () => void;
  readonly deleteAction?: React.ReactNode;
}) {
  if (candidate.meaningHere !== undefined) {
    return (
      <article className={`${styles.candidateCard} ${styles.learningCard}`}>
        <p className={styles.candidateEyebrow}>Your learning card</p>
        <div className={styles.learningCardHeading}>
          <h4 lang="zh-CN">{candidate.expression}</h4>
          <div className={styles.cardHeadingActions}><a className={styles.sourceTimestamp} href={youtubeTimeUrl(canonicalUrl, candidate.startSeconds)} aria-label={`Watch at ${timestamp(candidate.startSeconds)} on YouTube`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7z" /></svg>{timestamp(candidate.startSeconds)}
          </a>{deleteAction}</div>
        </div>
        <div className={styles.learningTags}>
          <div><span className={styles.tagLabel}>Used to:</span>{candidate.functionCategories?.map(category => <span className={styles.functionTag} key={category}>{functionLabels[category] ?? category}</span>)}</div>
          {candidate.usageSettings?.length ? <div><span className={styles.tagLabel}>Good for:</span>{candidate.usageSettings.map(setting => <span className={styles.settingTag} key={setting}>{settingLabels[setting] ?? setting}</span>)}</div> : null}
        </div>
        <dl className={styles.learningSections}>
          <div><dt>Meaning here</dt><dd>{candidate.meaningHere}</dd></div>
          <div><dt>Use it when</dt><dd>{candidate.useItWhen}</dd></div>
          <div className={styles.comparisonSection}><dt>Compared with</dt><dd>{candidate.comparedWith}</dd></div>
        </dl>
        <div className={styles.examplesSection}>
          <h5>Examples</h5>
          {candidate.examples ? <ol>{candidate.examples.map((example, index) => <li key={index}><p lang="zh-CN">{example.zh}</p><p lang="en">{example.en}</p></li>)}</ol> : <p className={styles.subtleMessage}>Examples unavailable</p>}
        </div>
        <details className={styles.cardMore}>
          <summary>More<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></summary>
          <dl className={styles.learningSections}>
            <div><dt>How it fits</dt><dd>{candidate.howItFits}</dd></div>
            <div><dt>Tone &amp; who</dt><dd>{candidate.toneAndWho}</dd></div>
            {candidate.watchOut ? <div><dt>Watch out</dt><dd>{candidate.watchOut}</dd></div> : null}
          </dl>
        </details>
        {candidate.suitability === "not_expression" ? <p className={styles.suitabilityNotice}>{candidate.notExpressionReasonEn}</p> : null}
        <div className={styles.learningCardFooter}>
          <CandidatePracticeAction candidate={candidate} disabled={disabled} activating={activating} onUse={onUse} />
        </div>
      </article>
    );
  }
  return (
    <article className={styles.candidateCard}>
      <p className={styles.candidateEyebrow}>Chinese expression to practice</p>
      <div className={styles.learningCardHeading}><h4 lang="zh-CN">{candidate.expression}</h4>{deleteAction}</div>
      <p className={styles.candidateMeaning}>{candidate.englishMeaning}</p>
      <p className={styles.candidateExplanation}>{candidate.englishExplanation}</p>
      <dl className={styles.candidateDetails}>
        <div><dt>Tone</dt><dd>{candidate.tone}</dd></div>
        <div><dt>Function</dt><dd>{candidate.communicativeFunction}</dd></div>
        <div><dt>Register</dt><dd>{candidate.register}</dd></div>
      </dl>
      <details className={styles.sourceDisclosure}>
        <summary>Source sentence</summary>
        <blockquote className={styles.candidateEvidence} lang="zh-CN">{candidate.evidenceText}</blockquote>
      </details>
      {candidate.confidence !== undefined && candidate.confidence < 0.7 ? <p className={styles.candidateNotice}>Needs your confirmation</p> : null}
      <div className={styles.candidateActions}>
        <a className={styles.watchAction} href={youtubeTimeUrl(canonicalUrl, candidate.startSeconds)}>
          Watch at {timestamp(candidate.startSeconds)} on YouTube
        </a>
        <CandidatePracticeAction candidate={candidate} disabled={disabled} activating={activating} onUse={onUse} />
      </div>
      <p className={styles.legacyNotice}>Analyzed with an older version</p>
    </article>
  );
}
