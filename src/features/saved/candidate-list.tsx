"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { CandidateExpressionListSchema, type CandidateExpression } from "@/contracts/knowledge";
import { PracticeTaskSchema } from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";
import { CandidateExpressionCard } from "./candidate-expression";
import styles from "./saved-workspace.module.css";

export type CandidateArtifact = {
  readonly artifactId: string;
  readonly savedItemId: string;
  readonly candidates: readonly CandidateExpression[];
};

export type CandidateAnalysis =
  | { readonly state: "missing" }
  | { readonly state: "unavailable" }
  | { readonly state: "ready"; readonly artifact: CandidateArtifact };

const ReadyRecoverySchema = z.strictObject({
  state: z.literal("ready"),
  artifactId: z.string().uuid(),
  savedItemId: z.string().uuid(),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  canonicalUrl: z.url(),
  candidates: CandidateExpressionListSchema,
});

const PublicFailureCategorySchema = z.enum(["model_unavailable", "model_output", "internal"]);

const FailedRecoverySchema = z.strictObject({
  state: z.literal("failed"),
  jobId: z.string().uuid(),
  failureCategory: PublicFailureCategorySchema,
});

const RecoverySchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  ReadyRecoverySchema,
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: z.string().trim().min(1).max(100),
    created: z.boolean(),
  }),
  FailedRecoverySchema,
]));

const PollSchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  ReadyRecoverySchema,
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: z.string().trim().min(1).max(100),
  }),
  FailedRecoverySchema,
]));

type FailureCategory = z.infer<typeof PublicFailureCategorySchema>;
type RecoveryState = "idle" | "pending" | "background" | "queued" | "checking" | "gateway" | "terminal" | "error";

const FAST_POLL_INTERVAL_MS = 1_000;
const SLOW_POLL_INTERVAL_MS = 5_000;
const BACKGROUND_AFTER_MS = 60_000;
const STOP_POLLING_AFTER_MS = 300_000;

function terminalFailureMessage(category: FailureCategory): string {
  if (category === "model_output") return "The model response could not be organized.";
  if (category === "model_unavailable") return "The model is unavailable right now.";
  return "Analysis could not be completed.";
}

