import { z } from "zod";
import { ApiFailureSchema, apiSuccessSchema, type ApiErrorCode } from "@/contracts/api";
import { PracticeAttemptResponseSchema, PracticeConflictResponseSchema, PracticeExamplesOpenedResponseSchema, PracticeNewRoundResponseSchema, PracticeRemoveResponseSchema, PracticeRestoreResponseSchema, type PracticeRoundState } from "@/contracts/practice";

export class PracticeRequestError extends Error {
  constructor(readonly code: ApiErrorCode | "NETWORK", readonly roundState?: PracticeRoundState, readonly userExpressionId?: string) { super(code); }
}
export async function postPractice<T>(url: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new PracticeRequestError("NETWORK"); }
  let value: unknown;
  try { value = await response.json(); } catch { throw new PracticeRequestError("PROVIDER_OUTPUT_INVALID"); }
  if (!response.ok) {
    const conflict = PracticeConflictResponseSchema.safeParse(value);
    if (conflict.success) {
      const e = conflict.data.error;
      throw e.code === "FIRST_ANSWER_EXISTS" ? new PracticeRequestError(e.code, e.details.roundState) : new PracticeRequestError(e.code, undefined, e.details.userExpressionId);
    }
    const failure = ApiFailureSchema.safeParse(value);
    throw new PracticeRequestError(failure.success ? failure.data.error.code : "PROVIDER_UNAVAILABLE");
  }
  const result = apiSuccessSchema(schema).safeParse(value);
  if (!result.success) throw new PracticeRequestError("PROVIDER_OUTPUT_INVALID");
  return result.data.data;
}
export const submitOriginalAttempt = (taskId: string, responseChinese: string) => postPractice("/api/v1/practice/attempts", { taskId, responseChinese }, PracticeAttemptResponseSchema);
export const submitAttemptRevision = (attemptId: string, responseChinese: string) => postPractice(`/api/v1/practice/attempts/${encodeURIComponent(attemptId)}/revisions`, { responseChinese }, PracticeAttemptResponseSchema);
export const openPracticeExamples = (id: string, due = false) => postPractice(`/api/v1/practice/${due ? "due" : "tasks"}/${encodeURIComponent(id)}/examples-opened`, {}, PracticeExamplesOpenedResponseSchema);
export const startPracticeRound = (taskId: string, requestId: string) => postPractice(`/api/v1/practice/tasks/${encodeURIComponent(taskId)}/rounds`, { requestId }, PracticeNewRoundResponseSchema);
export const removePractice = (taskId: string) => postPractice(`/api/v1/practice/tasks/${encodeURIComponent(taskId)}/remove`, {}, PracticeRemoveResponseSchema);
export const restorePractice = (taskId: string) => postPractice(`/api/v1/practice/tasks/${encodeURIComponent(taskId)}/restore`, {}, PracticeRestoreResponseSchema);

export async function getPractice<T>(url:string,schema:z.ZodType<T>):Promise<T>{let response:Response;try{response=await fetch(url,{credentials:"same-origin",cache:"no-store"});}catch{throw new PracticeRequestError("NETWORK");}let value:unknown;try{value=await response.json();}catch{throw new PracticeRequestError("PROVIDER_OUTPUT_INVALID");}if(!response.ok){const failure=ApiFailureSchema.safeParse(value);throw new PracticeRequestError(failure.success?failure.data.error.code:"PROVIDER_UNAVAILABLE");}const parsed=apiSuccessSchema(schema).safeParse(value);if(!parsed.success)throw new PracticeRequestError("PROVIDER_OUTPUT_INVALID");return parsed.data.data;}
