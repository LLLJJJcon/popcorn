import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";
import { z } from 'zod';
import { ModelGatewayError } from '@/server/ai/provider';
import { buildHighlightExpressionsPrompt, HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION, normalizeHighlightExpressionsWire, type AnalysisLine } from '@/server/ai/prompts/highlight-expressions.v1';
import { completeWithFormatRetries, type StructuredJsonGatewayResolver } from '@/server/ai/structured-json-gateway';
import { groundSuggestedHighlights } from '@/server/domain/saved-item-target';
import type { DurableJobStore, JobHandler } from '@/server/jobs/process-jobs';
const InputSchema = z.strictObject({
  kind: z.literal('highlight_saved_item'),
  savedItemId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  gatewayConfigId: z.string().uuid(),
  gatewayRevision: z.number().int().positive(),
  gatewayFingerprint: z.string().regex(/^[a-f0-9]{64}$/)
});
export function createHighlightSavedItemHandler({ store, gatewayResolver }: {
  readonly store: DurableJobStore;
  readonly gatewayResolver: StructuredJsonGatewayResolver;
}): JobHandler {
  return async (job, userId, now) => {
    if (job.userId !== userId || job.type !== 'highlight_saved_item' || !job.savedItemId)
      throw new TypeError('Highlight job owner/type mismatch');
    if (!store.completeSavedItemHighlights)
      throw new Error('Highlight persistence is unavailable');
    try {
      const input = InputSchema.parse(await store.readPrivateInput(userId, job.id));
      if (input.savedItemId !== job.savedItemId)
        throw new TypeError('Highlight input mismatch');
      const evidence = await store.readSavedItemAnalysisEvidence?.(userId, job.savedItemId, job.sourceId, input.snapshotId);
      if (!evidence || evidence.userId !== userId || evidence.savedItemId !== job.savedItemId || evidence.sourceId !== job.sourceId || evidence.snapshotId !== input.snapshotId)
        throw new TypeError('Highlight evidence mismatch');
      const gateway = await gatewayResolver.resolve(userId, { configId: input.gatewayConfigId, revision: input.gatewayRevision, fingerprint: input.gatewayFingerprint });
      const lines: AnalysisLine[] = [];
      for (const text of evidence.contextBefore ?? [])
        lines.push({ line: lines.length + 1, role: 'context', text });
      for (const segment of evidence.segments)
        lines.push({ line: lines.length + 1, role: 'TARGET', text: segment.originalChinese });
      for (const text of evidence.contextAfter ?? [])
        lines.push({ line: lines.length + 1, role: 'context', text });
      const prompt = buildHighlightExpressionsPrompt({ lines });
      let highlights: ReturnType<typeof groundSuggestedHighlights> = [];
      await completeWithFormatRetries(() => gateway.complete(HIGHLIGHT_EXPRESSIONS_PROMPT_VERSION, prompt.userPrompt, {
        systemPrompt: prompt.systemPrompt,
        timeoutMs: 20000,
        maxTokens: MODEL_OUTPUT_TOKENS.highlightExpressions,
        normalize: normalizeHighlightExpressionsWire
      }), value => {
        try {
          highlights = groundSuggestedHighlights(value.highlights, evidence.segments.map(segment => ({
            id: segment.stableId,
            text: segment.originalChinese,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds
          })));
          return value;
        }
        catch {
          throw new ModelGatewayError('PROVIDER_OUTPUT_INVALID', 'grounding', 'highlights');
        }
      });
      return await store.completeSavedItemHighlights(userId, job, highlights, false, now) ? 'completed' : 'deferred';
    }
    catch {
      return await store.completeSavedItemHighlights(userId, job, [], true, now) ? 'failed' : 'deferred';
    }
  };
}
