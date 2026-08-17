import { z } from "zod";

import type { ApiErrorCode, SavedItemInput } from "@/contracts";
import { SavedItemInputSchema } from "@/contracts";
import { CapturePersistenceError } from "@/server/repositories/knowledge-job-repository";
import {
  type CaptureAuthentication,
  CaptureScopeError,
  type CaptureRpcArgs,
} from "@/server/repositories/video-source-repository";

export type CaptureResult = {
  videoSourceId: string;
  savedItemId: string;
  status: "saved";
};

export type CaptureRepository = {
  capture(userId: string, args: CaptureRpcArgs): Promise<CaptureResult>;
};

export class CaptureSaveError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "CaptureSaveError";
  }
}

const userIdSchema = z.string().uuid();

const startSeconds = (input: SavedItemInput) => {
  switch (input.kind) {
    case "video":
      return input.currentTimeSeconds;
    case "player_moment":
      return input.capturedSecond;
    case "key_quote":
      return input.quoteSeconds;
    case "subtitle_row":
    case "subtitle_selection":
    case "ai_explanation":
      return input.startSeconds;
  }
};

export function mapSavedItemToRpcArgs(input: SavedItemInput): CaptureRpcArgs {
  const {
    clientEventId,
    youtubeVideoId,
    kind,
    capturedAt,
    ...payload
  } = input;
  return {
    p_youtube_video_id: youtubeVideoId,
    p_client_event_id: clientEventId,
    p_kind: kind,
    p_captured_at: capturedAt,
    p_start_seconds: startSeconds(input),
    p_payload: payload,
  };
}

const persistenceFailure = (error: CapturePersistenceError) => {
  if (error.category === "forbidden") {
    return new CaptureSaveError("FORBIDDEN", false);
  }
  if (error.category === "conflict") {
    return new CaptureSaveError("IDEMPOTENCY_CONFLICT", false);
  }
  return new CaptureSaveError("SYNC_RETRYING", true);
};

export function createCaptureSave(repository: CaptureRepository) {
  return async function captureSave(
    userId: string,
    input: unknown,
  ): Promise<CaptureResult> {
    if (!userIdSchema.safeParse(userId).success) {
      throw new CaptureSaveError("FORBIDDEN", false);
    }
    const parsed = SavedItemInputSchema.safeParse(input);
    if (!parsed.success) {
      throw new CaptureSaveError("VALIDATION_FAILED", false);
    }
    try {
      return await repository.capture(userId, mapSavedItemToRpcArgs(parsed.data));
    } catch (error) {
      if (error instanceof CaptureSaveError) throw error;
      if (error instanceof CaptureScopeError) {
        throw new CaptureSaveError("FORBIDDEN", false);
      }
      if (error instanceof CapturePersistenceError) throw persistenceFailure(error);
      throw new CaptureSaveError("SYNC_RETRYING", true);
    }
  };
}

type RouteDependencies<TClient> = {
  authenticate: (request: Request) => Promise<CaptureAuthentication<TClient>>;
  capture: (userId: string, input: unknown, client: TClient) => Promise<CaptureResult>;
  requestId: () => string;
};

const clientEventIdSchema = z.string().uuid();
const batchSchema = z.strictObject({ events: z.array(z.unknown()).min(1).max(50) });

const errorMessage = (code: ApiErrorCode, batch = false) => {
  if (code === "AUTH_REQUIRED") {
    return batch
      ? "Sign in to Popcorn to sync saved moments."
      : "Sign in to Popcorn to save this moment.";
  }
  if (code === "SESSION_EXPIRED") return "Your Popcorn session has expired.";
  if (code === "VALIDATION_FAILED") return "Invalid saved event.";
  if (code === "FORBIDDEN") return "This save does not belong to the signed-in user.";
  if (code === "IDEMPOTENCY_CONFLICT") return "The saved event conflicts with an existing event.";
  return "Save could not be synchronized.";
};

