import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import type { AnalysisLine } from "@/server/ai/prompts/highlight-expressions.v1";
import { LegacyUpgradeError, LegacyUpgradeSourceCandidateSchema, type LegacyUpgradeContext, type LegacyUpgradePlanRow, type LegacyUpgradeReason, type LegacyUpgradeRequest, type LegacyUpgradeSourceCandidate } from "@/server/contracts/legacy-learning-card-upgrade";

function proveSource(source: LegacyUpgradeSourceCandidate, expression: string): LegacyUpgradeReason | null {
  if (!LegacyUpgradeSourceCandidateSchema.safeParse(source).success || !expression.trim()) return "EVIDENCE_MISMATCH";
  const ordered = [...source.segments].sort((a, b) => a.position - b.position);
  if (new Set(ordered.map(s => s.stableId)).size !== ordered.length || new Set(ordered.map(s => s.position)).size !== ordered.length || ordered.some(s => s.endSeconds < s.startSeconds)) return "EVIDENCE_MISMATCH";
  const targets = ordered.filter(s => s.target);
  if (!targets.length || targets.length !== source.segmentIds.length || targets.some((s, i) => s.stableId !== source.segmentIds[i] || (i > 0 && s.position !== targets[i - 1]!.position + 1)) || targets.map(s => s.text).join("\n") !== source.evidenceText || targets[0]!.startSeconds !== source.startSeconds || targets.at(-1)!.endSeconds !== source.endSeconds) return "EVIDENCE_MISMATCH";
  const start = source.evidenceText.indexOf(expression);
  if (start < 0) return "EVIDENCE_MISMATCH";
  if (source.evidenceText.indexOf(expression, start + 1) >= 0) return "SOURCE_AMBIGUOUS";
  return null;
}
function selectSource(context: LegacyUpgradeContext) {
  const ordered = [...context.sources].sort((a, b) => Number(b.savedItemId === context.originalSavedItemId && context.originalSavedItemId !== null) - Number(a.savedItemId === context.originalSavedItemId && context.originalSavedItemId !== null) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.occurrenceId.localeCompare(b.occurrenceId));
  return ordered.find(source => proveSource(source, context.expression) === null);
}

/** Association/ownership and opaque hashes come from the repository's exact receipt proof. */
export function planLegacyLearningCardUpgrade(context: LegacyUpgradeContext): LegacyUpgradePlanRow {
  const blocked = (reason: LegacyUpgradeReason): LegacyUpgradePlanRow => ({ status: "blocked", senseId: context.senseId, reason });
  if (LearningCardFieldsSchema.safeParse(context.canonicalCard).success) return { status: "already_modern", senseId: context.senseId };
  if (!context.modernFieldsEmpty) return blocked("PARTIAL_METADATA");
  if (context.existingCard) {
    if (!LearningCardFieldsSchema.safeParse(context.existingCard.card).success) return blocked("CARD_CONFLICT");
    const card = context.existingCard;
    return { status: "eligible", senseId: context.senseId, target: { senseId: context.senseId, expectedBeforeHash: context.beforeHash, expectedEvidenceHash: card.evidenceHash, source: { kind: "existing_card", candidateKey: card.candidateKey, artifactId: card.artifactId, candidateIndex: card.candidateIndex } } };
  }
  if (context.sourceState !== "retained" || !context.sources.length) return blocked("SOURCE_UNAVAILABLE");
  const source = selectSource(context);
  if (!source) return blocked(context.sources.some(s => proveSource(s, context.expression) === "SOURCE_AMBIGUOUS") ? "SOURCE_AMBIGUOUS" : "EVIDENCE_MISMATCH");
  return { status: "eligible", senseId: context.senseId, target: { senseId: context.senseId, expectedBeforeHash: context.beforeHash, expectedEvidenceHash: source.evidenceHash, source: { kind: "source_occurrence", sourceId: source.sourceId, occurrenceId: source.occurrenceId, snapshotId: source.snapshotId } } };
}

export function buildLegacyUpgradePromptInput(context: LegacyUpgradeContext, request: LegacyUpgradeRequest): { lines: AnalysisLine[]; highlights: { id: string; text: string; line: number }[] } {
  const plan = planLegacyLearningCardUpgrade(context);
  if (plan.status !== "eligible" || plan.target.expectedBeforeHash !== request.expectedBeforeHash || plan.target.expectedEvidenceHash !== request.expectedEvidenceHash || plan.senseId !== request.senseId || request.source.kind !== "source_occurrence" || plan.target.source.kind !== "source_occurrence" || plan.target.source.sourceId !== request.source.sourceId || plan.target.source.snapshotId !== request.source.snapshotId || plan.target.source.occurrenceId !== request.source.occurrenceId) throw new LegacyUpgradeError("STALE_PLAN");
  const source = selectSource(context)!;
  const ordered = [...source.segments].sort((a, b) => a.position - b.position);
  const first = ordered.findIndex(s => s.target), last = ordered.findLastIndex(s => s.target);
  const selected = ordered.slice(Math.max(0, first - 3), last + 3);
  const lines = selected.map((segment, index): AnalysisLine => ({ line: index + 1, role: segment.target ? "TARGET" : "context", text: segment.text }));
  const prefix = source.evidenceText.slice(0, source.evidenceText.indexOf(context.expression));
  return { lines, highlights: [{ id: "h1", text: context.expression, line: lines.findIndex(line => line.role === "TARGET") + 1 + prefix.split("\n").length - 1 }] };
}
