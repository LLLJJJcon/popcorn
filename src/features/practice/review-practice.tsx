"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { DueTransferSchema, ReviewMarkerResponseSchema, ReviewRevisionResponseSchema, type Completion, type DueReviewState, type DueTransfer } from "@/contracts/review-practice";
import { PracticeRequestError } from "./api";
import { DueHttpCompletionSchema, getReview, requestReview, ReviewRequestError } from "./due-api";
import { PracticeMaterial } from "./practice-material";
import { EvaluationPanel, evaluationDimensions } from "./evaluation-panel";
import { AnswerComparison } from "./answer-comparison";
import { DisclosureButton, formatPracticeDate } from "./practice-controls";
import styles from "./practice-workspace.module.css";

type ActionKind = "prepare" | "regenerate" | "complete" | "revision" | "reveal" | "examples";
type Action = { key: string; requestId: string };
const identityKey = (state: DueReviewState) => `${state.identity.taskId}:${state.identity.scenarioVersion}:${state.identity.scenarioFingerprint}`;
const answerKey = (state: DueReviewState) => `popcorn:due-answer:${state.reviewTaskId}:${identityKey(state)}`;
function sameIdentity(a: DueReviewState, b: DueReviewState) { return a.reviewTaskId === b.reviewTaskId && identityKey(a) === identityKey(b); }
function retainMarkers(previous: DueReviewState, next: DueReviewState) { if ((previous.expressionRevealedAt && !next.expressionRevealedAt) || (previous.examplesOpenedAt && !next.examplesOpenedAt)) throw Error("Review markers cannot be erased"); }
function officialCompletion(state: DueReviewState): Completion | null {
  const first = state.firstAnswer;
  return first ? { ...first.result, evaluation: first.evaluation, coaching: first.coaching, reviewState: state } : null;
}

