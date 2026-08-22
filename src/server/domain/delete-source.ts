import { z } from "zod";

import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import {
  type SourceDeletionMode,
  type SourceDeletionRepository,
  createSourceDeletionPlanner,
} from "@/server/domain/plan-source-deletion";

type SourceDeletionPlanner = ReturnType<typeof createSourceDeletionPlanner>;

class SourceDeletionError extends Error {
  constructor(readonly reason: "UNAVAILABLE" | "MODE_MISMATCH" | "VALIDATION_FAILED") {
    super(reason);
  }
}

const SourceIdSchema = z.string().uuid();
const DeleteInputSchema = z.strictObject({
  mode: z.enum(["remove_unpracticed_source", "remove_source_keep_evidence"]),
});

function canonicalInstant(value: string): string {
  const parsed = z.string().datetime({ offset: true }).safeParse(value);
  const milliseconds = parsed.success ? Date.parse(parsed.data) : Number.NaN;
  if (!Number.isFinite(milliseconds)) throw new SourceDeletionError("VALIDATION_FAILED");
  return new Date(milliseconds).toISOString();
}

export function createSourceDeletionService({
  planner,
  repository,
  now,
}: {
  readonly planner: SourceDeletionPlanner;
  readonly repository: SourceDeletionRepository;
  readonly now: () => string;
}) {
  return {
    async remove(userId: string, videoSourceId: string, mode: SourceDeletionMode) {
      const impact = await planner.preview(userId, videoSourceId);
      if (!impact) throw new SourceDeletionError("UNAVAILABLE");
      if (impact.mode !== mode) throw new SourceDeletionError("MODE_MISMATCH");
      return repository.deleteVideoSource({
        userId,
        videoSourceId,
        mode,
        now: canonicalInstant(now()),
      });
    },
  };
}

type SourceDeletionService = ReturnType<typeof createSourceDeletionService>;

function noStore(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authFailure(session: Exclude<WebSessionResult, { readonly ok: true }>, requestId: string) {
  return noStore(failure({
    code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
    message: session.reason === "missing" ? "Sign in to manage Saved." : "Your session expired. Sign in again.",
    retryable: false,
  }, requestId), 401);
}

function unavailable(requestId: string) {
  return noStore(failure({
    code: "FORBIDDEN",
    message: "Saved video is unavailable.",
    retryable: false,
  }, requestId), 404);
}

function internalFailure(requestId: string) {
  return noStore(failure({
    code: "INTERNAL_ERROR",
    message: "Source deletion is unavailable.",
    retryable: true,
  }, requestId), 500);
}

export function createSourceDeletionHttpHandlers(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly planner: SourceDeletionPlanner;
  readonly service: SourceDeletionService;
  readonly requestId: () => string;
}) {
  async function authorize(request: Request, requestId: string) {
    const session = await dependencies.authenticate(request);
    return session.ok ? session : authFailure(session, requestId);
  }

  return {
    async preview(request: Request, videoSourceIdValue: string) {
      const requestId = dependencies.requestId();
      const session = await authorize(request, requestId);
      if (session instanceof Response) return session;
      const videoSourceId = SourceIdSchema.safeParse(videoSourceIdValue);
      if (!videoSourceId.success) return unavailable(requestId);
      try {
        const impact = await dependencies.planner.preview(session.userId, videoSourceId.data);
        return impact ? noStore(success(impact, requestId), 200) : unavailable(requestId);
      } catch {
        return internalFailure(requestId);
      }
    },
    async remove(request: Request, videoSourceIdValue: string) {
      const requestId = dependencies.requestId();
      const session = await authorize(request, requestId);
      if (session instanceof Response) return session;
      const videoSourceId = SourceIdSchema.safeParse(videoSourceIdValue);
      if (!videoSourceId.success) return unavailable(requestId);
      let input: z.infer<typeof DeleteInputSchema>;
      try {
        input = DeleteInputSchema.parse(await request.json());
      } catch {
        return noStore(failure({
          code: "VALIDATION_FAILED",
          message: "Choose the current source deletion option.",
          retryable: false,
        }, requestId), 400);
      }
      try {
        const result = await dependencies.service.remove(session.userId, videoSourceId.data, input.mode);
        return noStore(success(result, requestId), 200);
      } catch (error) {
        if (error instanceof SourceDeletionError && error.reason === "UNAVAILABLE") return unavailable(requestId);
        if (error instanceof SourceDeletionError && error.reason === "MODE_MISMATCH") {
          return noStore(failure({
            code: "CONFLICT",
            message: "The deletion effect changed. Review it and try again.",
            retryable: false,
          }, requestId), 409);
        }
        return internalFailure(requestId);
      }
    },
  };
}
