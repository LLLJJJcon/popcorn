"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";

import { apiSuccessSchema, type ApiSuccess } from "@/contracts/api";
import { MasteryStateSchema } from "@/contracts/memory";
import {
  EvaluationResultSchema,
  PracticeCoachingSchema,
  type AssistanceLevel,
} from "@/contracts/practice";
import { EnglishTextSchema, TargetChineseTextSchema } from "@/contracts/source";
import { EvaluationPanel } from "@/features/practice/evaluation-panel";
import { PracticeMaterialViewSchema, type PracticeMaterialView } from "@/features/practice/material-schema";
import { PracticeMaterial } from "@/features/practice/practice-material";
import styles from "@/features/practice/practice-workspace.module.css";
import type { DuePracticeView } from "@/server/repositories/review-task-repository";

const UuidSchema = z.string().uuid();
const IsoDateTimeSchema = z.string().datetime({ offset: true });

const DueTransferSchema = z.strictObject({
  id: UuidSchema,
  reviewTaskId: UuidSchema,
  targetExpression: TargetChineseTextSchema.max(200),
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000),
  goalEnglish: EnglishTextSchema.max(1_000),
  material: PracticeMaterialViewSchema,
});

const TransitionSchema = z.strictObject({ from: MasteryStateSchema, to: MasteryStateSchema });
const DueCompletionSchema = z.strictObject({
  reviewTaskId: UuidSchema,
  practiceTaskId: UuidSchema,
  attemptId: UuidSchema,
  masteryEventId: UuidSchema,
  nextReviewTaskId: UuidSchema,
  priorState: MasteryStateSchema,
  newState: MasteryStateSchema,
  nextDueAt: IsoDateTimeSchema,
  intervalDays: z.number().int().min(1).max(365),
  created: z.boolean(),
  transition: TransitionSchema.nullable(),
  evaluation: EvaluationResultSchema,
  coaching: PracticeCoachingSchema.nullable(),
}).superRefine((result, context) => {
  const changed = result.priorState !== result.newState;
  if (changed !== (result.transition !== null)) {
    context.addIssue({ code: "custom", path: ["transition"], message: "Transition must describe a mastery change" });
  }
  if (result.transition && (
    result.transition.from !== result.priorState || result.transition.to !== result.newState
  )) {
    context.addIssue({ code: "custom", path: ["transition"], message: "Transition must match mastery states" });
  }
});

const DueTransferSuccessSchema = apiSuccessSchema(DueTransferSchema);
const DueCompletionSuccessSchema = apiSuccessSchema(DueCompletionSchema);
type Completion = z.infer<typeof DueCompletionSchema>;

async function responseData<T>(response: Response, schema: z.ZodType<ApiSuccess<T>>): Promise<T> {
  if (!response.ok) throw new Error("due practice request failed");
  return schema.parse(await response.json()).data;
}

function sortedBacklog(tasks: readonly DuePracticeView[]): DuePracticeView[] {
  return [...tasks]
    .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.reviewTaskId.localeCompare(right.reviewTaskId));
}

function selectedQueue(tasks: readonly DuePracticeView[]): DuePracticeView[] {
  return sortedBacklog(tasks).slice(0, 3);
}

