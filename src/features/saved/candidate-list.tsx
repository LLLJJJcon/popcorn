"use client";

import { useEffect, useState } from "react";
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

const RecoverySchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
  z.strictObject({
    state: z.literal("ready"),
    artifactId: z.string().uuid(),
    savedItemId: z.string().uuid(),
    youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
    canonicalUrl: z.url(),
    candidates: CandidateExpressionListSchema,
  }),
  z.strictObject({
    state: z.literal("processing"),
    jobId: z.string().uuid(),
    status: z.string().trim().min(1).max(100),
    created: z.boolean(),
  }),
]));

export function CandidateList({
  savedItemId,
  youtubeUrl,
  analysis,
}: {
  readonly savedItemId: string;
  readonly youtubeUrl: string;
  readonly analysis: CandidateAnalysis;
}) {
  const router = useRouter();
  const [hydrationReady, setHydrationReady] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<"idle" | "pending" | "gateway" | "error">("idle");
  const artifact = analysis.state === "ready" ? analysis.artifact : null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setHydrationReady(true), 0);
    return () => window.clearTimeout(timeoutId);
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
      router.push(`/practice/${body.data.data.id}`);
    } catch {
      setPendingIndex(null);
    }
  }

  async function retry() {
    setRecoveryState("pending");
    try {
      const response = await fetch(`/api/v1/saved-items/${savedItemId}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const parsedResponse = RecoverySchema.safeParse(await response.json());
      if (!response.ok || !parsedResponse.success) throw new Error("recovery failed");
      if (parsedResponse.data.data.state === "ready") {
        router.refresh();
        return;
      }
      setRecoveryState(parsedResponse.data.data.state === "gateway_required" ? "gateway" : "pending");
    } catch {
      setRecoveryState("error");
    }
  }

  if (analysis.state === "missing") {
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
          ? <p role="alert">Analysis could not be started. Try again.</p>
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
          onUse={() => void activate(index)}
        />
      ))}
    </section>
  );
}
