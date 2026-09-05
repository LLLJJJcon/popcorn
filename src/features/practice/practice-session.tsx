"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { AssistanceLevel, PracticeAttemptResponse } from "@/contracts/practice";
import { submitAttemptRevision, submitOriginalAttempt } from "@/features/practice/api";
import { EvaluationPanel } from "@/features/practice/evaluation-panel";
import type { PracticeMaterialView } from "@/features/practice/material-schema";
import { PracticeMaterial } from "@/features/practice/practice-material";
import styles from "@/features/practice/practice-workspace.module.css";

export function PracticeSession({ material }: { readonly material: PracticeMaterialView }) {
  const router = useRouter();
  const [responseChinese, setResponseChinese] = useState("");
  const [result, setResult] = useState<PracticeAttemptResponse | null>(null);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [hasVaultEntry, setHasVaultEntry] = useState(false);
  const [assistanceLevel, setAssistanceLevel] = useState<AssistanceLevel>("none");
  const [submitting, setSubmitting] = useState(false);
  const [slow, setSlow] = useState(false);
  const [failed, setFailed] = useState(false);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setSlow(false);
    setFailed(false);
    clearSlowTimer();
    slowTimer.current = window.setTimeout(() => setSlow(true), 8_000);
    try {
      const isOriginal = result === null;
      const recorded = isOriginal
        ? await submitOriginalAttempt(material.task.id, responseChinese, assistanceLevel)
        : await submitAttemptRevision(result.attempt.id, responseChinese, assistanceLevel);
      if (isOriginal) {
        setHasVaultEntry(recorded.attempt.evaluation.passed && recorded.attempt.evaluation.independentUse);
      }
      setResult(recorded);
      setFeedbackVisible(true);
    } catch {
      setFailed(true);
    } finally {
      clearSlowTimer();
      setSlow(false);
      setSubmitting(false);
      inFlight.current = false;
    }
  }

  function revise() {
    setFeedbackVisible(false);
    responseRef.current?.focus();
  }

  function goToPractice() {
    router.push("/practice");
  }

  return (
    <PracticeMaterial
      material={material}
      onHintUsed={() => setAssistanceLevel("hint")}
    >
      <form className={styles.responseForm} onSubmit={submit}>
        <label htmlFor="practice-response">Your Chinese response</label>
        <textarea
          ref={responseRef}
          id="practice-response"
          lang="zh-CN"
          maxLength={5_000}
          required
          value={responseChinese}
          onChange={(event) => setResponseChinese(event.target.value)}
        />
        <div className={styles.buttonRow}>
          <button className={styles.primaryButton} type="submit" disabled={submitting}>
            {submitting
              ? "Checking your Chinese…"
              : result
                ? "Check revised response"
                : "Check my response"}
          </button>
          <button className={styles.secondaryButton} type="button" onClick={goToPractice}>Stop for now</button>
        </div>
        {submitting ? <p className={styles.checking} role="status" aria-live="polite">Checking your Chinese…</p> : null}
        {slow ? (
          <p className={styles.checking} role="status">
            Your configured model is still working. Keep this page open; your response is safe here.
          </p>
        ) : null}
        {failed ? (
          <p className={styles.alert} role="alert">
            We could not check that response. Your response is still here — check Settings or try again.
          </p>
        ) : null}
      </form>

      {result && feedbackVisible ? (
        <EvaluationPanel
          evaluation={result.attempt.evaluation}
          coaching={result.coaching}
          evidenceMessage={hasVaultEntry
            ? "This independent first attempt was added to your Vault as learning evidence."
            : "This attempt was recorded, but it was not added to your Vault as independent evidence."}
          onRevise={revise}
          onContinue={goToPractice}
          onStop={goToPractice}
        />
      ) : null}
      {hasVaultEntry ? <p><a className={styles.textLink} href="/vault">Open in Vault</a></p> : null}
    </PracticeMaterial>
  );
}