export function DuePractice({ tasks }: { readonly tasks: readonly DuePracticeView[] }) {
  const [backlog, setBacklog] = useState(() => sortedBacklog(tasks));
  const [queue, setQueue] = useState(() => selectedQueue(tasks));
  const [started, setStarted] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [material, setMaterial] = useState<PracticeMaterialView | null>(null);
  const [responseChinese, setResponseChinese] = useState("");
  const [assistanceLevel, setAssistanceLevel] = useState<AssistanceLevel>("none");
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [localRevision, setLocalRevision] = useState(false);
  const [localComparisonUsed, setLocalComparisonUsed] = useState(false);
  const [comparedLocally, setComparedLocally] = useState(false);
  const inFlight = useRef(false);
  const slowTimer = useRef<number | null>(null);
  const responseRef = useRef<HTMLTextAreaElement>(null);

  function clearSlowTimer() {
    if (slowTimer.current !== null) {
      window.clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
  }

  useEffect(() => () => clearSlowTimer(), []);

  async function begin(reviewTaskId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setStarted(true);
    setSubmitting(true);
    setFailed(false);
    setMaterial(null);
    setActiveReviewId(null);
    setCompletion(null);
    setFeedbackVisible(false);
    setLocalRevision(false);
    setLocalComparisonUsed(false);
    setComparedLocally(false);
    setResponseChinese("");
    setAssistanceLevel("none");
    try {
      const transfer = await responseData(await fetch(
        `/api/v1/practice/due/${encodeURIComponent(reviewTaskId)}`,
        { credentials: "same-origin", cache: "no-store" },
      ), DueTransferSuccessSchema);
      if (
        transfer.reviewTaskId !== reviewTaskId ||
        transfer.id !== transfer.material.task.id ||
        transfer.targetExpression !== transfer.material.task.targetExpression
      ) throw new Error("due practice transfer identity mismatch");
      setMaterial(transfer.material);
      setActiveReviewId(reviewTaskId);
    } catch {
      setFailed(true);
      setStarted(false);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completion && localRevision) {
      setLocalRevision(false);
      setLocalComparisonUsed(true);
      setComparedLocally(true);
      setFeedbackVisible(true);
      return;
    }
    if (!activeReviewId || inFlight.current || completion) return;
    inFlight.current = true;
    setSubmitting(true);
    setSlow(false);
    setFailed(false);
    clearSlowTimer();
    slowTimer.current = window.setTimeout(() => setSlow(true), 8_000);
    try {
      const result = await responseData(await fetch(
        `/api/v1/practice/due/${encodeURIComponent(activeReviewId)}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseChinese, assistanceLevel }),
        },
      ), DueCompletionSuccessSchema);
      if (result.reviewTaskId !== activeReviewId || result.practiceTaskId !== material?.task.id) {
        throw new Error("due practice completion identity mismatch");
      }
      setCompletion(result);
      setFeedbackVisible(true);
      setBacklog((current) => current.filter((task) => task.reviewTaskId !== activeReviewId));
      setQueue((current) => current.filter((task) => task.reviewTaskId !== activeReviewId));
    } catch {
      setFailed(true);
    } finally {
      clearSlowTimer();
      setSlow(false);
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  function stop() {
    setQueue(backlog.slice(0, 3));
    setStarted(false);
    setActiveReviewId(null);
    setMaterial(null);
    setCompletion(null);
    setFeedbackVisible(false);
    setLocalRevision(false);
    setLocalComparisonUsed(false);
    setComparedLocally(false);
    setFailed(false);
  }

  async function continueSession() {
    const next = queue[0];
    if (!next) {
      stop();
      return;
    }
    await begin(next.reviewTaskId);
  }

  function reviseLocally() {
    setFeedbackVisible(false);
    setLocalRevision(true);
    setComparedLocally(false);
    responseRef.current?.focus();
  }

  if (!started) {
    return (
      <section className={styles.workspace}>
        <header className={styles.landingHeader}>
          <p className={styles.eyebrow}>A short active-use session</p>
          <h1>Practice</h1>
          <p>Turn the Mandarin you saved from YouTube into language you can use.</p>
        </header>
        {failed ? <p className={styles.alert} role="alert">Practice could not open. Check Settings, then try again.</p> : null}
        {queue.length === 0 ? (
          <section className={styles.emptyCard}>
            <h2>You are caught up</h2>
            <p>There is nothing due right now. Revisit a saved moment or browse expressions you already know.</p>
            <div className={styles.emptyLinks}>
              <Link className={styles.textLink} href="/saved">Review Saved moments</Link>
              <Link className={styles.textLink} href="/vault">Browse your Vault</Link>
            </div>
          </section>
        ) : (
          <section className={styles.sessionCard} aria-labelledby="session-heading">
            <h2 id="session-heading" className={styles.sessionSummary}>
              {queue.length} due · about {Math.min(6, queue.length * 2)} minutes
            </h2>
            <ol className={styles.queue} aria-label="This practice session">
              {queue.map((task) => (
                <li key={task.reviewTaskId}>
                  <span><span className={styles.queueExpression} lang="zh-CN">{task.expression}</span><br />
                    <span className={styles.queueMeaning}>{task.englishMeaning}</span></span>
                  <span className={styles.mastery}>{task.masteryState}</span>
                </li>
              ))}
            </ol>
            <button className={styles.primaryButton} type="button" disabled={submitting}
              onClick={() => void begin(queue[0]!.reviewTaskId)}>
              Start practice
            </button>
          </section>
        )}
      </section>
    );
  }

  if (!material) {
    return (
      <section className={styles.workspace}>
        <h1>Practice</h1>
        <p role="status" aria-live="polite">Opening your next practice item…</p>
      </section>
    );
  }

  return (
    <PracticeMaterial
      key={material.task.id}
      material={material}
      onHintUsed={() => setAssistanceLevel("hint")}
      sessionStatus={`${Math.max(0, queue.length - (completion ? 0 : 1))} left in this session`}
    >
      <form className={styles.responseForm} onSubmit={submit}>
        <label htmlFor="due-practice-response">Your Chinese response</label>
        <textarea ref={responseRef} id="due-practice-response" lang="zh-CN" maxLength={5_000} required
          value={responseChinese} onChange={(event) => setResponseChinese(event.target.value)} />
        <div className={styles.buttonRow}>
          {completion && localRevision ? (
            <button className={styles.primaryButton} type="submit">Compare my rewrite</button>
          ) : completion && !feedbackVisible ? (
            <button className={styles.primaryButton} type="button" onClick={() => void continueSession()}>Continue</button>
          ) : completion ? null : (
            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? "Checking your Chinese…" : "Check my response"}
            </button>
          )}
          <button className={styles.secondaryButton} type="button" onClick={stop}>Stop for now</button>
        </div>
        {submitting ? <p className={styles.checking} role="status" aria-live="polite">Checking your Chinese…</p> : null}
        {slow ? <p className={styles.checking} role="status">Your configured model is still working. Your response is safe here.</p> : null}
        {failed ? <p className={styles.alert} role="alert">We could not check that response. Your response is still here — try again.</p> : null}
      </form>

      {comparedLocally ? (
        <p className={styles.checking} role="status">
          Compared locally with the recorded feedback — no new model check was made.
        </p>
      ) : null}

      {completion && feedbackVisible ? (
        <EvaluationPanel
          evaluation={completion.evaluation}
          coaching={completion.coaching}
          evidenceMessage="Practice evidence was recorded."
          transition={completion.transition}
          nextDueAt={completion.nextDueAt}
          remainingCount={queue.length}
          onRevise={localComparisonUsed ? undefined : reviseLocally}
          onContinue={queue.length > 0 ? () => void continueSession() : undefined}
          onStop={stop}
        />
      ) : null}
    </PracticeMaterial>
  );
}
