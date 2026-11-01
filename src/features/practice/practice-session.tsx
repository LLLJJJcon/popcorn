"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PracticeAttemptResponse, PracticeRoundState } from "@/contracts/practice";
import { openPracticeExamples, PracticeRequestError, removePractice, restorePractice, startPracticeRound, submitAttemptRevision, submitOriginalAttempt } from "./api";
import { EvaluationPanel, evaluationDimensions } from "./evaluation-panel";
import { AnswerComparison } from "./answer-comparison";
import { DisclosureButton, formatPracticeDate } from "./practice-controls";
import type { PracticeMaterialView } from "./material-schema";
import { PracticeMaterial } from "./practice-material";
import { practiceTaskHref, resolvePracticeReturnTarget } from "./return-target";
import styles from "./practice-workspace.module.css";
export type PracticeRemoval = { taskId: string; undoUntil: string; roundState: PracticeRoundState };
const emptyRound: PracticeRoundState = { roundNumber: 1, status: "open", firstAnswer: null, latestRevision: null, examplesOpened: false, promotion: null, retryDueAt: null };
export function PracticeSession({ material, savedReturnTarget, mode = "standalone", onNext, nextLabel = "Next", onCompleted, onRemoved, onRoundCreated, onPromotedElsewhere }: {
  readonly material: PracticeMaterialView; readonly savedReturnTarget: string | null; readonly mode?: "standalone" | "session"; readonly onNext?: () => void; readonly nextLabel?: "Next" | "Finish"; readonly onCompleted?: (state: PracticeRoundState) => void; readonly onRemoved?: (receipt: PracticeRemoval) => void; readonly onRoundCreated?: (taskId: string) => void; readonly onPromotedElsewhere?: () => void;
}) {
  const Container = mode === "session" ? "section" : "main";
  const router = useRouter(), target = resolvePracticeReturnTarget(savedReturnTarget);
  const [round, setRound] = useState(material.roundState ?? emptyRound);
  const [text, setText] = useState((material.roundState?.latestRevision ?? material.roundState?.firstAnswer)?.text ?? "");
  const [editing, setEditing] = useState(!material.roundState?.firstAnswer);
  const [hydrated, setHydrated] = useState(false), [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false), [examplesPending, setExamplesPending] = useState(false), [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [firstOpen, setFirstOpen] = useState(false);
  const [undoUntil, setUndoUntil] = useState<string | null>(null);
  const inFlight = useRef(false), nextRequestId = useRef<string | null>(null), slowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = useRef<HTMLFormElement>(null), inputTouched = useRef(false), retryAction = useRef<() => void>(() => {});
  const emittedAnswer = useRef<string | null>(null), mounted = useRef(true);
  function emitCompleted(state: PracticeRoundState) { const id = state.firstAnswer?.attemptId; if (id && emittedAnswer.current !== id) { emittedAnswer.current = id; onCompleted?.(state); } }
  const draftKey = `popcorn:answer:${material.task.id}`;
  const latest = round.latestRevision ?? round.firstAnswer;
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      try { const value = localStorage.getItem(draftKey); if (value && !inputTouched.current) { setText(value); setRestored(true); setEditing(true); } } catch { /* Storage is optional. */ }
      setHydrated(true);
    });
    return () => { active = false; };
  }, [draftKey]);
  useEffect(() => {
    if (!hydrated || !editing) return;
    const timer = setTimeout(() => { try { if (text) localStorage.setItem(draftKey, text); else localStorage.removeItem(draftKey); } catch { /* Keep the answer in memory. */ } }, 500);
    return () => clearTimeout(timer);
  }, [draftKey, editing, hydrated, text]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (slowTimer.current) clearTimeout(slowTimer.current); }; }, []);
  useEffect(() => {
    if (!undoUntil) return;
    const timer = setTimeout(() => { setUndoUntil(null); router.push(target.href); }, Math.max(0, Date.parse(undoUntil) - Date.now()));
    return () => clearTimeout(timer);
  }, [undoUntil, mode, onRemoved, router, target.href]);
  function applyResult(result: PracticeAttemptResponse): PracticeRoundState {
    const a = { attemptId: result.attempt.id, revision: round.firstAnswer ? (round.latestRevision?.revision ?? 1) + 1 : 1, text: result.attempt.responseChinese, evaluation: result.attempt.evaluation, naturalVersion: result.coaching?.naturalRevisionChinese ?? null };
    const state = result.roundState ?? { ...round, firstAnswer: round.firstAnswer ?? a, latestRevision: round.firstAnswer ? a : null, status: "retry_scheduled" as const };
    setRound(state); setText((state.latestRevision ?? state.firstAnswer)?.text ?? text); setEditing(false); setRestored(false);
    try { localStorage.removeItem(draftKey); } catch { /* Storage is optional. */ }
    return state;
  }
  function handleError(caught: unknown, fallback = "provider") {
    if (!mounted.current) return;
    if (caught instanceof PracticeRequestError && caught.roundState) { setRound(caught.roundState); setText((caught.roundState.latestRevision ?? caught.roundState.firstAnswer)?.text ?? ""); setEditing(false); setNotice("You already answered this round. Here's your feedback."); emitCompleted(caught.roundState); try { localStorage.removeItem(draftKey); } catch {} return; }
    if (caught instanceof PracticeRequestError && caught.userExpressionId) { if (mode === "session") onPromotedElsewhere?.(); else router.push(`/vault/${caught.userExpressionId}`); return; }
    setError(caught instanceof PracticeRequestError && caught.code === "MODEL_GATEWAY_CONFIGURATION_REQUIRED" ? "gateway" : fallback);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (inFlight.current || examplesPending) return;
    retryAction.current = () => formRef.current?.requestSubmit();
    if (!/\p{Script=Han}/u.test(text)) { setError("chinese"); return; }
    inFlight.current = true; setBusy(true); setSlow(false); setError(null); setNotice(null);
    slowTimer.current = setTimeout(() => setSlow(true), 8_000);
    const isRevision = Boolean(round.firstAnswer);
    try { const result = isRevision ? await submitAttemptRevision(round.firstAnswer!.attemptId, text) : await submitOriginalAttempt(material.task.id, text); if (!mounted.current) return; const state = applyResult(result); if (!isRevision) emitCompleted(state); }
    catch (caught) { handleError(caught); }
    finally { if (slowTimer.current) clearTimeout(slowTimer.current); setSlow(false); setBusy(false); inFlight.current = false; }
  }
  async function newRound() {
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(null); setSlow(false);
    slowTimer.current = setTimeout(() => setSlow(true), 8_000);
    retryAction.current = () => void newRound();
    nextRequestId.current ??= crypto.randomUUID();
    try { const result = await startPracticeRound(material.task.id, nextRequestId.current); if (!mounted.current) return; if (onRoundCreated) onRoundCreated(result.taskId); else router.push(practiceTaskHref(result.taskId, target.href)); }
    catch (caught) { handleError(caught, "preparation"); } finally { if (slowTimer.current) clearTimeout(slowTimer.current); setSlow(false); inFlight.current = false; setBusy(false); }
  }
  async function remove() {
    retryAction.current = () => void remove();
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(null);
    try { const result = await removePractice(material.task.id); if (!mounted.current) return; setRound(result.roundState); if (mode === "session" && onRemoved) onRemoved({taskId: material.task.id, undoUntil: result.undoUntil, roundState: result.roundState}); else setUndoUntil(result.undoUntil); }
    catch (caught) { handleError(caught); } finally { inFlight.current = false; setBusy(false); }
  }
  async function undo() {
    retryAction.current = () => void undo();
    if (inFlight.current) return; inFlight.current = true; setBusy(true); setError(null);
    try { const result = await restorePractice(material.task.id); if (!mounted.current) return; setRound(result.roundState); setUndoUntil(null); }
    catch (caught) { handleError(caught); } finally { inFlight.current = false; setBusy(false); }
  }
  function revise() { setEditing(true); setText(latest?.text ?? ""); setError(null); }
  let line = "";
  if (latest) {
    if (round.promotion) line = `Added to your Vault · Tried · Next practice ${hydrated ? formatPracticeDate(round.promotion.nextDueAt) : ""}`;
    else if (round.latestRevision?.evaluation.passed) line = "Nice fix. To add it to your Vault, try once more in a new situation without examples.";
    else if (latest.evaluation.passed && latest.evaluation.assistanceLevel !== "none") line = "You got it with an example. Now try a new situation on your own.";
    else { const focus = evaluationDimensions(latest.evaluation).reduce((a,b) => b.result.score < a.result.score ? b : a); line = `Not in your Vault yet — ${focus.name} needs work.`; }
  }
  const full = latest && evaluationDimensions(latest.evaluation).every(d => d.result.score === 5);
  const actions = <div className={styles.buttonRow}>
    {mode === "session" && onNext ? <button type="button" className={styles.primaryButton} disabled={busy || examplesPending} onClick={onNext}>{nextLabel}</button> : round.promotion?.removedFromVault ? <span className={styles.subtleMessage}>Removed from Vault</span> : round.promotion ? <Link className={styles.primaryButton} href={`/vault/${round.promotion.userExpressionId}`}>Open in Vault</Link> : <button type="button" className={styles.primaryButton} disabled={busy} onClick={() => void newRound()}>Try a new situation</button>}
    {round.promotion ? mode === "session" ? null : <Link href={target.href} className={styles.secondaryButton}>Back to {target.label}</Link> : <>{mode === "session" ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void newRound()}>Try a new situation</button> : null}{!full && !round.latestRevision?.evaluation.passed ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={revise}>Revise this answer</button> : null}<button type="button" className={styles.tertiaryButton} disabled={busy} onClick={() => void remove()}><span aria-hidden="true">−</span>Remove from practice</button></>}
  </div>;
  return <Container><PracticeMaterial headingLevel={mode === "session" ? 2 : 1} material={{ ...material, roundState: round }} navigation={mode === "session" ? null : <p className={styles.savedReturnLink}><Link href={target.href}>← Back to {target.label}</Link></p>} examplesOpened={round.examplesOpened} onExamplesPendingChange={setExamplesPending} onExamplesOpen={async () => { await openPracticeExamples(material.task.id); setRound(current => ({ ...current, examplesOpened: true })); }}>
    {notice ? <p role="status">{notice}</p> : null}
    {round.status === "removed" ? <section><p>Removed from practice.</p>{undoUntil ? <button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => void undo()}>Undo</button> : <Link href={target.href} className={styles.secondaryButton}>Back to {target.label}</Link>}</section> : <>
      {editing ? <>{round.firstAnswer ? <section className={styles.firstAnswer}><h3>Your first answer</h3><p lang="zh-CN">{round.firstAnswer.text}</p><p>{evaluationDimensions(round.firstAnswer.evaluation).map(d => `${d.name} ${d.result.score}/5`).join(" · ")}</p></section> : null}<form ref={formRef} className={styles.responseForm} onSubmit={submit}>
        <label htmlFor="practice-response">Your answer in Chinese</label><textarea id="practice-response" lang="zh-CN" maxLength={10_000} required disabled={busy} value={text} onChange={e => { inputTouched.current = true; setText(e.target.value); }} />
        {restored ? <p role="status">Restored your unsent answer.</p> : null}{text.trim() && !text.includes(material.task.targetExpression) ? <p>Your answer doesn&apos;t include {material.task.targetExpression} yet.</p> : null}
        <div className={styles.buttonRow}><button type="submit" className={styles.primaryButton} disabled={busy || examplesPending}>{busy ? "Checking your Chinese…" : round.firstAnswer ? "Check my revision" : "Check my answer"}</button></div>
      </form></> : latest ? <>
        {round.latestRevision && round.firstAnswer ? <section className={styles.comparison}><AnswerComparison first={round.firstAnswer.text} second={round.latestRevision.text} firstLabel="Your first answer" secondLabel="Your revision" /><p>{evaluationDimensions(round.firstAnswer.evaluation).map((d,i) => <span className={styles.scoreChange} key={d.name}>{d.name} {d.result.score} → {evaluationDimensions(round.latestRevision!.evaluation)[i]!.result.score}</span>)}</p><DisclosureButton expanded={firstOpen} onClick={() => setFirstOpen(!firstOpen)}>First feedback</DisclosureButton>{firstOpen ? <EvaluationPanel evaluation={round.firstAnswer.evaluation} coaching={null} answerText={round.firstAnswer.text} resultLine="Your first answer" actions={null} /> : null}</section> : null}
        <EvaluationPanel key={latest.attemptId + latest.revision} evaluation={latest.evaluation} coaching={latest.naturalVersion ? { naturalRevisionChinese: latest.naturalVersion } : null} answerText={latest.text} resultLine={line} actions={actions} />
        {!round.promotion ? <p>We&apos;ll bring this back tomorrow in today&apos;s practice.</p> : null}
      </> : null}
    </>}
    {busy ? <p role="status" className={styles.checking}>Checking your Chinese…</p> : null}{slow ? <p role="status">Your configured model is still working. Your answer is still here.</p> : null}
    {error ? <div className={styles.alert} role="alert">{error === "chinese" ? "Write your answer in Chinese." : error === "gateway" ? <>Connect a model to continue. <Link href="/settings/model-gateway">Set up model gateway</Link></> : <>{error === "preparation" ? "We couldn't prepare a situation." : "The model didn't respond. Your answer is still here."} <button type="button" className={styles.tertiaryButton} onClick={() => retryAction.current()}>Try again</button></>}</div> : null}
  </PracticeMaterial></Container>;
}
