import { z } from "zod";
import { ApiFailureSchema, apiSuccessSchema } from "@/contracts/api";
import { DueCompletionSchema, DueReviewGetResponseSchema, ReviewOperationFailureDetailsSchema, type ReviewOperationFailureDetails } from "@/contracts/review-practice";
import { PracticeRequestError } from "./api";

export class ReviewRequestError extends PracticeRequestError {
  constructor(error: PracticeRequestError, readonly details?: ReviewOperationFailureDetails) {
    super(error.code, undefined, undefined, error.status);
  }
}
// The optional field supports historical callback types; current HTTP must supply it.
export const DueHttpCompletionSchema = DueCompletionSchema.refine(value => Boolean(value.reviewState), "Expected authoritative review state");

export async function requestReview<T>(url: string, schema: z.ZodType<T>, body?: unknown, headers?: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store", ...(body === undefined ? headers ? { headers } : {} : { headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }) });
  } catch { throw new ReviewRequestError(new PracticeRequestError("NETWORK")); }
  let value: unknown;
  try { value = await response.json(); } catch { throw new ReviewRequestError(new PracticeRequestError("PROVIDER_OUTPUT_INVALID", undefined, undefined, response.status)); }
  if (!response.ok) {
    const failure = ApiFailureSchema.safeParse(value);
    const details = failure.success ? ReviewOperationFailureDetailsSchema.safeParse(failure.data.error.details) : null;
    throw new ReviewRequestError(new PracticeRequestError(failure.success ? failure.data.error.code : "PROVIDER_UNAVAILABLE", undefined, undefined, response.status), details?.success ? details.data : undefined);
  }
  const result = apiSuccessSchema(schema).safeParse(value);
  if (!result.success) throw new ReviewRequestError(new PracticeRequestError("PROVIDER_OUTPUT_INVALID", undefined, undefined, response.status));
  return result.data.data;
}

export const getReview = (reviewTaskId: string, retryRequestId?: string) => requestReview(`/api/v1/practice/due/${encodeURIComponent(reviewTaskId)}${retryRequestId ? `?retryRequestId=${encodeURIComponent(retryRequestId)}` : ""}`, DueReviewGetResponseSchema, undefined, retryRequestId ? { "X-Popcorn-Review-Retry": "1" } : undefined);
