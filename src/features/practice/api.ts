import { AttemptRecordedSchema, type AttemptRecorded } from "@/contracts/practice";
import { apiSuccessSchema } from "@/contracts/api";

const AttemptSuccessSchema = apiSuccessSchema(AttemptRecordedSchema);

async function post(url: string, body: unknown): Promise<AttemptRecorded> {
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

export function submitOriginalAttempt(taskId: string, responseChinese: string) {
  return post("/api/v1/practice/attempts", { taskId, responseChinese });
}

export function submitAttemptRevision(attemptId: string, responseChinese: string) {
  return post(`/api/v1/practice/attempts/${encodeURIComponent(attemptId)}/revisions`, {
    responseChinese,
  });
}
