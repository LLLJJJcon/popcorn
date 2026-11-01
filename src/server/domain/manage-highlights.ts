import { z } from 'zod';
import { HighlightSelectionSchema } from '@/contracts/highlights';
import { success, failure } from '@/server/api/respond';
import type { WebSessionResult } from '@/server/auth/web-session';
import type { HighlightRepository } from '@/server/repositories/highlight-repository';
const idSchema = z.string().uuid();
export function createHighlightHttpHandlers(dependencies: {
  readonly repository: HighlightRepository;
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  const reply = (data: unknown, status: number) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
  async function authorize(request: Request, savedItemId: string, highlightId?: string) {
    const requestId = dependencies.requestId(), session = await dependencies.authenticate(request);
    const fail = (code: 'AUTH_REQUIRED' | 'SESSION_EXPIRED' | 'FORBIDDEN' | 'VALIDATION_FAILED', message: string, status: number) => ({ ok: false as const, response: reply(failure({ code, message, retryable: false }, requestId), status) });
    if (!session.ok)
      return fail(session.reason === 'missing' ? 'AUTH_REQUIRED' : 'SESSION_EXPIRED', 'Sign in to edit saved expressions.', 401);
    if (request.headers.get('origin') !== new URL(dependencies.appUrl).origin)
      return fail('FORBIDDEN', 'Request origin is not allowed.', 403);
    if (!idSchema.safeParse(savedItemId).success || (highlightId !== undefined && !idSchema.safeParse(highlightId).success))
      return fail('VALIDATION_FAILED', 'Invalid saved expression.', 400);
    return { ok: true as const, userId: session.userId, requestId };
  }
  function errorResponse(requestId: string, error: unknown) {
    const validation = error instanceof TypeError || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P0001');
    return reply(failure({ code: validation ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR', message: validation ? 'Select Chinese words within the saved sentence.' : 'Could not save this change. Try again.', retryable: !validation }, requestId), validation ? 400 : 500);
  }
  return {
    async add(request: Request, savedItemId: string) {
      const auth = await authorize(request, savedItemId);
      if (!auth.ok)
        return auth.response;
      try {
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
          throw new TypeError();
        if (!request.body)
          throw new TypeError();
        const reader = request.body.getReader();
        let length = 0;
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done)
            break;
          length += value.length;
          if (length > 4096) {
            await reader.cancel();
            throw new TypeError();
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        let raw: unknown;
        try {
          raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
        }
        catch {
          throw new TypeError();
        }
        const selection = HighlightSelectionSchema.safeParse(raw);
        if (!selection.success)
          throw new TypeError();
        const result = await dependencies.repository.add(auth.userId, savedItemId, selection.data);
        return result ? reply(success(result, auth.requestId), 200) : reply(failure({ code: 'FORBIDDEN', message: 'Saved sentence is unavailable.', retryable: false }, auth.requestId), 404);
      }
      catch (error) {
        return errorResponse(auth.requestId, error);
      }
    },
    async change(request: Request, savedItemId: string, highlightId: string, action: 'remove' | 'restore') {
      const auth = await authorize(request, savedItemId, highlightId);
      if (!auth.ok)
        return auth.response;
      try {
        const result = await dependencies.repository.change(auth.userId, savedItemId, highlightId, action);
        return result ? reply(success(result, auth.requestId), 200) : reply(failure({ code: 'CONFLICT', message: action === 'restore' ? 'Undo is no longer available.' : 'Saved expression is unavailable.', retryable: false }, auth.requestId), 409);
      }
      catch (error) {
        return errorResponse(auth.requestId, error);
      }
    },
    async suggest(request: Request, savedItemId: string) {
      const auth = await authorize(request, savedItemId);
      if (!auth.ok)
        return auth.response;
      try {
        const result = await dependencies.repository.suggest(auth.userId, savedItemId);
        return result ? reply(success(result, auth.requestId), 200) : reply(failure({ code: 'FORBIDDEN', message: 'Saved sentence is unavailable.', retryable: false }, auth.requestId), 404);
      }
      catch (error) {
        return errorResponse(auth.requestId, error);
      }
    },
  };
}
