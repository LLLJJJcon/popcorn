import { createHighlightRuntime } from '@/server/domain/highlight-runtime';
export async function POST(request: Request, context: {
  readonly params: Promise<{
    readonly savedItemId: string;
    readonly highlightId: string;
  }>;
}) {
  const [handlers, { savedItemId, highlightId }] = await Promise.all([createHighlightRuntime(), context.params]);
  return handlers.change(request, savedItemId, highlightId, 'restore');
}
