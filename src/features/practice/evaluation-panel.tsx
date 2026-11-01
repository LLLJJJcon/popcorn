"use client";
import { useState, type ReactNode } from "react";
import type { EvaluationResult, PracticeCoaching } from "@/contracts/practice";
import { AnswerComparison } from "./answer-comparison";
import { DisclosureButton, formatPracticeDate } from "./practice-controls";
import styles from "./practice-workspace.module.css";
export const evaluationDimensions = (e: EvaluationResult) => [{ name: "Accuracy", result: e.accuracy }, { name: "Naturalness", result: e.naturalness }, { name: "Context fit", result: e.contextualFit }];
export function EvaluationPanel({ evaluation, coaching, evidenceMessage, resultLine, answerText, actions, transition = null, nextDueAt = null, remainingCount = 0, onRevise, reviseLabel = "Revise this answer", onContinue, onStop }: {
  readonly evaluation: EvaluationResult; readonly coaching: PracticeCoaching | null; readonly evidenceMessage?: string; readonly resultLine?: string; readonly answerText?: string; readonly actions?: ReactNode; readonly transition?: { readonly from: string; readonly to: string } | null; readonly nextDueAt?: string | null; readonly remainingCount?: number; readonly onRevise?: () => void; readonly reviseLabel?: string; readonly onContinue?: () => void; readonly onStop?: () => void;
}) {
  const [naturalOpen, setNaturalOpen] = useState(false);
  const dimensions = evaluationDimensions(evaluation), full = dimensions.every(d => d.result.score === 5);
  const focus = dimensions.reduce((a,b) => b.result.score < a.result.score ? b : a);
  return <section className={styles.feedbackCard} aria-label="Your feedback"><h2>Feedback</h2>
    <p className={styles.takeaway}>{resultLine ?? evidenceMessage}</p>
    <div className={styles.dimensions}>{dimensions.map(d => <section aria-label={`${d.name} score`} key={d.name} className={`${styles.dimension} ${d.result.score < 3 ? styles.dimensionNeedsWork : ""}`} data-outcome={d.result.score < 3 ? "needs-work" : "on-track"}><h3>{d.name} · {d.result.score}/5</h3><p>{d.result.englishFeedback}</p></section>)}</div>
    <section className={styles.revision}><h3>{full ? "Nothing to fix." : `Focus first: ${focus.name}`}</h3>{!full ? <p>{focus.result.englishFeedback}</p> : null}</section>
    {!full && coaching ? answerText !== undefined ? <section><DisclosureButton expanded={naturalOpen} onClick={() => setNaturalOpen(!naturalOpen)}>Show a natural version</DisclosureButton>{naturalOpen ? <AnswerComparison first={answerText} second={coaching.naturalRevisionChinese} /> : null}</section> : <section><h3>Natural revision</h3><p lang="zh-CN">{coaching.naturalRevisionChinese}</p></section> : null}
    {!resultLine ? <section className={styles.recorded}>{transition ? <p>Mastery moved from {transition.from} to {transition.to}.</p> : null}{nextDueAt ? <p>Next due {formatPracticeDate(nextDueAt)}.</p> : null}{remainingCount > 0 ? <p>{remainingCount} left in this session</p> : null}</section> : null}
    {actions !== undefined ? actions : <div className={styles.buttonRow}>{onContinue ? <button className={styles.primaryButton} type="button" onClick={onContinue}>Continue</button> : null}{onRevise && !full ? <button className={styles.secondaryButton} type="button" onClick={onRevise}>{reviseLabel}</button> : null}{onStop ? <button className={styles.secondaryButton} type="button" onClick={onStop}>Stop for now</button> : null}</div>}
  </section>;
}
