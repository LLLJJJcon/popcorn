"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { CandidateExpressionListSchema } from "@/contracts/knowledge";
import { PracticeTaskSchema } from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";
import { CandidateExpressionCard } from "./candidate-expression";

const ArtifactContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema });

type CandidateArtifact = {
  readonly artifactId: string;
  readonly savedItemId: string;
  readonly content: unknown;
};

const RecoverySchema = apiSuccessSchema(z.discriminatedUnion("state", [
  z.strictObject({ state: z.literal("gateway_required") }),
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
  artifact,
}: {
  readonly savedItemId: string;
  readonly youtubeUrl: string;
  readonly artifact: CandidateArtifact | null;
}) {
  const router = useRouter();
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [recoveryState, setRecoveryState] = useState<"idle" | "pending" | "gateway" | "error">("idle");
  const parsed = artifact?.savedItemId === savedItemId
    ? ArtifactContentSchema.safeParse(artifact.content)
    : null;
  const candidates = parsed?.success ? parsed.data.candidates : null;

  if (artifact && !candidates) {
    return <p>Candidate analysis is unavailable.</p>;
  }

  async function activate(candidateIndex: number) {
    if (!artifact || !parsed?.success) return;
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
      setRecoveryState(parsedResponse.data.data.state === "gateway_required" ? "gateway" : "pending");
    } catch {
      setRecoveryState("error");
    }
  }

  if (!artifact) {
    return (
      <section aria-label="Candidate expressions">
        <p>{recoveryState === "gateway"
          ? "Configure a model gateway to organize this save."
          : recoveryState === "error"
            ? "Candidate processing could not be started. Your saved material remains available."
            : "Expressions are still being organized. Your saved material remains available."}</p>
        <button type="button" disabled={recoveryState === "pending"} onClick={retry}>
          Retry organizing
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Candidate expressions">
      <h3>Candidate expressions</h3>
      {candidates!.map((candidate, index) => (
        <CandidateExpressionCard
          key={`${candidate.expression}-${index}`}
          candidate={candidate}
          canonicalUrl={youtubeUrl}
          disabled={pendingIndex !== null}
          onUse={() => void activate(index)}
        />
      ))}
    </section>
  );
}
