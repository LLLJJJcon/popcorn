import { expect, test, vi } from 'vitest';
import { createHighlightHttpHandlers } from './manage-highlights';
const userId = '11111111-1111-4111-8111-111111111111', savedItemId = '22222222-2222-4222-8222-222222222222', highlightId = '33333333-3333-4333-8333-333333333333';
function fixture() { const repository = {
  read: vi.fn(),
  add: vi.fn(async () => ({ highlights: [], highlightStatus: 'ready' })),
  change: vi.fn(async () => ({ highlights: [], highlightStatus: 'ready' })),
  suggest: vi.fn(async () => ({ highlights: [], highlightStatus: 'pending', queued: true }))
}; return { repository, handler: createHighlightHttpHandlers({
    repository,
    authenticate: async () => ({ ok: true as const, userId }),
    appUrl: 'http://localhost:3000',
    requestId: () => 'req'
  }) }; }
test('highlight mutation rejects a foreign origin before calling repository', async () => { const f = fixture(); const result = await f.handler.add(new Request('http://localhost:3000', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' }), savedItemId); expect(result.status).toBe(403); expect(f.repository.add).not.toHaveBeenCalled(); });
test('valid add forwards exact UTF16 offsets and returns persisted marks', async () => { const f = fixture(); const body = {
  startSegmentId: 's1',
  startOffset: 2,
  endSegmentId: 's2',
  endOffset: 4
}; const result = await f.handler.add(new Request('http://localhost:3000', { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) }), savedItemId); expect(result.status).toBe(200); expect(f.repository.add).toHaveBeenCalledWith(userId, savedItemId, body); });
test('delete and restore need no body, invalid IDs and expired undo are bounded', async () => { const f = fixture(); const request = () => new Request('http://localhost:3000', { method: 'POST', headers: { origin: 'http://localhost:3000' } }); expect((await f.handler.change(request(), savedItemId, highlightId, 'remove')).status).toBe(200); expect((await f.handler.change(request(), savedItemId, 'invalid', 'restore')).status).toBe(400); f.repository.change.mockResolvedValueOnce(null as never); expect((await f.handler.change(request(), savedItemId, highlightId, 'restore')).status).toBe(409); });
