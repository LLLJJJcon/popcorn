import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";
import { createTodayPracticeHttpHandlers } from "@/server/domain/today-practice-http";
import { practiceErrorResponse } from "@/server/domain/create-practice-task";

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const requestId = crypto.randomUUID();
  try {
    const runtime = await createTodayPracticeRuntime();
    return await createTodayPracticeHttpHandlers({
      ...runtime, now: () => new Date().toISOString(), requestId: () => requestId,
    }).material(request, (await context.params).taskId);
  } catch (error) {
    return practiceErrorResponse(error, requestId);
  }
}