export function CandidateList({
  savedItemId,
  videoSourceId,
  youtubeUrl,
  analysis,
}: {
  readonly savedItemId: string;
  readonly videoSourceId: string;
  readonly youtubeUrl: string;
  readonly analysis: CandidateAnalysis;
}) {
  const router = useRouter();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("idle");
  const [failureCategory, setFailureCategory] = useState<FailureCategory | null>(null);
  const [recoveredArtifact, setRecoveredArtifact] = useState<CandidateArtifact | null>(null);
  const retryController = useRef<AbortController | null>(null);
  const retryTimer = useRef<number | null>(null);
  const jobId = useRef<string | null>(null);
  const requestInFlight = useRef(false);
  const mounted = useRef(false);
  const artifact = analysis.state === "ready" ? analysis.artifact : recoveredArtifact;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrationReady(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryController.current?.abort();
      requestInFlight.current = false;
    };
  }, []);

  if (analysis.state === "unavailable") {
    return <p>Candidate analysis is unavailable.</p>;
  }

  async function activate(candidateIndex: number) {
    if (!artifact || artifact.savedItemId !== savedItemId) return;
    setPendingIndex(candidateIndex);
    try {
      const response = await fetch("/api/v1/practice/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          savedItemId,
          candidateArtifactId: artifact.artifactId,
          candidateIndex,
        }),
      });
      const body = apiSuccessSchema(PracticeTaskSchema).safeParse(await response.json());
      if (!response.ok || !body.success) throw new Error("activation failed");
      const returnTo = `/saved/${videoSourceId}#saved-item-${savedItemId}`;
      router.push(`/practice/${body.data.data.id}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch {
      setPendingIndex(null);
    }
  }

  function isCurrent(controller: AbortController) {
    return !controller.signal.aborted && mounted.current && retryController.current === controller;
  }

  function stopTimer() {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }

  function showReady(data: z.infer<typeof ReadyRecoverySchema>, controller: AbortController) {
    if (!isCurrent(controller)) return;
    setRecoveredArtifact({
      artifactId: data.artifactId,
      savedItemId: data.savedItemId,
      candidates: data.candidates,
    });
    setRecoveryState("idle");
  }

  function showTerminal(category: FailureCategory, controller: AbortController) {
    if (!isCurrent(controller)) return;
    stopTimer();
    setFailureCategory(category);
    setRecoveryState("terminal");
  }

  function failRecovery(controller: AbortController) {
    if (!isCurrent(controller)) return;
    stopTimer();
    setRecoveryState("error");
  }

  function schedulePoll(controller: AbortController, ownerBoundJobId: string, elapsedMs: number) {
    const delay = elapsedMs < BACKGROUND_AFTER_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void poll(controller, ownerBoundJobId, elapsedMs + delay);
    }, delay);
  }

  async function poll(controller: AbortController, ownerBoundJobId: string, elapsedMs: number): Promise<void> {
    if (!isCurrent(controller)) return;
    try {
      const response = await fetch(
        `/api/v1/saved-items/${savedItemId}/candidates?jobId=${encodeURIComponent(ownerBoundJobId)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        },
      );
      const parsedResponse = PollSchema.safeParse(await response.json());
      if (!response.ok || !parsedResponse.success) throw new Error("candidate poll failed");
      if (!isCurrent(controller)) return;
      const data = parsedResponse.data.data;
      if (data.state === "ready") {
        showReady(data, controller);
        return;
      }
      if (data.state === "gateway_required") {
        setRecoveryState("gateway");
        return;
      }
      if (data.state === "failed") {
        if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
        showTerminal(data.failureCategory, controller);
        return;
      }
      if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
      if (elapsedMs >= STOP_POLLING_AFTER_MS) {
        setRecoveryState("queued");
        return;
      }
      if (elapsedMs >= BACKGROUND_AFTER_MS) setRecoveryState("background");
      schedulePoll(controller, ownerBoundJobId, elapsedMs);
    } catch {
      failRecovery(controller);
    }
  }

  async function requestAnalysis(terminalRetry: boolean) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    stopTimer();
    retryController.current?.abort();
    const controller = new AbortController();
    retryController.current = controller;
    setRecoveryState("pending");

    try {
      const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: terminalRetry ? JSON.stringify({ retryId: crypto.randomUUID() }) : "{}",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const parsedResponse = RecoverySchema.safeParse(await response.json());
      if (!response.ok || !parsedResponse.success) throw new Error("recovery failed");
      if (!isCurrent(controller)) return;
      const data = parsedResponse.data.data;
      if (data.state === "ready") {
        showReady(data, controller);
        return;
      }
      if (data.state === "gateway_required") {
        setRecoveryState("gateway");
        return;
      }
      if (data.state === "failed") {
        jobId.current = data.jobId;
        showTerminal(data.failureCategory, controller);
        return;
      }
      jobId.current = data.jobId;
      schedulePoll(controller, data.jobId, 0);
    } catch {
      failRecovery(controller);
    } finally {
      if (retryController.current === controller) requestInFlight.current = false;
    }
  }

  async function checkStatus() {
    const ownerBoundJobId = jobId.current;
    if (!ownerBoundJobId || requestInFlight.current) return;
    requestInFlight.current = true;
    retryController.current?.abort();
    const controller = new AbortController();
    retryController.current = controller;
    setRecoveryState("checking");
    try {
      const response = await fetch(
        `/api/v1/saved-items/${savedItemId}/candidates?jobId=${encodeURIComponent(ownerBoundJobId)}`,
        { method: "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal },
      );
      const parsedResponse = PollSchema.safeParse(await response.json());
      if (!response.ok || !parsedResponse.success) throw new Error("candidate status failed");
      if (!isCurrent(controller)) return;
      const data = parsedResponse.data.data;
      if (data.state === "ready") showReady(data, controller);
      else if (data.state === "gateway_required") setRecoveryState("gateway");
      else if (data.state === "failed") {
        if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
        showTerminal(data.failureCategory, controller);
      } else {
        if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
        setRecoveryState("queued");
      }
    } catch {
      failRecovery(controller);
    } finally {
      if (retryController.current === controller) requestInFlight.current = false;
    }
  }

  if (analysis.state === "missing" && !recoveredArtifact) {
    if (recoveryState === "gateway") {
      return (
        <section className={styles.analysisPanel} aria-label="Analysis status">
          <p className={styles.analysisMessage} role="status">
            Analysis needs an active model gateway. Your saved material remains available.
          </p>
          <Link className={styles.analysisAction} href="/settings/model-gateway">Set up model gateway</Link>
        </section>
      );
    }
    const pending = recoveryState === "pending" || recoveryState === "background" || recoveryState === "checking";
    const terminal = recoveryState === "terminal";
    const queued = recoveryState === "queued" || recoveryState === "checking";
    const message = recoveryState === "background"
      ? "Still analyzing in the background"
      : queued
        ? "Still queued"
        : pending
          ? "Analyzing this expression and preparing it for practice…"
          : "Choose a saved expression you want to learn, then click Analyze.";
    return (
      <section className={styles.analysisPanel} aria-label="Analysis status">
        {terminal
          ? <p className={styles.analysisMessage} role="alert">{terminalFailureMessage(failureCategory!)}</p>
          : recoveryState === "error"
          ? <p className={styles.analysisMessage} role="alert">Analysis is taking longer than expected. Try again.</p>
          : (
              <div className={styles.analysisMessage}>
                {pending
                  ? <span className={styles.activityIndicator} role="progressbar" aria-label="Analysis in progress" />
                  : null}
                <p role="status">
                  {message}
                </p>
              </div>
            )}
        <button
          className={styles.analysisAction}
          type="button"
          disabled={pending}
          onClick={queued
            ? () => { void checkStatus(); }
            : terminal
              ? () => { void requestAnalysis(true); }
              : () => { void requestAnalysis(false); }}
        >
          {recoveryState === "checking"
            ? "Checking…"
            : queued
              ? "Check status"
              : pending
                ? "Analyzing…"
                : terminal || recoveryState === "error"
                  ? "Retry analysis"
                  : "Analyze"}
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Candidate expressions">
      <h3>Candidate expressions</h3>
      {artifact!.candidates.map((candidate, index) => (
        <CandidateExpressionCard
          key={`${candidate.expression}-${index}`}
          candidate={candidate}
          canonicalUrl={youtubeUrl}
          disabled={!hydrationReady || pendingIndex !== null}
          activating={pendingIndex === index}
          onUse={() => void activate(index)}
        />
      ))}
    </section>
  );
}
