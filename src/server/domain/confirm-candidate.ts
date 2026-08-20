import { z } from "zod";

import { CandidateExpressionListSchema } from "@/contracts/knowledge";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import { ANALYZE_SAVED_ITEM_PROMPT_VERSION } from "@/server/ai/prompts/analyze-saved-item.v1";
import type { SavedItemAnalysisRegistration } from "@/server/jobs/process-jobs";
import type { CandidateSourceContext, ExpressionRepository } from "@/server/repositories/expression-repository";

const IdSchema = z.string().uuid();
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const ArtifactContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema });
const EmptyBodySchema = z.strictObject({});

type RegistrarResult = {
  readonly jobId: string;
  readonly status: string;
  readonly created: boolean;
};

type SavedItemAnalysisRegistrar = {
  register(registration: SavedItemAnalysisRegistration): Promise<RegistrarResult | null>;
};

class CandidateAccessError extends Error {}
class CandidateArtifactError extends Error {}

function ready(context: CandidateSourceContext) {
  const artifact = context.artifact;
  if (!artifact) return { state: "processing" as const };
  if (
    artifact.userId !== context.userId
    || artifact.sourceId !== context.sourceId
    || artifact.savedItemId !== context.savedItemId
    || artifact.type !== "saved_item_analysis"
    || artifact.promptVersion !== ANALYZE_SAVED_ITEM_PROMPT_VERSION
  ) throw new CandidateArtifactError();
  const content = ArtifactContentSchema.safeParse(artifact.content);
  if (!content.success) throw new CandidateArtifactError();
  return {
    state: "ready" as const,
    artifactId: IdSchema.parse(artifact.artifactId),
    savedItemId: context.savedItemId,
    youtubeVideoId: context.youtubeVideoId,
    canonicalUrl: context.canonicalUrl,
    candidates: content.data.candidates,
  };
}

function validateContext(userId: string, savedItemId: string, value: CandidateSourceContext | null) {
  if (!value) throw new CandidateAccessError();
  if (
    value.userId !== userId
    || value.savedItemId !== savedItemId
    || !IdSchema.safeParse(value.sourceId).success
    || !IdSchema.safeParse(value.snapshotId).success
    || !HashSchema.safeParse(value.transcriptHash).success
    || !/^[A-Za-z0-9_-]{11}$/.test(value.youtubeVideoId)
    || value.canonicalUrl !== `https://www.youtube.com/watch?v=${value.youtubeVideoId}`
  ) throw new CandidateArtifactError();
  return value;
}

export function createCandidateService(
  repository: ExpressionRepository,
  registrar: SavedItemAnalysisRegistrar,
  now: () => string,
) {
  async function context(userId: string, savedItemId: string) {
    const owner = IdSchema.parse(userId);
    const save = IdSchema.parse(savedItemId);
    return validateContext(owner, save, await repository.read(owner, save));
  }

  return {
    async read(userId: string, savedItemId: string) {
      return ready(await context(userId, savedItemId));
    },
    async recover(userId: string, savedItemId: string) {
      const source = await context(userId, savedItemId);
      const current = ready(source);
      if (current.state === "ready") return current;
      const registered = await registrar.register({
        userId: source.userId,
        sourceId: source.sourceId,
        savedItemId: source.savedItemId,
        snapshotId: source.snapshotId,
        transcriptHash: source.transcriptHash,
        promptVersion: ANALYZE_SAVED_ITEM_PROMPT_VERSION,
        now: now(),
      });
      return registered
        ? { state: "processing" as const, ...registered }
        : { state: "gateway_required" as const };
    },
  };
}

type CandidateService = ReturnType<typeof createCandidateService>;

const MAX_BODY_BYTES = 256;

async function boundedEmptyBody(request: Request) {
  const mediaType = request.headers.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (mediaType !== "application/json") throw new TypeError();
  if (!request.body) throw new TypeError();
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    await request.body.cancel().catch(() => undefined);
    throw new TypeError();
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      byteLength += chunk.value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new TypeError();
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return EmptyBodySchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
}

function noStore(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authFailure(result: Extract<WebSessionResult, { ok: false }>, requestId: string) {
  return noStore(failure({
    code: result.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
    message: result.reason === "missing" ? "Sign in to view candidates." : "Your session expired. Sign in again.",
    retryable: false,
  }, requestId), 401);
}

function routeError(error: unknown, requestId: string) {
  if (error instanceof CandidateAccessError) {
    return noStore(failure({ code: "FORBIDDEN", message: "Saved item is unavailable.", retryable: false }, requestId), 404);
  }
  if (error instanceof CandidateArtifactError || error instanceof z.ZodError) {
    return noStore(failure({ code: "PROVIDER_OUTPUT_INVALID", message: "Candidate analysis is unavailable.", retryable: false }, requestId), 422);
  }
  return noStore(failure({ code: "INTERNAL_ERROR", message: "Candidates are unavailable.", retryable: true }, requestId), 500);
}

export function createCandidateHttpHandlers({
  authenticate,
  service,
  appUrl,
  requestId,
}: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly service: CandidateService;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  return {
    async get(request: Request, savedItemId: string) {
      const id = requestId();
      const auth = await authenticate(request);
      if (!auth.ok) return authFailure(auth, id);
      try {
        return noStore(success(await service.read(auth.userId, savedItemId), id), 200);
      } catch (error) {
        return routeError(error, id);
      }
    },
    async post(request: Request, savedItemId: string) {
      const id = requestId();
      const auth = await authenticate(request);
      if (!auth.ok) return authFailure(auth, id);
      if (request.headers.get("origin") !== new URL(appUrl).origin) {
        return noStore(failure({ code: "FORBIDDEN", message: "Request origin is not allowed.", retryable: false }, id), 403);
      }
      try {
        await boundedEmptyBody(request);
      } catch {
        return noStore(failure({ code: "VALIDATION_FAILED", message: "Invalid request.", retryable: false }, id), 400);
      }
      try {
        const value = await service.recover(auth.userId, savedItemId);
        return noStore(success(value, id), value.state === "processing" ? 202 : 200);
      } catch (error) {
        return routeError(error, id);
      }
    },
  };
}