const errorStatus = (code: ApiErrorCode) => {
  if (code === "AUTH_REQUIRED" || code === "SESSION_EXPIRED") return 401;
  if (code === "FORBIDDEN") return 403;
  if (code === "VALIDATION_FAILED") return 400;
  if (code === "IDEMPOTENCY_CONFLICT") return 409;
  return 503;
};

const routeFailure = (
  code: ApiErrorCode,
  retryable: boolean,
  requestId: string,
  batch = false,
) =>
  Response.json(
    {
      ok: false,
      error: { code, message: errorMessage(code, batch), retryable },
      requestId,
    },
    {
      status: errorStatus(code),
      headers: { "Cache-Control": "no-store" },
    },
  );

const parseJsonBody = async (request: Request, maximumLength: number) => {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumLength) {
    return { ok: false as const };
  }
  if (!request.body) return { ok: false as const };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maximumLength) {
      await reader.cancel();
      return { ok: false as const };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const rawBody = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true as const, value: JSON.parse(rawBody) as unknown };
  } catch {
    return { ok: false as const };
  }
};

export function createSavedItemHandler<TClient>({
  authenticate,
  capture,
  requestId,
}: RouteDependencies<TClient>) {
  return async function post(request: Request) {
    const id = requestId();
    const authentication = await authenticate(request);
    if (!authentication.ok) {
      const code = authentication.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED";
      return routeFailure(code, false, id);
    }

    const body = await parseJsonBody(request, 64 * 1024);
    if (!body.ok) return routeFailure("VALIDATION_FAILED", false, id);
    const input = SavedItemInputSchema.safeParse(body.value);
    if (!input.success) return routeFailure("VALIDATION_FAILED", false, id);

    try {
      const data = await capture(
        authentication.userId,
        input.data,
        authentication.client,
      );
      return Response.json(
        { ok: true, data, requestId: id },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const captureError =
        error instanceof CaptureSaveError
          ? error
          : new CaptureSaveError("SYNC_RETRYING", true);
      return routeFailure(captureError.code, captureError.retryable, id);
    }
  };
}

const eventIdentity = (event: unknown) => {
  if (typeof event !== "object" || event === null || !("clientEventId" in event)) {
    return null;
  }
  const parsed = clientEventIdSchema.safeParse(event.clientEventId);
  return parsed.success ? parsed.data : null;
};

const eventFailure = (
  clientEventId: string | null,
  error: CaptureSaveError,
) => ({
  clientEventId,
  ok: false as const,
  error: {
    code: error.code,
    message: errorMessage(error.code, true),
    retryable: error.retryable,
  },
});

export function createSyncHandler<TClient>({
  authenticate,
  capture,
  requestId,
}: RouteDependencies<TClient>) {
  return async function post(request: Request) {
    const id = requestId();
    const authentication = await authenticate(request);
    if (!authentication.ok) {
      const code = authentication.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED";
      return routeFailure(code, false, id, true);
    }

    const body = await parseJsonBody(request, 2_000_000);
    if (!body.ok) return routeFailure("VALIDATION_FAILED", false, id, true);
    const batch = batchSchema.safeParse(body.value);
    if (!batch.success) {
      return routeFailure("VALIDATION_FAILED", false, id, true);
    }

    const results = [];
    for (const event of batch.data.events) {
      const clientEventId = eventIdentity(event);
      const parsed = SavedItemInputSchema.safeParse(event);
      if (!parsed.success) {
        results.push(
          eventFailure(
            clientEventId,
            new CaptureSaveError("VALIDATION_FAILED", false),
          ),
        );
        continue;
      }
      try {
        const data = await capture(
          authentication.userId,
          parsed.data,
          authentication.client,
        );
        results.push({ clientEventId, ok: true as const, data });
      } catch (error) {
        const captureError =
          error instanceof CaptureSaveError
            ? error
            : new CaptureSaveError("SYNC_RETRYING", true);
        results.push(eventFailure(clientEventId, captureError));
      }
    }

    return Response.json(
      { ok: true, data: { results }, requestId: id },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  };
}
