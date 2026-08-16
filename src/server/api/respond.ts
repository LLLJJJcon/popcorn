import type { ApiFailure, ApiSuccess } from "@/contracts/api";

export function success<T>(data: T, requestId: string): ApiSuccess<T> {
  return { ok: true, data, requestId };
}

export function failure(error: ApiFailure["error"], requestId: string): ApiFailure {
  return { ok: false, error, requestId };
}
