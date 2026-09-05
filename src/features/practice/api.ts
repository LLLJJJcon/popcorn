import {
  PracticeAttemptResponseSchema,
  type AssistanceLevel,
  type PracticeAttemptResponse,
} from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";

const AttemptSuccessSchema = apiSuccessSchema(PracticeAttemptResponseSchema);

async function post(url: string, body: unknown): Promise<PracticeAttemptResponse> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("practice request failed");
  return AttemptSuccessSchema.parse(await response.json()).data;
}

export function submitOriginalAttempt(
  taskId: string,
  responseChinese: string,
  assistanceLevel: AssistanceLevel,
) {
  return post("/api/v1/practice/attempts", { taskId, responseChinese, assistanceLevel });
}

export function submitAttemptRevision(
  attemptId: string,
  responseChinese: string,
  assistanceLevel: AssistanceLevel,
) {
  return post(`/api/v1/practice/attempts/${encodeURIComponent(attemptId)}/revisions`, {
    responseChinese,
    assistanceLevel,
  });
}
