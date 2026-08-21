import { createLearningMemoryHttpHandlers, createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";
import {
  createExpressionSearchHttpHandler,
  createExpressionSearchRuntime,
} from "@/server/repositories/expression-search-repository";

const SEARCH_PARAMETERS = new Set([
  "search", "q", "function", "register", "source", "mastery", "from", "before", "limit",
]);

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  if ([...searchParams.keys()].some((key) => SEARCH_PARAMETERS.has(key))) {
    const runtime = await createExpressionSearchRuntime();
    return createExpressionSearchHttpHandler({
      authenticate: runtime.authenticate,
      repository: runtime.repository,
      requestId: () => crypto.randomUUID(),
    })(request);
  }
  const runtime = await createLearningMemoryRuntime();
  return createLearningMemoryHttpHandlers({
    authenticate: runtime.authenticate,
    repository: runtime.repository,
    now: () => new Date().toISOString(),
    requestId: () => crypto.randomUUID(),
  }).vault(request);
}
