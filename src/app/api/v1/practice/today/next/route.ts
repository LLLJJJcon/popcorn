import { createTodayPracticeRuntime } from "@/server/today-practice-runtime";
import { createTodayPracticeHttpHandlers } from "@/server/domain/today-practice-http";
import { practiceErrorResponse } from "@/server/domain/create-practice-task";

async function handle(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const runtime = await createTodayPracticeRuntime();
    return await createTodayPracticeHttpHandlers({
      ...runtime, now: () => new Date().toISOString(), requestId: () => requestId,
    }).next(request);
  } catch (error) {
    return practiceErrorResponse(error, requestId);
  }
}
export const GET = handle;
export const POST = handle;
