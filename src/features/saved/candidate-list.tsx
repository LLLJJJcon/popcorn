"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { CandidateExpressionListSchema, type CandidateExpression } from "@/contracts/knowledge";
import { PracticeTaskSchema } from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";
import { CandidateExpressionCard } from "./candidate-expression";

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

const RecoverySchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  ReadyRecoverySchema,
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: z.string().trim().min(1).max(100),
    created: z.boolean(),
  }),
]));

const PollSchema = apiSuccessSchema(z.discriminatedUnion("state", [
  ReadyRecoverySchema,
  z.strictObject({ state: z.literal("processing") }),
]));

const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_ATTEMPTS = 60;

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
  const [recoveryState, setRecoveryState] = useState<"idle" | "pending" | "gateway" | "error">("idle");
  const [recoveredArtifact, setRecoveredArtifact] = useState<CandidateArtifact | null>(null);
  const retryController = useRef<AbortController | null>(null);
  const retryTimer = useRef<number | null>(null);
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

  async function retry() {
    retryController.current?.abort();
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    const controller = new AbortController();
    retryController.current = controller;
    setRecoveryState("pending");

    const failRecovery = () => {
      if (!controller.signal.aborted && mounted.current && retryController.current === controller) {
        setRecoveryState("error");
      }
    };

    const poll = async (attempt: number): Promise<void> => {
      if (controller.signal.aborted) return;
      try {
        const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const parsedResponse = PollSchema.safeParse(await response.json());
        if (!response.ok || !parsedResponse.success) throw new Error("candidate poll failed");
        if (controller.signal.aborted || !mounted.current || retryController.current !== controller) return;
        if (parsedResponse.data.data.state === "ready") {
          setRecoveredArtifact({
            artifactId: parsedResponse.data.data.artifactId,
            savedItemId: parsedResponse.data.data.savedItemId,
            candidates: parsedResponse.data.data.candidates,
          });
          setRecoveryState("idle");
          return;
        }
        if (attempt >= MAX_POLL_ATTEMPTS) {
          setRecoveryState("error");
          return;
        }
        retryTimer.current = window.setTimeout(() => { void poll(attempt + 1); }, POLL_INTERVAL_MS);
      } catch {
        failRecovery();
      }
    };

    try {
      const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
        signal: controller.signal,
      });
      const parsedResponse = RecoverySchema.safeParse(await response.json());
      if (!response.ok || !parsedResponse.success) throw new Error("recovery failed");
      if (parsedResponse.data.data.state === "ready") {
        if (!controller.signal.aborted && mounted.current && retryController.current === controller) {
          setRecoveredArtifact({
            artifactId: parsedResponse.data.data.artifactId,
            savedItemId: parsedResponse.data.data.savedItemId,
            candidates: parsedResponse.data.data.candidates,
          });
          setRecoveryState("idle");
        }
        return;
      }
      if (parsedResponse.data.data.state === "gateway_required") {
        if (!controller.signal.aborted && mounted.current && retryController.current === controller) setRecoveryState("gateway");
        return;
      }
      if (parsedResponse.data.data.status.endsWith("failed")) {
        failRecovery();
        return;
      }
      retryTimer.current = window.setTimeout(() => { void poll(1); }, POLL_INTERVAL_MS);
    } catch {
      failRecovery();
    }
  }

  if (analysis.state === "missing" && !recoveredArtifact) {
    if (recoveryState === "gateway") {
      return (
        <section aria-label="Candidate expressions">
          <p>Analysis needs an active model gateway. Your saved material remains available.</p>
          <Link href="/settings/model-gateway">Set up model gateway</Link>
        </section>
      );
    }
    return (
      <section aria-label="Candidate expressions">
        {recoveryState === "error"
          ? <p role="alert">Analysis is taking longer than expected. Try again.</p>
          : <p>Expressions are still being organized. Your saved material remains available.</p>}
        <button type="button" disabled={recoveryState === "pending"} onClick={retry}>
          {recoveryState === "pending" ? "Starting analysis…" : "Retry analysis"}
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
