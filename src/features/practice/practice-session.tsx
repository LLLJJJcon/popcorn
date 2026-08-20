"use client";

import { useState, type FormEvent } from "react";

import type { AttemptRecorded, PracticeTask } from "@/contracts/practice";
import { EvaluationPanel } from "@/features/practice/evaluation-panel";
import { submitAttemptRevision, submitOriginalAttempt } from "@/features/practice/api";

export function PracticeSession({ task }: { readonly task: PracticeTask }) {
  const [responseChinese, setResponseChinese] = useState("");
  const [attempt, setAttempt] = useState<AttemptRecorded | null>(null);
  const [hasVaultEntry, setHasVaultEntry] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      const isOriginal = attempt === null;
      const recorded = isOriginal
        ? await submitOriginalAttempt(task.id, responseChinese)
        : await submitAttemptRevision(attempt.id, responseChinese);
      if (isOriginal) setHasVaultEntry(recorded.evaluation.passed);
      setAttempt(recorded);
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <article>
      <h1>Use {task.targetExpression} now</h1>
      <p lang="zh-CN">{task.promptChinese}</p>
      <p>{task.instructionsEnglish}</p>
      <p>{task.goalEnglish}</p>
      <form onSubmit={submit}>
        <label htmlFor="practice-response">Your Chinese response</label>
        <textarea
          id="practice-response"
          lang="zh-CN"
          maxLength={5_000}
          required
          value={responseChinese}
          onChange={(event) => setResponseChinese(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting
            ? "Checking response..."
            : attempt
              ? "Check revised response"
              : "Check my response"}
        </button>
      </form>
      {failed
        ? <p role="alert">Your response could not be checked. Try again.</p>
        : null}
      {attempt ? <EvaluationPanel evaluation={attempt.evaluation} /> : null}
      {attempt && hasVaultEntry
        ? <p><a href={`/vault#expression-${attempt.userExpressionId}`}>Open in Vault</a></p>
        : null}
    </article>
  );
}
