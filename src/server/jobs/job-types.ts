import { createHash } from "node:crypto";

import { z } from "zod";

import { CandidateExpressionListSchema } from "@/contracts/knowledge";
import type { SavedItemKind } from "@/contracts/source";
import { createJobResultKey } from "@/server/domain/lease-job";

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

const SavedItemAnalysisKeyInputSchema = z.strictObject({
  sourceHash: Sha256Schema,
  savedItemId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  promptVersion: z.string().trim().min(1).max(100),
  gatewayFingerprint: Sha256Schema,
});

export function createSavedItemAnalysisJobKey(value: z.input<typeof SavedItemAnalysisKeyInputSchema>) {
  const input = SavedItemAnalysisKeyInputSchema.parse(value);
  const savedItemHash = createHash("sha256")
    .update(JSON.stringify({
      savedItemId: input.savedItemId,
      snapshotId: input.snapshotId,
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

const compactChinese = (value: string) => value.normalize("NFKC").replace(/\s+/gu, "");

export function validateSavedItemAnalysisContent(
  value: unknown,
  evidence: SavedItemAnalysisEvidence,
) {
  const parsed = SavedItemAnalysisContentSchema.parse(value);
  const segmentsById = new Map(
    evidence.segments.map((segment) => [segment.stableId, segment]),
  );

  for (const candidate of parsed.candidates) {
    if (new Set(candidate.segmentIds).size !== candidate.segmentIds.length) {
      throw new Error("candidate evidence segment IDs must be unique");
    }
    const referenced = candidate.segmentIds.map((id) => segmentsById.get(id));
    if (referenced.some((segment) => !segment)) {
      throw new Error("candidate references unknown persisted evidence");
    }
    const exact = referenced as SavedItemAnalysisEvidence["segments"][number][];
    const context = compactChinese(exact.map((segment) => segment.originalChinese).join("\n"));
    const evidenceText = compactChinese(candidate.evidenceText);
    if (!context.includes(evidenceText) || !evidenceText.includes(compactChinese(candidate.expression))) {
      throw new Error("candidate text is not exact persisted Chinese evidence");
    }
    if (
      candidate.startSeconds !== Math.min(...exact.map((segment) => segment.startSeconds)) ||
      candidate.endSeconds !== Math.max(...exact.map((segment) => segment.endSeconds))
    ) {
      throw new Error("candidate timestamps do not match referenced evidence");
    }
  }

  return parsed;
}
