import { PracticeActivationResponseSchema } from "@/contracts/practice";
import { TodayPracticeResponseSchema, TodayPracticeNextResponseSchema, type TodayPracticeItem, type TodaySessionResult } from "@/contracts/today-practice";
import { getPractice, postPractice, PracticeRequestError } from "./api";
import { PracticeMaterialViewSchema } from "./material-schema";
import type { SessionHint } from "./session-storage";
export const getTodayPractice = () => getPractice("/api/v1/practice/today", TodayPracticeResponseSchema);
export const getTaskMaterial = (taskId: string) => getPractice(`/api/v1/practice/tasks/${encodeURIComponent(taskId)}`, PracticeMaterialViewSchema);
export async function getNextPractice(results: readonly TodaySessionResult[], hint?: SessionHint | null) {
  const today = await getTodayPractice();
  const completed = new Set(results.map(r => r.id));
  const exclude = today.items.filter(item => completed.has(item.id)).map(item => item.id);
  return postPractice("/api/v1/practice/today/next", { exclude, ...(hint ?? {}) }, TodayPracticeNextResponseSchema);
}
export async function activateTodayCandidate(item: TodayPracticeItem) {
  if (item.kind === "review")
    throw new PracticeRequestError("VALIDATION_FAILED");
  if (item.roundStatus === "open" && item.currentTaskId)
    return { taskId: item.currentTaskId };
  const result = await postPractice("/api/v1/practice/tasks", item.selection, PracticeActivationResponseSchema);
  return "redirect" in result ? result : { taskId: result.id };
}
