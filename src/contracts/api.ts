import { z } from "zod";

export const ApiErrorCodeSchema = z.enum([
  "AUTH_REQUIRED",
  "SESSION_EXPIRED",
  "FORBIDDEN",
  "UNSUPPORTED_YOUTUBE_PAGE",
  "INVALID_YOUTUBE_VIDEO",
  "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
  "TRANSCRIPT_UNAVAILABLE",
  "TRANSCRIPT_EMPTY",
  "SYNC_QUEUE_FULL",
  "SYNC_RETRYING",
  "IDEMPOTENCY_CONFLICT",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_OUTPUT_INVALID",
  "JOB_LEASE_CONFLICT",
  "JOB_RETRY_EXHAUSTED",
  "VALIDATION_FAILED",
  "CONFLICT",
  "INTERNAL_ERROR",
]);

export const ApiErrorSchema = z.strictObject({
  code: ApiErrorCodeSchema,
  message: z.string().trim().min(1).max(500),
  retryable: z.boolean(),
  fieldErrors: z.record(z.string(), z.array(z.string().min(1)).max(20)).optional(),
});

export const ApiFailureSchema = z.strictObject({
  ok: z.literal(false),
  error: ApiErrorSchema,
  requestId: z.string().trim().min(1).max(200),
});

export const apiSuccessSchema = <T extends z.ZodType>(data: T) =>
  z.strictObject({
    ok: z.literal(true),
    data,
    requestId: z.string().trim().min(1).max(200),
  });

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;
export type ApiSuccess<T> = { ok: true; data: T; requestId: string };
export type ApiFailure = z.infer<typeof ApiFailureSchema>;