export function ReviewPractice({ reviewTaskId, mode = "standalone", nextLabel = "Next", onNext, onCompleted, onUnavailable }: {
  readonly reviewTaskId: string; readonly mode?: "standalone" | "session"; readonly nextLabel?: "Next" | "Finish";
  readonly onNext?: () => void; readonly onCompleted?: (result: Completion) => void; readonly onUnavailable?: () => Promise<boolean>;
}) {
  const [review, setReview] = useState<DueTransfer | null>(null), [text, setText] = useState("");
  const [editing, setEditing] = useState(true), [busy, setBusy] = useState(false), [slow, setSlow] = useState(false);
  const [error, setError] = useState<unknown>(null), [errorKind, setErrorKind] = useState<ActionKind>("prepare");
  const [restored, setRestored] = useState(false), [notice, setNotice] = useState<string | null>(null), [firstOpen, setFirstOpen] = useState(false);
  const mounted = useRef(true), activeId = useRef(reviewTaskId), sequence = useRef(0), flight = useRef(false);
  const currentReview = useRef<DueTransfer | null>(null), currentText = useRef(""), retry = useRef<() => void>(() => {});
  const actions = useRef<Partial<Record<ActionKind, Action>>>({}), prepareId = useRef<string | undefined>(undefined), emitted = useRef<string | null>(null);
  const preparationFailed = useRef(false);
  const waiting = useRef<{ timer: ReturnType<typeof setTimeout>; resolve: (active: boolean) => void } | null>(null);
  activeId.current = reviewTaskId; currentReview.current = review; currentText.current = text;
  const live = (token: number, origin: string) => mounted.current && activeId.current === origin && sequence.current === token;
  function invalidateOperations() { sequence.current++; }
  function pause(ms: number, token: number, origin: string) {
    return new Promise<boolean>(resolve => { const timer = setTimeout(() => { waiting.current = null; resolve(live(token, origin)); }, ms); waiting.current = { timer, resolve }; });
  }
  function saveDraft(item: DueTransfer, value: string) { try { if (value) localStorage.setItem(answerKey(item.reviewState), value); else localStorage.removeItem(answerKey(item.reviewState)); } catch { /* Optional storage. */ } }
  function clearDraft(item: DueTransfer) { try { localStorage.removeItem(answerKey(item.reviewState)); } catch { /* Optional storage. */ } }
  function validateTransfer(item: DueTransfer) {
    const state = item.reviewState;
    if (item.reviewTaskId !== reviewTaskId || state.reviewTaskId !== reviewTaskId || item.id !== item.material.task.id || item.id !== state.identity.taskId || item.targetExpression !== item.material.task.targetExpression || item.scenarioVersion !== state.identity.scenarioVersion || item.scenarioFingerprint !== state.identity.scenarioFingerprint || item.canRegenerate !== state.canRegenerate || item.material.task.kind !== "due_practice") throw Error("Review identity mismatch");
    const task = item.material.task;
    if (task.promptChinese !== item.promptChinese || task.instructionsEnglish !== item.instructionsEnglish || task.goalEnglish !== item.goalEnglish || item.expressionRevealed !== Boolean(state.expressionRevealedAt || state.examplesOpenedAt)) throw Error("Review content mismatch");
    if (item.metadataMode === "modern" && (!task.situation || task.situation.situationZh !== item.promptChinese || task.situation.situationEn !== item.situationEn || task.situation.interlocutor !== item.interlocutor || task.situation.taskEn !== item.taskEn || task.situation.targetFunction !== item.targetFunction || task.situation.targetSetting !== item.targetSetting)) throw Error("Review situation mismatch");
    if (state.firstAnswer && (state.firstAnswer.result.reviewTaskId !== reviewTaskId || state.firstAnswer.result.practiceTaskId !== item.id || state.firstAnswer.attemptId !== state.firstAnswer.result.attemptId)) throw Error("Review answer identity mismatch");
    if (state.latestRevision && (state.latestRevision.attemptId !== state.firstAnswer?.attemptId || state.latestRevision.taskId !== item.id || state.latestRevision.scenarioVersion !== item.scenarioVersion || state.latestRevision.scenarioFingerprint !== item.scenarioFingerprint)) throw Error("Review revision identity mismatch");
  }
  function applyTransfer(item: DueTransfer) {
    validateTransfer(item);
    const previous = currentReview.current;
    if (previous) retainMarkers(previous.reviewState, item.reviewState);
    if (previous && !sameIdentity(previous.reviewState, item.reviewState)) saveDraft(previous, currentText.current);
    let draft: string | null = null;
    try {
      draft = localStorage.getItem(answerKey(item.reviewState));
      // Pre-group4 could only have this retained version-one legacy question.
      if (!draft && item.metadataMode === "legacy" && item.scenarioVersion === 1 && !item.reviewState.firstAnswer) draft = localStorage.getItem(`popcorn:answer:review:${reviewTaskId}`) ?? localStorage.getItem(`popcorn:due-answer:${reviewTaskId}`);
    } catch { /* Optional storage. */ }
    const latest = item.reviewState.latestRevision ?? item.reviewState.firstAnswer;
    // A lost successful response can leave the exact now-official answer as a draft.
    if (draft && draft === latest?.responseChinese) { draft = null; clearDraft(item); }
    currentReview.current = item; setReview(item); setText(draft ?? latest?.responseChinese ?? ""); setEditing(Boolean(draft) || !item.reviewState.firstAnswer); setRestored(Boolean(draft)); setFirstOpen(false);
  }
  function applyState(state: DueReviewState, original: DueTransfer) {
    if (!sameIdentity(state, original.reviewState)) throw Error("Review state identity mismatch");
    retainMarkers(original.reviewState, state);
    const item = { ...original, reviewState: state, canRegenerate: state.canRegenerate, expressionRevealed: Boolean(state.expressionRevealedAt || state.examplesOpenedAt) };
    validateTransfer(item); currentReview.current = item; setReview(item);
    return item;
  }
  function action(kind: ActionKind, item: DueTransfer, payload = "") {
    const key = `${identityKey(item.reviewState)}:${item.reviewState.firstAnswer?.attemptId ?? ""}:${payload}`;
    if (actions.current[kind]?.key !== key) {
      let stored: Action | null = null;
      try { const raw = sessionStorage.getItem(`popcorn:due-action:${reviewTaskId}:${kind}`); if (raw) { const value = JSON.parse(raw); if (value.key === key && z.string().uuid().safeParse(value.requestId).success) stored = value; } } catch { /* Optional recovery. */ }
      actions.current[kind] = stored ?? { key, requestId: crypto.randomUUID() };
      try { sessionStorage.setItem(`popcorn:due-action:${reviewTaskId}:${kind}`, JSON.stringify(actions.current[kind])); } catch { /* Optional recovery. */ }
    }
    return actions.current[kind]!;
  }
  function forgetAction(kind: ActionKind) { delete actions.current[kind]; try { sessionStorage.removeItem(`popcorn:due-action:${reviewTaskId}:${kind}`); } catch { /* Optional recovery. */ } }
  function rememberPreparation(value?: string) { prepareId.current = value; try { if (value) sessionStorage.setItem(`popcorn:due-prepare:${reviewTaskId}`, value); else sessionStorage.removeItem(`popcorn:due-prepare:${reviewTaskId}`); } catch { /* Optional recovery. */ } }
  async function handleError(caught: unknown, kind: ActionKind, token: number, origin: string) {
    if (!live(token, origin)) return;
    if (caught instanceof ReviewRequestError) {
      const details = caught.details;
      if (details?.operation?.state === "failed") {
        if (details.operation.kind === "prepare") { rememberPreparation(details.operation.requestId); preparationFailed.current = true; }
        if (details.operation.requestId === actions.current[kind]?.requestId) forgetAction(kind);
      }
      if (details?.current) {
        try { applyTransfer(details.current); }
        catch { setError(new PracticeRequestError("PROVIDER_OUTPUT_INVALID")); setErrorKind(kind); return; }
        setNotice(caught.code === "ALREADY_SUBMITTED" ? "You already answered this review. Here's your feedback." : caught.code === "REGENERATE_USED" ? "You've already changed this situation." : "This situation changed. Your earlier unsent answer is saved."); setError(null); return;
      }
    }
    const changedReview = caught instanceof PracticeRequestError && ((caught.status === 404 && caught.code === "FORBIDDEN") || (caught.status === 409 && caught.code === "CONFLICT"));
    if (mode === "session" && changedReview && onUnavailable) { try { const handled = await onUnavailable(); if (handled || !live(token, origin)) return; } catch { /* A failed queue confirmation retains this item. */ } }
    if (live(token, origin)) { setError(caught); setErrorKind(kind); }
  }
  async function begin(explicitRetry = false) {
    if (flight.current) return;
    flight.current = true; const token = ++sequence.current, origin = reviewTaskId;
    if (explicitRetry && preparationFailed.current) { rememberPreparation(crypto.randomUUID()); preparationFailed.current = false; }
    else if (!prepareId.current) {
      let saved: string | null = null;
      try { saved = sessionStorage.getItem(`popcorn:due-prepare:${reviewTaskId}`); } catch { /* Optional recovery. */ }
      if (saved && z.string().uuid().safeParse(saved).success) rememberPreparation(saved);
    }
    setBusy(true); setSlow(false); setError(null); setErrorKind("prepare"); retry.current = () => void begin(true);
    const timer = setTimeout(() => { if (live(token, origin)) setSlow(true); }, 8000);
    try {
      while (live(token, origin)) {
        const result = await getReview(origin, prepareId.current);
        if (!live(token, origin)) return;
        if (result.reviewTaskId !== origin) throw Error("Review identity mismatch");
        if (result.status === "ready") { applyTransfer(result); rememberPreparation(); preparationFailed.current = false; return; }
        rememberPreparation(result.requestId);
        if (!await pause(result.retryAfterMs, token, origin)) return;
      }
    } catch (caught) { await handleError(caught, "prepare", token, origin); }
    finally { clearTimeout(timer); if (live(token, origin)) { flight.current = false; setBusy(false); setSlow(false); } }
  }
  useEffect(() => {
    mounted.current = true; let active = true;
    void Promise.resolve().then(() => { if (active) void begin(); });
    return () => { active = false; mounted.current = false; invalidateOperations(); flight.current = false; if (waiting.current) { clearTimeout(waiting.current.timer); waiting.current.resolve(false); waiting.current = null; } };
    // Every keyed Review owns its operation sequence and server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewTaskId]);
  useEffect(() => { if (!review || !editing) return; const timer = setTimeout(() => saveDraft(review, text), 500); return () => clearTimeout(timer); }, [review, text, editing]);
  async function mutate<T>(kind: Exclude<ActionKind, "prepare">, suffix: string, schema: z.ZodType<T>, extra: Record<string, string>, accept: (result: T, original: DueTransfer) => void, propagate = false) {
    const original = currentReview.current;
    if (!original || flight.current) { if (propagate) throw Error("Review action is busy"); return; }
    const operation = action(kind, original, JSON.stringify(extra)), token = ++sequence.current, origin = reviewTaskId;
    const body = { ...original.reviewState.identity, requestId: operation.requestId, ...extra };
    flight.current = true; setBusy(true); setSlow(false); setError(null); setErrorKind(kind);
    const timer = setTimeout(() => { if (live(token, origin)) setSlow(true); }, 8000);
    try {
      while (live(token, origin)) {
        try {
          const result = await requestReview(`/api/v1/practice/due/${encodeURIComponent(origin)}${suffix}`, schema, body);
          if (!live(token, origin)) { if (propagate) throw Error("Obsolete review operation"); return; }
          accept(result, original); forgetAction(kind); return;
        } catch (caught) {
          if (caught instanceof ReviewRequestError && caught.details?.operation?.state === "in_progress" && caught.details.operation.requestId === operation.requestId) { if (await pause(1000, token, origin)) continue; if (propagate) throw Error("Obsolete review operation"); return; }
          throw caught;
        }
      }
    } catch (caught) { await handleError(caught, kind, token, origin); if (propagate) throw caught; }
    finally { clearTimeout(timer); if (live(token, origin)) { flight.current = false; setBusy(false); setSlow(false); } }
  }
  async function regenerate() {
    const item = currentReview.current;
    if (!item?.reviewState.canRegenerate || item.reviewState.firstAnswer) return;
    saveDraft(item, currentText.current); retry.current = () => void regenerate();
    await mutate("regenerate", "/regenerate", DueTransferSchema, {}, result => applyTransfer(result));
  }
  async function recordMarker(kind: "reveal" | "examples") {
    retry.current = () => void recordMarker(kind).catch(() => {});
    await mutate(kind, kind === "reveal" ? "/reveal-expression" : "/examples-opened", ReviewMarkerResponseSchema, {}, (result, original) => {
      if (!result.reviewState.expressionRevealedAt || (kind === "examples" && !result.reviewState.examplesOpenedAt)) throw Error("Review marker was not persisted");
      const item = applyState(result.reviewState, original);
      if (item.reviewState.firstAnswer && !original.reviewState.firstAnswer) { saveDraft(original, currentText.current); setEditing(false); setText((item.reviewState.latestRevision ?? item.reviewState.firstAnswer).responseChinese); }
    }, true);
  }
  async function check() {
    const item = currentReview.current;
    if (!item || flight.current) return;
    if (!/\p{Script=Han}/u.test(text)) { setError("chinese"); return; }
    saveDraft(item, text);
    const first = item.reviewState.firstAnswer;
    retry.current = () => void check();
    if (first) {
      await mutate("revision", "/revisions", ReviewRevisionResponseSchema, { attemptId: first.attemptId, responseChinese: text }, (result, original) => {
        if (result.revision.attemptId !== first.attemptId || result.revision.id !== result.reviewState.latestRevision?.id) throw Error("Revision identity mismatch");
        const next = applyState(result.reviewState, original); setText(result.revision.responseChinese); setEditing(false); setRestored(false); clearDraft(next);
      });
    } else {
      await mutate("complete", "", DueHttpCompletionSchema, { responseChinese: text }, (result, original) => {
        if (result.reviewTaskId !== reviewTaskId || result.practiceTaskId !== original.id) throw Error("Review completion mismatch");
        const state = result.reviewState;
        if (!state?.firstAnswer || state.firstAnswer.attemptId !== result.attemptId) throw Error("Review official answer mismatch");
        const next = applyState(state, original); setText((state.latestRevision ?? state.firstAnswer).responseChinese); setEditing(false); setRestored(false); clearDraft(next);
        if (emitted.current !== result.attemptId) { emitted.current = result.attemptId; onCompleted?.(result); }
      });
    }
  }
  function submit(event: FormEvent) { event.preventDefault(); void check(); }
  const state = review?.reviewState, first = state?.firstAnswer, latest = state?.latestRevision ?? first;
  const completion = state ? officialCompletion(state) : null;
  const hidden = !state?.expressionRevealedAt && !state?.examplesOpenedAt;
  const feedback = completion ? !completion.evaluation.passed ? "Keep going — we'll bring this back tomorrow." : !completion.evaluation.independentUse ? "You got it with an example. We'll check again tomorrow — on your own." : `Nice — ${completion.priorState !== completion.newState ? `${completion.priorState} → ${completion.newState}` : `still ${completion.newState}`}. Next practice ${formatPracticeDate(completion.nextDueAt)}` : "";
  const buttons = <div className={styles.buttonRow}>{mode === "session" ? <button className={styles.primaryButton} type="button" disabled={busy} onClick={onNext}>{nextLabel}</button> : <Link className={styles.primaryButton} href="/practice">Back to Today&apos;s practice</Link>}<button className={styles.secondaryButton} type="button" disabled={busy} onClick={() => { setText(latest?.responseChinese ?? ""); setEditing(true); setError(null); }}>Revise this answer</button></div>;
  const LoadingHeading = mode === "session" ? "h2" : "h1";
  const gateway = error instanceof PracticeRequestError && error.code === "MODEL_GATEWAY_CONFIGURATION_REQUIRED";
  return <section className={review || mode === "session" ? undefined : styles.workspace}>
    {!review ? <><LoadingHeading>Review</LoadingHeading>{busy ? <p role="status">Opening your practice item…</p> : null}</> : <PracticeMaterial key={identityKey(review.reviewState)} headingLevel={mode === "session" ? 2 : 1} material={review.material} expressionHidden={hidden} examplesOpened={Boolean(state?.examplesOpenedAt)} showAssistanceNotice={!first} actionsDisabled={busy} navigation={mode === "standalone" ? <p><Link className={styles.textLink} href="/practice">← Back to Today&apos;s practice</Link></p> : null} onExpressionReveal={() => recordMarker("reveal")} onExamplesOpen={() => recordMarker("examples")}>
      {notice ? <p role="status">{notice}</p> : null}
      {editing ? <>{first ? <section className={styles.firstAnswer}><h3>Your first answer</h3><p lang="zh-CN">{first.responseChinese}</p><p>{evaluationDimensions(first.evaluation).map(d => `${d.name} ${d.result.score}/5`).join(" · ")}</p></section> : null}
        {!first && state?.canRegenerate ? <button className={styles.tertiaryButton} type="button" disabled={busy} onClick={() => void regenerate()}>Try a different situation</button> : null}
        <form className={styles.responseForm} onSubmit={submit}><label htmlFor="review-response">Your answer in Chinese</label><textarea id="review-response" lang="zh-CN" required maxLength={10000} value={text} disabled={busy} onChange={event => { setText(event.target.value); setError(null); }}/>{restored ? <p role="status">Restored your unsent answer.</p> : null}{!hidden && text.trim() && !text.includes(review.targetExpression) ? <p>Your answer doesn&apos;t include {review.targetExpression} yet.</p> : null}<div className={styles.buttonRow}><button className={styles.primaryButton} type="submit" disabled={busy}>{busy && (errorKind === "complete" || errorKind === "revision") ? "Checking your Chinese…" : first ? "Check my revision" : "Check my answer"}</button></div></form></> : latest && first ? <>
        {state?.latestRevision ? <section className={styles.comparison}><AnswerComparison first={first.responseChinese} second={state.latestRevision.responseChinese} firstLabel="Your first answer" secondLabel="Your revision"/><p>{evaluationDimensions(first.evaluation).map((dimension, index) => <span className={styles.scoreChange} key={dimension.name}>{dimension.name} {dimension.result.score} → {evaluationDimensions(state.latestRevision!.evaluation)[index]!.result.score}</span>)}</p><DisclosureButton expanded={firstOpen} onClick={() => setFirstOpen(!firstOpen)}>First feedback</DisclosureButton>{firstOpen ? <EvaluationPanel evaluation={first.evaluation} coaching={first.coaching} answerText={first.responseChinese} resultLine="Your first answer" actions={null}/> : null}</section> : <section><h2>Your response</h2><p lang="zh-CN">{first.responseChinese}</p></section>}
        <EvaluationPanel key={state?.latestRevision?.id ?? first.attemptId} evaluation={latest.evaluation} coaching={latest.coaching} answerText={latest.responseChinese} resultLine={feedback} actions={buttons}/>
      </> : null}
    </PracticeMaterial>}
    {slow ? <p role="status">{errorKind === "prepare" || errorKind === "regenerate" ? "Preparing a new situation…" : "Your configured model is still working. Your answer is still here."}</p> : null}
    {error ? <div role="alert" className={styles.alert}>{error === "chinese" ? "Write your answer in Chinese." : <>{gateway ? <><p>Connect a model to continue.</p><Link href="/settings/model-gateway">Set up model gateway</Link></> : <p>{errorKind === "prepare" || errorKind === "regenerate" ? "We couldn't prepare a situation." : "The model didn't respond. Your answer is still here."}</p>}<button className={styles.tertiaryButton} type="button" onClick={() => retry.current()}>Try again</button></>}</div> : null}
  </section>;
}
