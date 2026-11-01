import { test, expect, vi } from 'vitest';
import { createStatusReader } from './public-job-status';
test('successful suggestion jobs expose no nonexistent artifact reference', async () => {
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: {
        id: 'job',
        user_id: 'owner',
        status: 'succeeded',
        job_type: 'highlight_saved_item',
        last_error_code: null
      }, error: null }) };
  const from = vi.fn(() => query);
  const result = await createStatusReader({ from } as never)('owner', 'job');
  expect(result).toMatchObject({ status: 'succeeded', result: null, failureCategory: null });
  expect(from).toHaveBeenCalledTimes(1);
});
