"use client";

import { useRef, useState, type FormEvent } from "react";

import type { DuePracticeView } from "@/server/repositories/review-task-repository";

type TransferTask = {
  readonly reviewTaskId: string;
  readonly targetExpression: string;
  readonly promptChinese: string;
  readonly instructionsEnglish: string;
  readonly goalEnglish: string;
};

type Completion = {
  readonly transition: { readonly from: string; readonly to: string } | null;
  readonly nextDueAt: string;
};

async function responseData<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error("due practice request failed");
  const body = await response.json() as { data?: T };
  if (!body.data) throw new Error("due practice response failed");
  return body.data;
}

export function DuePractice({ tasks }: { readonly tasks: readonly DuePracticeView[] }) {
  const [active, setActive] = useState<TransferTask | null>(null);
  const [responseChinese, setResponseChinese] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [completion, setCompletion] = useState<Completion | null>(null);
  const inFlight = useRef(false);

  async function begin(reviewTaskId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailed(false);
    setCompletion(null);
    try {
      const task = await responseData<TransferTask>(await fetch(`/api/v1/practice/due/${encodeURIComponent(reviewTaskId)}`, {
        credentials: "same-origin", cache: "no-store",
      }));
      setActive(task);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailed(false);
    try {
      const result = await responseData<Completion>(await fetch(`/api/v1/practice/due/${encodeURIComponent(active.reviewTaskId)}`, {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseChinese, assistanceLevel: "none" }),
      }));
      setCompletion(result);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Practice</h1>
      {tasks.length === 0
        ? <p>No Practice is due. Keep learning from your saved YouTube moments.</p>
        : <ul>{tasks.map((task) => (
          <li key={task.reviewTaskId}>
            <a href={`/vault#expression-${task.userExpressionId}`}>Practice {task.expression}</a>
            <button type="button" onClick={() => void begin(task.reviewTaskId)} disabled={submitting}>
              Start due Practice
            </button>
            <p>{task.englishMeaning} · {task.masteryState} · due {task.dueAt}</p>
          </li>
        ))}</ul>}
      {active ? <article>
        <h2>Use {active.targetExpression} in a new situation</h2>
        <p lang="zh-CN">{active.promptChinese}</p>
        <p>{active.instructionsEnglish}</p>
        <p>{active.goalEnglish}</p>
        <form onSubmit={submit}>
          <label htmlFor="due-practice-response">Your Chinese response</label>
          <textarea id="due-practice-response" lang="zh-CN" maxLength={5_000} required value={responseChinese}
            onChange={(event) => setResponseChinese(event.target.value)} />
          <button type="submit" disabled={submitting}>{submitting ? "Checking response..." : "Check my response"}</button>
        </form>
      </article> : null}
      {failed ? <p role="alert">Your response could not be checked. Try again.</p> : null}
      {completion ? <p>
        {completion.transition
          ? `Practice moved from ${completion.transition.from} to ${completion.transition.to}.`
          : "Practice was recorded."} Next due {completion.nextDueAt}.
      </p> : null}
    </section>
  );
}
