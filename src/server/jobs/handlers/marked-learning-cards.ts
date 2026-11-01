import { ANALYZE_BATCH_SIZE, FORMAT_RETRY_MAX } from "@/server/domain/learning-config";
import { CandidateExpressionSchema, type CandidateExpression, type HighlightAnalysisState, type LearningCardFields } from "@/contracts/knowledge";
import type { SavedHighlight } from "@/contracts/highlights";
import { ModelGatewayError } from "@/server/ai/provider";
import {
  ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION,
  buildAnalyzeMarkedExpressionsPrompt,
  normalizeLearningCard,
  normalizeMarkedAnalysisWire,
} from "@/server/ai/prompts/analyze-saved-item.v3";
import type { AnalysisLine } from "@/server/ai/prompts/highlight-expressions.v1";
import { completeWithFormatRetries, type StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { SavedItemAnalysisEvidence } from "@/server/jobs/job-types";

/** Location + exact text outlives a removed/recreated highlight row. */
export function highlightIdentity(highlight: Pick<SavedHighlight, "startSegmentId" | "startOffset" | "endSegmentId" | "endOffset" | "text">): string {
  return JSON.stringify([highlight.startSegmentId, highlight.startOffset, highlight.endSegmentId, highlight.endOffset, highlight.text]);
}
export function candidateMatchesHighlight(candidate: CandidateExpression, highlight: SavedHighlight): boolean {
  return candidate.highlightKey === highlightIdentity(highlight) || candidate.highlightId === highlight.id;
}
function groundCard(fields: LearningCardFields, highlight: SavedHighlight, evidence: SavedItemAnalysisEvidence): CandidateExpression {
  const start = evidence.segments.findIndex((segment) => segment.stableId === highlight.startSegmentId);
  const end = evidence.segments.findIndex((segment) => segment.stableId === highlight.endSegmentId);
  if (start < 0 || end < start) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding");
  const segments = evidence.segments.slice(start, end + 1);
  const evidenceText = segments.map((segment) => segment.originalChinese).join("\n");
  if (!evidenceText.includes(highlight.text)) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding");
  return CandidateExpressionSchema.parse({
    expression: highlight.text, ...fields,
    // Compatibility projection for current practice and existing expression_senses consumers.
    englishMeaning: fields.meaningHere, englishExplanation: fields.useItWhen,
    tone: fields.toneAndWho, communicativeFunction: fields.functionCategories.join(", "),
    register: fields.usageSettings.join(", ") || "Context dependent",
    evidenceText, segmentIds: segments.map((segment) => segment.stableId),
    startSeconds: segments[0]!.startSeconds, endSeconds: segments.at(-1)!.endSeconds,
    highlightId: highlight.id, highlightKey: highlightIdentity(highlight),
  });
}
export function markedAnalysisLines(evidence: SavedItemAnalysisEvidence): AnalysisLine[] {
  const texts = [
    ...(evidence.contextBefore ?? []).slice(-3).map((text) => ({ role: "context" as const, text })),
    ...evidence.segments.map((segment) => ({ role: "TARGET" as const, text: segment.originalChinese })),
    ...(evidence.contextAfter ?? []).slice(0, 2).map((text) => ({ role: "context" as const, text })),
  ];
  return texts.map((entry, index) => ({ line: index + 1, ...entry }));
}

export async function generateMarkedLearningCards({ gateway, evidence, highlightIds }: {
  readonly gateway: StructuredJsonGateway;
  readonly evidence: SavedItemAnalysisEvidence;
  readonly highlightIds?: readonly string[];
}): Promise<{ candidates: CandidateExpression[]; highlightStates: HighlightAnalysisState[] }> {
  const candidates = [...(evidence.existingCandidates ?? [])];
  const active = (evidence.highlights ?? []).filter((highlight) => highlight.status === "active");
  const wanted = new Set(highlightIds);
  const missing = active.filter((highlight) =>
    (highlightIds === undefined || wanted.has(highlight.id)) &&
    !candidates.some((candidate) => candidateMatchesHighlight(candidate, highlight)),
  );
  const attempted = new Set(missing.map((highlight) => highlight.id));
  const lines = markedAnalysisLines(evidence);
  for (let offset = 0; offset < missing.length; offset += ANALYZE_BATCH_SIZE) {
    let pending = missing.slice(offset, offset + ANALYZE_BATCH_SIZE);
    const lastExamplesOnly = new Map<string, Record<string, unknown>>();
    for (let attempt = 0; attempt <= FORMAT_RETRY_MAX && pending.length > 0; attempt += 1) {
      const shortIds = new Map(pending.map((highlight, index) => [`h${index + 1}`, highlight]));
      const prompt = buildAnalyzeMarkedExpressionsPrompt({
        lines, highlights: [...shortIds].map(([id, highlight]) => ({ id, text: highlight.text, line: (evidence.contextBefore ?? []).slice(-3).length + evidence.segments.findIndex(segment => segment.stableId === highlight.startSegmentId) + 1 })),
      });
      let cards: readonly Record<string, unknown>[];
      try {
        const wire = await completeWithFormatRetries(() => gateway.complete(
          ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION, prompt.userPrompt,
          { systemPrompt: prompt.systemPrompt, timeoutMs: 30_000, maxTokens: 450 * pending.length + 150, normalize: normalizeMarkedAnalysisWire },
        ), undefined, 0);
        cards = wire.cards;
      } catch (error) {
        // Format and card failures consume one shared attempt per request.
        // Rebuild the identical prompt until a valid envelope changes pending.
        if (error instanceof ModelGatewayError && ["json_extract", "wire_schema", "grounding"].includes(error.stage)) continue;
        break;
      }
      // Unknown, repeated or reordered IDs corrupt the batch association. Missing
      // cards are handled below as individual failures, preserving valid cards.
      const requested = [...shortIds.keys()];
      let previousIndex = -1;
      const invalidOrder = cards.some(card => {
        const index = requested.indexOf(card.id as string);
        if (index <= previousIndex) return true;
        previousIndex = index;
        return false;
      });
      if (invalidOrder) continue;
      const succeeded = new Set<string>();
      for (const [shortId, highlight] of shortIds) {
        const matching = cards.filter((card) => card.id === shortId);
        if (matching.length !== 1) { lastExamplesOnly.delete(highlight.id); continue; }
        const normalized = normalizeLearningCard(matching[0], highlight.text);
        if (!normalized.success) {
          if (normalized.examplesOnly) lastExamplesOnly.set(highlight.id, matching[0]!);
          else lastExamplesOnly.delete(highlight.id);
          continue;
        }
        try {
          candidates.push(groundCard(normalized.data, highlight, evidence));
          succeeded.add(highlight.id);
        } catch { lastExamplesOnly.delete(highlight.id); }
      }
      pending = pending.filter((highlight) => !succeeded.has(highlight.id));
    }
    for (const highlight of pending) {
      const last = lastExamplesOnly.get(highlight.id);
      if (!last) continue;
      const fallback = normalizeLearningCard(last, highlight.text, true);
      if (!fallback.success) continue;
      try { candidates.push(groundCard(fallback.data, highlight, evidence)); } catch { /* Leave only this mark failed. */ }
    }
  }
  const highlightStates = active.flatMap((highlight): HighlightAnalysisState[] => {
    const matched = candidates.some((candidate) => candidateMatchesHighlight(candidate, highlight));
    return matched || attempted.has(highlight.id)
      ? [{ highlightId: highlight.id, text: highlight.text, status: matched ? "ready" : "failed" }]
      : [];
  });
  return { candidates, highlightStates };
}
