"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { getPractice, openPracticeExamples, postPractice, PracticeRequestError } from "./api";
import { DueCompletionSchema, DueTransferSchema, type Completion } from "./review-schema";
import { PracticeMaterial } from "./practice-material";
import { EvaluationPanel } from "./evaluation-panel";
import { formatPracticeDate } from "./practice-controls";
import { PracticeOpenError } from "./practice-open-error";
import type { PracticeMaterialView } from "./material-schema";
import styles from "./practice-workspace.module.css";
export function ReviewPractice({ reviewTaskId, mode = "standalone", nextLabel = "Next", onNext, onCompleted, onUnavailable }: {
  readonly reviewTaskId: string;
  readonly mode?: "standalone" | "session";
  readonly nextLabel?: "Next" | "Finish";
  readonly onNext?: () => void;
  readonly onCompleted?: (result: Completion) => void;
  readonly onUnavailable?: () => Promise<boolean>;
}) {
  const [material, setMaterial] = useState<PracticeMaterialView | null>(null), [error, setError] = useState<unknown>(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [slow, setSlow] = useState(false), [examplesPending, setExamplesPending] = useState(false), [completion, setCompletion] = useState<Completion | null>(null), [localRevision, setLocalRevision] = useState(false), [compared, setCompared] = useState(false), [restored, setRestored] = useState(false);
  const mountedRef = useRef(true);
  const flight = useRef(false), touched = useRef(false), retry = useRef<() => void>(() => { });
  const draftKey = `popcorn:answer:review:${reviewTaskId}`;
  async function handleError(error: unknown) {
    if (!mountedRef.current)
      return;
    const changedReview = error instanceof PracticeRequestError &&
      ((error.status === 404 && error.code === "FORBIDDEN") || (error.status === 409 && error.code === "CONFLICT"));
    if (mode === "session" && changedReview && onUnavailable) {
      const handled = await onUnavailable();
      if (handled || !mountedRef.current)
        return;
    }
    setError(error);
  }
  async function begin() {
    if (flight.current)
      return;
    flight.current = true;
    setBusy(true);
    setError(null);
    setSlow(false);
    retry.current = () => void begin();
    const timer = setTimeout(() => {
      if (mountedRef.current)
        setSlow(true);
    }, 8000);
    try {
      const result = await getPractice(`/api/v1/practice/due/${encodeURIComponent(reviewTaskId)}`, DueTransferSchema);
      if (!mountedRef.current)
        return;
      if (result.reviewTaskId !== reviewTaskId || result.id !== result.material.task.id || result.targetExpression !== result.material.task.targetExpression)
        throw Error("Review identity mismatch");
      setMaterial(result.material);
    }
    catch (e) {
      await handleError(e);
    }
    finally {
      clearTimeout(timer);
      flight.current = false;
      if (mountedRef.current) {
        setBusy(false);
        setSlow(false);
      }
    }
  }
  useEffect(() => {
    mountedRef.current = true;
    let mounted = true;
    void Promise.resolve().then(() => {
      if (!mounted)
        return;
      void begin();
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved && !touched.current) {
          setText(saved);
          setRestored(true);
        }
      }
      catch { /* Answer stays in memory. */ }
    });
    return () => {
      mounted = false;
      mountedRef.current = false;
    };
    // Each keyed Review instance owns one entry request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewTaskId]);
  useEffect(() => {
    if (completion)
      return;
    const timer = setTimeout(() => {
      try {
        if (text)
          localStorage.setItem(draftKey, text);
      }
      catch { /* Optional draft storage. */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [text, draftKey, completion]);
  async function check() {
    if (flight.current || examplesPending || completion)
      return;
    flight.current = true;
    setBusy(true);
    setError(null);
    setSlow(false);
    retry.current = () => void check();
    const timer = setTimeout(() => {
      if (mountedRef.current)
        setSlow(true);
    }, 8000);
    try {
      const result = await postPractice(`/api/v1/practice/due/${encodeURIComponent(reviewTaskId)}`, { responseChinese: text }, DueCompletionSchema);
      if (!mountedRef.current)
        return;
      if (result.reviewTaskId !== reviewTaskId || result.practiceTaskId !== material?.task.id)
        throw Error("Review completion mismatch");
      setCompletion(result);
      onCompleted?.(result);
      try {
        localStorage.removeItem(draftKey);
      }
      catch { /* Optional draft storage. */ }
    }
    catch (e) {
      await handleError(e);
    }
    finally {
      clearTimeout(timer);
      flight.current = false;
      if (mountedRef.current) {
        setBusy(false);
        setSlow(false);
      }
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (localRevision) {
      setLocalRevision(false);
      setCompared(true);
      return;
    }
    void check();
  }
  const actions = completion ? <div className={styles.buttonRow}>{mode === "session" ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={onNext}>{nextLabel}</button> : <Link className={styles.primaryButton} href="/practice">Back to Today&apos;s practice</Link>}{!compared && completion.coaching ? <button className={styles.secondaryButton} type="button" onClick={() => setLocalRevision(true)}>Compare with suggested revision</button> : null}</div> : null;
  const feedback = completion ? (!completion.evaluation.passed ? "Keep going — we'll bring this back tomorrow." : !completion.evaluation.independentUse ? "You got it with an example. We'll check again tomorrow — on your own." : `Nice — ${completion.priorState !== completion.newState ? `${completion.priorState} → ${completion.newState}` : `still ${completion.newState}`}. Next practice ${formatPracticeDate(completion.nextDueAt)}`) : "";
  const LoadingHeading = mode === "session" ? "h2" : "h1";
  return <section className={material || mode === "session" ? undefined : styles.workspace}>{!material ? <><LoadingHeading>Review</LoadingHeading>{busy ? <p role="status">Opening your practice item…</p> : null}</> : <PracticeMaterial headingLevel={mode === "session" ? 2 : 1} material={material} navigation={mode === "standalone" ? <p><Link className={styles.textLink} href="/practice">← Back to Today&apos;s practice</Link></p> : null} onExamplesPendingChange={setExamplesPending} onExamplesOpen={() => openPracticeExamples(reviewTaskId, true).then(() => { })}>{!completion || localRevision ? <form className={styles.responseForm} onSubmit={submit}><label htmlFor="review-response">Your Chinese response</label><textarea id="review-response" lang="zh-CN" required maxLength={10000} value={text} disabled={busy} onChange={e => {
          touched.current = true;
          setText(e.target.value);
        }}/>{restored ? <p role="status">Restored your unsent answer.</p> : null}<div className={styles.buttonRow}><button className={styles.primaryButton} type="submit" disabled={busy || examplesPending}>{localRevision ? "Show comparison" : busy ? "Checking your Chinese…" : "Check my response"}</button></div></form> : null}{completion && !localRevision ? <><section><h2>Your response</h2><p lang="zh-CN">{text}</p></section>{compared && completion.coaching ? <section className={styles.comparison} aria-labelledby="review-comparison-heading"><h2 id="review-comparison-heading">Compare with suggested revision</h2><h3>Your rewrite</h3><p lang="zh-CN">{text}</p><h3>Suggested revision</h3><p lang="zh-CN">{completion.coaching.naturalRevisionChinese}</p></section> : null}<EvaluationPanel evaluation={completion.evaluation} coaching={compared ? null : completion.coaching} answerText={text} resultLine={feedback} actions={actions}/></> : null}</PracticeMaterial>}{slow ? <p role="status">Your configured model is still working. Your response is safe here.</p> : null}{error ? <PracticeOpenError error={error} onRetry={() => retry.current()}/> : null}</section>;
}
