import { createLearningMemoryHttpHandlers, createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly userExpressionId?: string }> },
) {
  const runtime = await createLearningMemoryRuntime();
  return createLearningMemoryHttpHandlers({
    authenticate: runtime.authenticate,
    repository: runtime.repository,
    now: () => new Date().toISOString(),
    requestId: () => crypto.randomUUID(),
  }).vaultDetail(request, context);
}
