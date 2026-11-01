import { test, expect, vi } from 'vitest';
import { createHighlightSavedItemHandler } from './highlight-saved-item';
import { ModelGatewayError } from '@/server/ai/provider';
import type { StructuredJsonGateway } from '@/server/ai/structured-json-gateway';
import type { DurableJobStore } from '@/server/jobs/process-jobs';
const userId = '11111111-1111-4111-8111-111111111111', savedItemId = '22222222-2222-4222-8222-222222222222', snapshotId = '33333333-3333-4333-8333-333333333333';
const job = {
  id: '44444444-4444-4444-8444-444444444444',
  userId,
  sourceId: '55555555-5555-4555-8555-555555555555',
  savedItemId,
  type: 'highlight_saved_item' as const,
  status: 'leased' as const,
  attemptCount: 1,
  dedupeKey: 'a'.repeat(64),
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  leaseExpiresAt: '2026-11-01T00:10:00.000Z',
  nextAttemptAt: null,
  lastErrorCode: null
};
function setup(run: (version: string, prompt: string) => Promise<unknown>) {
  const complete = vi.fn(run);
  const finish = vi.fn<NonNullable<DurableJobStore['completeSavedItemHighlights']>>(async () => true);
  const store = { readPrivateInput: async () => ({
      kind: 'highlight_saved_item',
      savedItemId, snapshotId,
      gatewayConfigId: '66666666-6666-4666-8666-666666666666',
      gatewayRevision: 1,
      gatewayFingerprint: 'a'.repeat(64)
    }), readSavedItemAnalysisEvidence: async () => ({
      userId,
      sourceId: job.sourceId,
      savedItemId, snapshotId,
      transcriptHash: 'b'.repeat(64),
      kind: 'subtitle_row',
      rawText: '这咖啡高得要命',
      startSeconds: 0,
      contextBefore: ['之前的话'],
      contextAfter: ['之后的话'],
      segments: [{
          stableId: 's1',
          originalChinese: '这咖啡高得要命',
          startSeconds: 0,
          endSeconds: 3
        }]
    }), completeSavedItemHighlights: finish } as unknown as DurableJobStore;
  return { complete, finish, handler: createHighlightSavedItemHandler({ store, gatewayResolver: { resolve: async () => ({ model: 'fixture', complete: complete as StructuredJsonGateway['complete'] }) } }) };
}
test('invalid model JSON calls four times then persists unavailable', async () => {
  const f = setup(async () => { throw new ModelGatewayError('PROVIDER_OUTPUT_INVALID', 'json_extract'); });
  expect(await f.handler(job, userId, job.updatedAt)).toBe('failed');
  expect(f.complete).toHaveBeenCalledTimes(4);
  expect(f.finish).toHaveBeenLastCalledWith(userId, job, [], true, job.updatedAt);
});
test('valid suggestion only references target and server-computed offsets', async () => {
  const f = setup(async () => ({ highlights: [{ text: '高得要命', occurrence: 1 }] }));
  expect(await f.handler(job, userId, job.updatedAt)).toBe('completed');
  expect(f.finish.mock.calls[0]?.[2]).toMatchObject([{
      startSegmentId: 's1',
      startOffset: 3,
      endOffset: 7,
      text: '高得要命'
    }]);
  const body = JSON.parse(f.complete.mock.calls[0]![1].split("\n")[0]!);
  expect(body.lines.map((v: {
    role: string;
  }) => v.role)).toEqual(['context', 'TARGET', 'context']);
});
test('empty suggestions is a valid ready result', async () => { const f = setup(async () => ({ highlights: [] })); expect(await f.handler(job, userId, job.updatedAt)).toBe('completed'); expect(f.finish).toHaveBeenLastCalledWith(userId, job, [], false, job.updatedAt); });

test('suggestion transport uses the confirmed twenty-second deadline', async () => {
  const f = setup(async () => ({ highlights: [] }));
  await f.handler(job, userId, job.updatedAt);
  const calls = f.complete.mock.calls as unknown[][];
  expect(calls[0]?.[2]).toMatchObject({ timeoutMs: 20000, maxTokens: 350 });
});
