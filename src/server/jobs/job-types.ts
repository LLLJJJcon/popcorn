import { createHash } from "node:crypto";

import { z } from "zod";

import { CandidateExpressionListSchema, type CandidateExpression } from "@/contracts/knowledge";
import type { SavedItemKind } from "@/contracts/source";
import type { SavedItemAnalysisWire } from "@/server/ai/prompts/analyze-saved-item.v1";
import { createJobResultKey } from "@/server/domain/lease-job";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const SavedItemAnalysisKeyInputSchema = z.strictObject({
  sourceHash: Sha256Schema,
  savedItemId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  promptVersion: z.string().trim().min(1).max(100),
  gatewayFingerprint: Sha256Schema,
  retryId: z.string().uuid().optional(),
});

export function createSavedItemAnalysisJobKey(value: z.input<typeof SavedItemAnalysisKeyInputSchema>) {
  const input = SavedItemAnalysisKeyInputSchema.parse(value);
  const savedItemHash = createHash("sha256")
    .update(JSON.stringify({
      savedItemId: input.savedItemId,
      snapshotId: input.snapshotId,
      ...(input.retryId ? { retryId: input.retryId } : {}),
    }))
    .digest("hex");
  return createJobResultKey({
    jobType: "analyze_saved_item",
    sourceHash: input.sourceHash,
    savedItemHash,
    promptVersion: input.promptVersion,
    modelVersion: `gateway:${input.gatewayFingerprint}`,
  });
}

export const SavedItemAnalysisJobInputSchema = z.strictObject({
  kind: z.literal("analyze_saved_item"),
  savedItemId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  transcriptHash: Sha256Schema,
  promptVersion: z.string().trim().min(1).max(100),
  gatewayConfigId: z.string().uuid(),
  gatewayRevision: z.number().int().positive(),
  gatewayFingerprint: Sha256Schema,
});

export type SavedItemAnalysisEvidence = {
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string;
  readonly snapshotId: string;
  readonly transcriptHash: string;
  readonly kind: SavedItemKind;
  readonly rawText: string;
  readonly startSeconds: number | null;
  readonly segments: readonly {
    readonly stableId: string;
    readonly originalChinese: string;
    readonly startSeconds: number;
    readonly endSeconds: number;
  }[];
};

export const SavedItemAnalysisContentSchema = z.strictObject({
  candidates: CandidateExpressionListSchema,
});

function exactOccurrenceCount(value: string, expression: string): number {
  let count = 0;
  let offset = 0;
  while (offset <= value.length - expression.length) {
    const found = value.indexOf(expression, offset);
    if (found < 0) break;
    count += 1;
    offset = found + Math.max(1, expression.length);
  }
  return count;
}

function groundedCandidate(
  candidate: SavedItemAnalysisWire["candidates"][number],
  evidence: SavedItemAnalysisEvidence,
): CandidateExpression | null {
  let indexes: readonly number[];
  if (candidate.sourceLineIndices === undefined) {
    const matches = evidence.segments.flatMap((segment, sourceLineIndex) =>
      Array.from(
        { length: exactOccurrenceCount(segment.originalChinese, candidate.expression) },
        () => sourceLineIndex,
      )
    );
    if (matches.length !== 1) return null;
    indexes = matches;
  } else {
    if (new Set(candidate.sourceLineIndices).size !== candidate.sourceLineIndices.length) {
      return null;
    }
    if (candidate.sourceLineIndices.some((index) => evidence.segments[index] === undefined)) {
      return null;
    }
    indexes = [...candidate.sourceLineIndices].sort((left, right) => left - right);
  }

  const segments = indexes.map((index) => evidence.segments[index]!);
  const evidenceText = segments.map((segment) => segment.originalChinese).join("\n");
  if (!evidenceText.includes(candidate.expression)) return null;
  return {
    expression: candidate.expression,
    englishMeaning: candidate.englishMeaning,
    englishExplanation: candidate.englishExplanation,
    tone: candidate.tone,
    communicativeFunction: candidate.communicativeFunction,
    register: candidate.register,
    evidenceText,
    segmentIds: segments.map((segment) => segment.stableId),
    startSeconds: Math.min(...segments.map((segment) => segment.startSeconds)),
    endSeconds: Math.max(...segments.map((segment) => segment.endSeconds)),
    confidence: candidate.confidence ?? 0.5,
  };
}

export function groundSavedItemAnalysisContent(
  value: SavedItemAnalysisWire,
  evidence: SavedItemAnalysisEvidence,
) {
  const candidates = value.candidates
    .map((candidate) => groundedCandidate(candidate, evidence))
    .filter((candidate): candidate is CandidateExpression => candidate !== null);
  if (candidates.length === 0) {
    throw new Error("candidate sourceLineIndices do not resolve to exact persisted evidence");
  }
  return SavedItemAnalysisContentSchema.parse({ candidates });
}

export function validateSavedItemAnalysisContent(
  value: unknown,
  evidence: SavedItemAnalysisEvidence,
) {
  const parsed = SavedItemAnalysisContentSchema.parse(value);
  const segmentsById = new Map(
    evidence.segments.map((segment, position) => [segment.stableId, { segment, position }]),
  );

  for (const candidate of parsed.candidates) {
    if (new Set(candidate.segmentIds).size !== candidate.segmentIds.length) {
      throw new Error("candidate evidence segment IDs must be unique");
    }
    const referenced = candidate.segmentIds.map((id) => segmentsById.get(id));
    if (referenced.some((entry) => !entry)) {
      throw new Error("candidate references unknown persisted evidence");
    }
    const exact = referenced as {
      readonly segment: SavedItemAnalysisEvidence["segments"][number];
      readonly position: number;
    }[];
    if (exact.some((entry, index) => index > 0 && entry.position <= exact[index - 1].position)) {
      throw new Error("candidate evidence segment IDs must follow persisted transcript position order");
    }
    const context = exact.map((entry) => entry.segment.originalChinese).join("\n");
    if (
      !context.includes(candidate.evidenceText) ||
      !candidate.evidenceText.includes(candidate.expression)
    ) {
      throw new Error("candidate text is not exact persisted Chinese evidence");
    }
    if (
      candidate.startSeconds !== Math.min(...exact.map((entry) => entry.segment.startSeconds)) ||
      candidate.endSeconds !== Math.max(...exact.map((entry) => entry.segment.endSeconds))
    ) {
      throw new Error("candidate timestamps do not match referenced evidence");
    }
  }

  return parsed;
}
