import { failure } from "@/server/api/respond";
import { createLearningMemoryHttpHandlers, createLearningMemoryRuntime } from "@/server/repositories/review-task-repository";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const runtime = await createLearningMemoryRuntime();
    return createLearningMemoryHttpHandlers({
      authenticate: runtime.authenticate,
      repository: runtime.repository,
      now: () => new Date().toISOString(),
      requestId: () => requestId,
    }).due(request);
  } catch {
    return Response.json(failure({
      code: "INTERNAL_ERROR", message: "Practice is temporarily unavailable", retryable: true,
    }, requestId), { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
