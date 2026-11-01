import { createHighlightRuntime } from '@/server/domain/highlight-runtime';
export async function POST(request: Request, context: {
  readonly params: Promise<{
    readonly savedItemId: string;
  }>;
}) {
  const [handlers, { savedItemId }] = await Promise.all([createHighlightRuntime(), context.params]);
  return handlers.suggest(request, savedItemId);
}
