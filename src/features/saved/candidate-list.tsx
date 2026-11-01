"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { CandidateExpressionListSchema, HighlightAnalysisStateSchema, type HighlightAnalysisState, type CandidateExpression } from "@/contracts/knowledge";
import { postPractice, PracticeRequestError } from "@/features/practice/api";
import { PracticeActivationResponseSchema } from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";
import { DeleteSavedExpression } from "./delete-saved-expression";
import { expressionRemovalKey } from "./expression-removal-key";
import { CandidateExpressionCard } from "./candidate-expression";
import { HighlightEditor } from "./highlight-editor";
import type { HighlightStatus, SavedHighlight } from "@/contracts/highlights";
import type { SavedItemView } from "./api";
import styles from "./saved-workspace.module.css";

export type CandidateArtifact = {
  readonly artifactId: string;
  readonly savedItemId: string;
  readonly candidates: readonly CandidateExpression[];
  readonly promptVersion?: string;
  readonly highlightStates?: readonly HighlightAnalysisState[];
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
  promptVersion: z.string().optional(),
  highlightStates: z.array(HighlightAnalysisStateSchema).optional(),
});

const PublicFailureCategorySchema = z.enum(["model_unavailable", "model_output", "internal"]);
const ProcessingStatusSchema = z.enum(["pending", "leased"]);

const FailedRecoverySchema = z.strictObject({
  state: z.literal("failed"),
  jobId: z.string().uuid(),
  failureCategory: PublicFailureCategorySchema,
  highlightStates: z.array(HighlightAnalysisStateSchema).optional(),
});

const RecoverySchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  z.strictObject({ state: z.literal("idle"), highlightStates: z.array(HighlightAnalysisStateSchema).optional() }),
  ReadyRecoverySchema,
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: ProcessingStatusSchema,
    created: z.boolean(),
    artifact: z.object({ artifactId: z.string().uuid(), savedItemId: z.string().uuid(), candidates: CandidateExpressionListSchema, promptVersion: z.string().optional() }).nullable().optional(),
    highlightStates: z.array(HighlightAnalysisStateSchema).optional(),
  }),
  FailedRecoverySchema,
]));

const PollSchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  z.strictObject({ state: z.literal("idle"), highlightStates: z.array(HighlightAnalysisStateSchema).optional() }),
  ReadyRecoverySchema,
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: ProcessingStatusSchema,
    artifact: z.object({ artifactId: z.string().uuid(), savedItemId: z.string().uuid(), candidates: CandidateExpressionListSchema, promptVersion: z.string().optional() }).nullable().optional(),
    highlightStates: z.array(HighlightAnalysisStateSchema).optional(),
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
  item,
}: {
  readonly savedItemId: string;
  readonly videoSourceId: string;
  readonly youtubeUrl: string;
  readonly analysis: CandidateAnalysis;
  readonly item?: SavedItemView;
}) {
  const router = useRouter();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [highlights, setHighlights] = useState<readonly SavedHighlight[]>(item?.highlights ?? []);
  const [highlightStatus, setHighlightStatus] = useState<HighlightStatus | null>(item?.highlightStatus ?? null);
  const [highlightSource, setHighlightSource] = useState({ values: item?.highlights, status: item?.highlightStatus });
  const [highlightStates, setHighlightStates] = useState<readonly HighlightAnalysisState[]>(analysis.state === "ready" ? analysis.artifact.highlightStates ?? [] : []);
  const [activationError, setActivationError] = useState(false);
  const [activationGateway, setActivationGateway] = useState(false);
  const lastActivationIndex = useRef<number | null>(null);
  const editingEnabled = Boolean(item?.status === "ready" && item.kind !== "video" && item.targetSegments?.length);
  if (item?.highlights !== highlightSource.values || item?.highlightStatus !== highlightSource.status) {
    setHighlightSource({ values: item?.highlights, status: item?.highlightStatus });
    setHighlights(item?.highlights ?? []); setHighlightStatus(item?.highlightStatus ?? null);
  }
  const [locallyRemovedKeys, setLocallyRemovedKeys] = useState<readonly string[]>([]);
  const isRemoved = (candidate: CandidateExpression) => [...(item?.removedExpressionKeys ?? []), ...locallyRemovedKeys].includes(expressionRemovalKey(candidate));
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("idle");
  const [failureCategory, setFailureCategory] = useState<FailureCategory | null>(null);
  const [recoveredArtifact, setRecoveredArtifact] = useState<CandidateArtifact | null>(null);
  const retryController = useRef<AbortController | null>(null);
  const retryTimer = useRef<number | null>(null);
  const backgroundDeadlineTimer = useRef<number | null>(null);
  const stopDeadlineTimer = useRef<number | null>(null);
  const processingStartedAt = useRef<number | null>(null);
  const jobId = useRef<string | null>(null);
  const requestInFlight = useRef(false);
  const activationInFlight = useRef(false);
  const mounted = useRef(false);
  const artifact = recoveredArtifact ?? (analysis.state === "ready" ? analysis.artifact : null);
  const visibleCandidateCount = artifact?.candidates.filter(candidate => !isRemoved(candidate)).length ?? 0;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrationReady(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearRecoveryTimers();
      retryController.current?.abort();
      requestInFlight.current = false;
    };
  }, []);

  useEffect(() => {
    if (!editingEnabled || highlightStatus !== "pending") return;
    const timer = window.setInterval(() => router.refresh(), 1_500);
    return () => window.clearInterval(timer);
  }, [editingEnabled, highlightStatus, router]);

  useEffect(() => {
    if (!editingEnabled) return;
    const controller = new AbortController();
    retryController.current = controller;
    void (async () => {
      try {
        const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const parsed = PollSchema.safeParse(await response.json());
        if (!response.ok || !parsed.success || !isCurrent(controller)) return;
        const data = parsed.data.data;
        if (data.state === "ready") showReady(data, controller);
        else if (data.state === "processing") {
          if (data.artifact) setRecoveredArtifact(data.artifact);
          if (data.highlightStates) setHighlightStates(data.highlightStates);
          jobId.current = data.jobId; setRecoveryState("pending");
          startProcessingDeadlines(controller); schedulePoll(controller, data.jobId);
        } else if (data.state === "failed") {
          jobId.current = data.jobId;
          if (data.highlightStates) setHighlightStates(data.highlightStates);
          showTerminal(data.failureCategory, controller);
        }
      } catch { /* Initial recovery is progressive; explicit actions expose recoverable errors. */ }
    })();
    return () => controller.abort();
    // Recover once per saved item; highlight edits do not start analysis by themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedItemId, editingEnabled]);

  if (analysis.state === "unavailable" && !editingEnabled) {
    return <p>Candidate analysis is unavailable.</p>;
  }

  async function activate(candidateIndex: number) {
    if (!artifact || artifact.savedItemId !== savedItemId || activationInFlight.current) return;
    activationInFlight.current = true;
    setPendingIndex(candidateIndex);
    setActivationError(false);
    try {
      lastActivationIndex.current = candidateIndex;
      const activated = await postPractice("/api/v1/practice/tasks", { savedItemId, candidateArtifactId: artifact.artifactId, candidateIndex }, PracticeActivationResponseSchema);
      const returnTo = `/saved/${videoSourceId}#saved-item-${savedItemId}`;
      router.push("redirect" in activated ? activated.redirect : `/practice/${activated.id}?returnTo=${encodeURIComponent(returnTo)}`);
    } catch (caught) {
      setActivationGateway(caught instanceof PracticeRequestError && caught.code === "MODEL_GATEWAY_CONFIGURATION_REQUIRED");
      setActivationError(true);
      setPendingIndex(null);
    } finally { activationInFlight.current = false; }
  }

  function isCurrent(controller: AbortController) {
    return !controller.signal.aborted && mounted.current && retryController.current === controller;
  }

  function clearRecoveryTimers() {
    if (retryTimer.current !== null) {
      window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    if (backgroundDeadlineTimer.current !== null) {
      window.clearTimeout(backgroundDeadlineTimer.current);
      backgroundDeadlineTimer.current = null;
    }
    if (stopDeadlineTimer.current !== null) {
      window.clearTimeout(stopDeadlineTimer.current);
      stopDeadlineTimer.current = null;
    }
    processingStartedAt.current = null;
  }

  function startProcessingDeadlines(controller: AbortController) {
    clearRecoveryTimers();
    processingStartedAt.current = Date.now();
    backgroundDeadlineTimer.current = window.setTimeout(() => {
      backgroundDeadlineTimer.current = null;
      if (isCurrent(controller)) setRecoveryState("background");
    }, BACKGROUND_AFTER_MS);
    stopDeadlineTimer.current = window.setTimeout(() => {
      stopDeadlineTimer.current = null;
      if (!isCurrent(controller)) return;
      clearRecoveryTimers();
      setRecoveryState("queued");
      controller.abort();
    }, STOP_POLLING_AFTER_MS);
  }

  function showReady(data: z.infer<typeof ReadyRecoverySchema>, controller: AbortController) {
    if (!isCurrent(controller)) return;
    clearRecoveryTimers();
    setRecoveredArtifact({
      artifactId: data.artifactId,
      savedItemId: data.savedItemId,
      candidates: data.candidates,
      promptVersion: data.promptVersion,
      highlightStates: data.highlightStates,
    });
    setHighlightStates(data.highlightStates ?? []);
    setRecoveryState("idle");
  }

  function showTerminal(category: FailureCategory, controller: AbortController) {
    if (!isCurrent(controller)) return;
    clearRecoveryTimers();
    setFailureCategory(category);
    setRecoveryState("terminal");
  }

  function failRecovery(controller: AbortController) {
    if (!isCurrent(controller)) return;
    clearRecoveryTimers();
    setRecoveryState("error");
  }

  function schedulePoll(controller: AbortController, ownerBoundJobId: string) {
    const elapsedMs = Math.max(0, Date.now() - (processingStartedAt.current ?? Date.now()));
    const delay = elapsedMs < BACKGROUND_AFTER_MS ? FAST_POLL_INTERVAL_MS : SLOW_POLL_INTERVAL_MS;
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null;
      void poll(controller, ownerBoundJobId);
    }, delay);
  }

  async function poll(controller: AbortController, ownerBoundJobId: string): Promise<void> {
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
      if (data.state === "idle") { clearRecoveryTimers(); setRecoveryState("idle"); return; }
      if (data.state === "gateway_required") {
        clearRecoveryTimers();
        setRecoveryState("gateway");
        return;
      }
      if (data.state === "failed") {
        if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
        if (data.highlightStates) setHighlightStates(data.highlightStates);
        showTerminal(data.failureCategory, controller);
        return;
      }
      if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
      schedulePoll(controller, ownerBoundJobId);
    } catch {
      failRecovery(controller);
    }
  }

  async function requestAnalysis(terminalRetry: boolean, retryHighlightId?: string) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    clearRecoveryTimers();
    retryController.current?.abort();
    const controller = new AbortController();
    retryController.current = controller;
    setRecoveryState("pending");

    try {
      const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: retryHighlightId ? JSON.stringify({ highlightId: retryHighlightId, retryId: crypto.randomUUID() }) : terminalRetry ? JSON.stringify({ retryId: crypto.randomUUID() }) : editingEnabled ? undefined : "{}",
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
      if (data.state === "idle") { clearRecoveryTimers(); setRecoveryState("idle"); return; }
      if (data.state === "gateway_required") {
        clearRecoveryTimers();
        setRecoveryState("gateway");
        return;
      }
      if (data.state === "failed") {
        jobId.current = data.jobId;
        if (data.highlightStates) setHighlightStates(data.highlightStates);
        showTerminal(data.failureCategory, controller);
        return;
      }
      jobId.current = data.jobId;
      if (data.artifact) setRecoveredArtifact(data.artifact);
      if (data.highlightStates) setHighlightStates(data.highlightStates);
      startProcessingDeadlines(controller);
      schedulePoll(controller, data.jobId);
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
      else if (data.state === "idle") setRecoveryState("idle");
      else if (data.state === "failed") {
        if (data.jobId !== ownerBoundJobId) throw new Error("candidate job mismatch");
        if (data.highlightStates) setHighlightStates(data.highlightStates);
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

  if (editingEnabled && item?.targetSegments) {
    const pending = ["pending", "background", "checking"].includes(recoveryState);
    const queued = recoveryState === "queued" || recoveryState === "checking";
    const analyzed = (highlight: SavedHighlight) => artifact?.candidates.some(candidate => candidate.highlightId === highlight.id || candidate.highlightKey === JSON.stringify([highlight.startSegmentId, highlight.startOffset, highlight.endSegmentId, highlight.endOffset, highlight.text]));
    const remaining = highlights.filter(highlight => !analyzed(highlight)).length;
    const disabledReason = highlights.length === 0 ? "Mark at least one expression" : remaining === 0 ? "All marked expressions are analyzed" : undefined;
    const message = recoveryState === "background" ? "Still analyzing in the background"
      : queued ? "Still queued"
      : pending ? "Creating your learning cards…"
      : remaining ? `${remaining} marked ${remaining === 1 ? "expression is" : "expressions are"} ready to analyze.`
      : highlights.length ? "Your marked expressions have learning cards."
      : artifact?.candidates.length ? "Learning cards ready. Mark more words to add expressions."
      : "Mark an expression to get started.";
    return (
      <section aria-label="Expression learning workspace">
        <HighlightEditor savedItemId={savedItemId} segments={item.targetSegments} highlights={highlights} highlightStatus={highlightStatus} gatewayAvailable={item.gatewayAvailable} onChange={(next, status) => { setHighlights(next); setHighlightStatus(status); router.refresh(); }} />
        {item.englishTranslation ? <p className={styles.translation}>{item.englishTranslation}</p> : null}
        <div className={styles.analysisPanel} aria-label="Analysis status">
          <div className={styles.analysisMessage}>{pending ? <span className={styles.activityIndicator} role="progressbar" aria-label="Analysis in progress" /> : null}<p role="status">{message}</p></div>
          <span title={disabledReason} tabIndex={disabledReason ? 0 : undefined} aria-label={disabledReason}><button className={styles.analysisAction} type="button" disabled={!hydrationReady || pending || Boolean(disabledReason)} onClick={() => { void requestAnalysis(recoveryState === "terminal" || recoveryState === "error"); }}>Analyze</button></span>
        </div>
        {queued ? <button type="button" className={styles.inlineAction} onClick={() => void checkStatus()} disabled={recoveryState === "checking"}>{recoveryState === "checking" ? "Checking…" : "Check status"}</button> : null}
        {recoveryState === "gateway" ? <p className={styles.analysisMessage}>An active gateway is needed to create cards. <Link href="/settings/model-gateway">Set up model gateway</Link></p> : null}
        {recoveryState === "terminal" || recoveryState === "error" ? <p className={styles.editorError} role="alert">{recoveryState === "terminal" && failureCategory ? terminalFailureMessage(failureCategory) : "Analysis is taking longer than expected. Try again."}</p> : null}
        {artifact?.candidates.length ? <div className={styles.expressionGroup}><div className={styles.expressionGroupHeading}><h3>Learning cards</h3><span>{visibleCandidateCount} {visibleCandidateCount === 1 ? "expression" : "expressions"}</span></div><div className={styles.expressionGrid}>{visibleCandidateCount===0?<p className={styles.sourceGuidance}>No learning cards here. Mark another expression to keep learning.</p>:null}{artifact.candidates.map((candidate, index) => isRemoved(candidate) ? null : <CandidateExpressionCard key={`${candidate.highlightKey ?? candidate.expression}-${index}`} candidate={candidate} canonicalUrl={youtubeUrl} disabled={!hydrationReady || pendingIndex !== null} activating={pendingIndex === index} onUse={() => void activate(index)} deleteAction={<DeleteSavedExpression savedItemId={savedItemId} artifactId={artifact!.artifactId} index={index} expression={candidate.expression} disabled={!hydrationReady || pendingIndex !== null} onDeleted={key=>setLocallyRemovedKeys(current=>[...current,key])}/>} />)}</div></div> : null}
        {highlightStates.filter(state => state.status === "failed" && highlights.some(highlight => highlight.id === state.highlightId)).map(state => <div className={styles.failedHighlight} key={state.highlightId}><div><strong lang="zh-CN">{state.text}</strong><p>Couldn&apos;t analyze this one</p></div><button className={styles.inlineAction} type="button" disabled={pending} onClick={() => void requestAnalysis(true, state.highlightId)}>Try again</button></div>)}
        {activationError ? <p className={styles.editorError} role="alert">{activationGateway ? <>Connect a model to continue. <Link href="/settings/model-gateway">Set up model gateway</Link></> : <>We couldn&apos;t prepare a situation. <button type="button" className={styles.inlineAction} disabled={pendingIndex !== null} onClick={() => { if (lastActivationIndex.current !== null) void activate(lastActivationIndex.current); }}>Try again</button></>}</p> : null}
      </section>
    );
  }

  if (item && !editingEnabled && !artifact) {
    if (item.kind === "video") return <p className={styles.sourceGuidance}>Save a subtitle or expression from this video to create a learning card.</p>;
    if (item.status !== "ready") return <p className={styles.sourceGuidance}>Learning cards will be available when the subtitles are ready.</p>;
    return <section className={styles.analysisPanel} aria-label="Analysis status"><p className={styles.analysisMessage}>The source subtitle is unavailable. Open this moment on YouTube to save the line again.</p><span title="Mark at least one expression"><button className={styles.analysisAction} type="button" disabled>Analyze</button></span></section>;
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
    <section className={styles.expressionGroup} aria-label="Candidate expressions">
      <div className={styles.expressionGroupHeading}>
        <h3>Learning cards</h3>
        <span>{visibleCandidateCount} {visibleCandidateCount === 1 ? "expression" : "expressions"}</span>
      </div>
      {activationError ? <p className={styles.editorError} role="alert">{activationGateway ? <>Connect a model to continue. <Link href="/settings/model-gateway">Set up model gateway</Link></> : <>We couldn&apos;t prepare a situation. <button type="button" className={styles.inlineAction} disabled={pendingIndex !== null} onClick={() => { if (lastActivationIndex.current !== null) void activate(lastActivationIndex.current); }}>Try again</button></>}</p> : null}
      <div className={styles.expressionGrid}>
        {visibleCandidateCount===0?<p className={styles.sourceGuidance}>No learning cards here. Mark another expression to keep learning.</p>:null}
        {artifact!.candidates.map((candidate, index) => isRemoved(candidate) ? null : (
          <CandidateExpressionCard
            key={`${candidate.expression}-${index}`}
            candidate={candidate}
            canonicalUrl={youtubeUrl}
            disabled={!hydrationReady || pendingIndex !== null}
            activating={pendingIndex === index}
            onUse={() => void activate(index)} deleteAction={<DeleteSavedExpression savedItemId={savedItemId} artifactId={artifact!.artifactId} index={index} expression={candidate.expression} disabled={!hydrationReady || pendingIndex !== null} onDeleted={key=>setLocallyRemovedKeys(current=>[...current,key])}/>}
          />
        ))}
      </div>
    </section>
  );
}
