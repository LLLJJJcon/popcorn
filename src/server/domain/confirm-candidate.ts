import { z } from "zod";

import { CandidateExpressionListSchema, HighlightAnalysisStateSchema, type HighlightAnalysisState } from "@/contracts/knowledge";
import { candidateMatchesHighlight } from "@/server/jobs/handlers/marked-learning-cards";
import { ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION } from "@/server/ai/prompts/analyze-saved-item.v3";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import {
  ANALYZE_SAVED_ITEM_PROMPT_VERSION,
  isReadableSavedAnalysisPromptVersion,
} from "@/server/ai/prompts/analyze-saved-item.v1";
import {
  publicFailureCategory,
  type SavedItemAnalysisRegistration,
} from "@/server/jobs/process-jobs";
import type {
  CandidateAnalysisJobStatus,
  CandidateSourceContext,
  ExpressionRepository,
} from "@/server/repositories/expression-repository";

const IdSchema = z.string().uuid();
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const ArtifactContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema, highlightStates: z.array(HighlightAnalysisStateSchema).optional() });
const RecoveryBodySchema = z.strictObject({
  retryId: z.string().uuid().optional(),
  highlightId: z.string().uuid().optional(),
});

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
class NothingToAnalyzeError extends Error {}

function ready(context: CandidateSourceContext) {
  const artifact = context.artifact;
  if (!artifact) return null;
  if (
    artifact.userId !== context.userId
    || artifact.sourceId !== context.sourceId
    || artifact.savedItemId !== context.savedItemId
    || artifact.type !== "saved_item_analysis"
    || !isReadableSavedAnalysisPromptVersion(artifact.promptVersion)
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
    ...(context.highlights !== undefined || artifact.promptVersion === ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION ? {
      promptVersion: artifact.promptVersion,
      highlightStates: (context.highlights ?? []).flatMap((highlight): HighlightAnalysisState[] => {
        if (content.data.candidates.some((candidate) => candidateMatchesHighlight(candidate, highlight))) {
          return [{ highlightId: highlight.id, text: highlight.text, status: "ready" }];
        }
        const previous = content.data.highlightStates?.find((state) => state.highlightId === highlight.id);
        return previous ? [previous] : [];
      }),
    } : {}),
  };
}

function modernJobState(source: CandidateSourceContext, job: CandidateAnalysisJobStatus) {
  const current = ready(source);
  const highlightStates = (source.highlights ?? []).map((highlight): HighlightAnalysisState => ({
    highlightId: highlight.id, text: highlight.text,
    status: current?.candidates.some((candidate) => candidateMatchesHighlight(candidate, highlight))
      ? "ready" : job.status === "terminal_failed" ? "failed" : "pending",
  }));
  const artifact = current ? { artifactId: current.artifactId, savedItemId: current.savedItemId,
    candidates: current.candidates, promptVersion: source.artifact!.promptVersion } : undefined;
  if (job.status === "pending" || job.status === "leased") return {
    state: "processing" as const, jobId: job.jobId, status: job.status,
    ...(artifact ? { artifact } : {}), highlightStates,
  };
  if (job.status === "terminal_failed") {
    if (current) return { ...current, highlightStates };
    return { state: "failed" as const, jobId: job.jobId,
      failureCategory: publicFailureCategory(job.status, job.lastErrorCode) ?? "internal", highlightStates };
  }
  return current;
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

  async function boundJob(userId: string, savedItemId: string, jobId: string) {
    const source = await context(userId, savedItemId);
    const job = await repository.readAnalysisJobStatus(source.userId, source.savedItemId, jobId);
    if (!job) throw new CandidateAccessError();
    return { source, job };
  }

  function nonReadyJobState(job: CandidateAnalysisJobStatus) {
    if (job.status === "pending" || job.status === "leased") {
      return { state: "processing" as const, jobId: job.jobId, status: job.status };
    }
    if (job.status === "terminal_failed") {
      const failureCategory = publicFailureCategory(job.status, job.lastErrorCode);
      if (!failureCategory) throw new CandidateArtifactError();
      return { state: "failed" as const, jobId: job.jobId, failureCategory };
    }
    throw new CandidateArtifactError();
  }

  function replayMayAdvance(from: string, to: CandidateAnalysisJobStatus["status"]): boolean {
    if (from === "pending") {
      return to === "pending" || to === "leased" || to === "succeeded" || to === "terminal_failed";
    }
    if (from === "leased") {
      return to === "leased" || to === "succeeded" || to === "terminal_failed";
    }
    return from === to && (from === "succeeded" || from === "terminal_failed");
  }

  async function readJob(userId: string, savedItemId: string, jobId: string) {
    const { source, job } = await boundJob(userId, savedItemId, jobId);
    if (source.highlights !== undefined) {
      const result = modernJobState(source, job);
      if (result) return result;
    }
    const current = ready(source);
    if (current) return current;
    return nonReadyJobState(job);
  }

  return {
    async read(userId: string, savedItemId: string) {
      const source = await context(userId, savedItemId);
      if (source.highlights !== undefined && source.latestJob) {
        const result = modernJobState(source, source.latestJob);
        if (result) return result;
      }
      const current = ready(source);
      if (current) return current;
      return source.highlights !== undefined && source.gatewayAvailable
        ? { state: "idle" as const, highlightStates: [] }
        : { state: "gateway_required" as const };
    },
    readJob,
    async recover(userId: string, savedItemId: string, retryId?: string, highlightId?: string) {
      const source = await context(userId, savedItemId);
      const current = ready(source);
      const modern = source.highlights !== undefined;
      const missing = source.highlights?.filter((highlight) => highlight.status === "active" &&
        (highlightId === undefined || highlight.id === highlightId) &&
        !current?.candidates.some((candidate) => candidateMatchesHighlight(candidate, highlight)));
      if (modern && missing?.length === 0) throw new NothingToAnalyzeError();
      if (!modern && current) return current;
      if (modern && source.latestJob && ["pending", "leased"].includes(source.latestJob.status)) {
        return { ...modernJobState(source, source.latestJob)!, created: false };
      }
      const needsFreshRetry = modern && (source.latestJob?.status === "terminal_failed" ||
        current?.highlightStates?.some((state) => state.status === "failed"));
      const effectiveRetryId = retryId ?? (needsFreshRetry ? crypto.randomUUID() : undefined);
      const registered = await registrar.register({
        userId: source.userId,
        sourceId: source.sourceId,
        savedItemId: source.savedItemId,
        snapshotId: source.snapshotId,
        transcriptHash: source.transcriptHash,
        promptVersion: modern ? ANALYZE_MARKED_EXPRESSIONS_PROMPT_VERSION : ANALYZE_SAVED_ITEM_PROMPT_VERSION,
        ...(modern ? { highlightIds: missing!.map((highlight) => highlight.id) } : {}),
        ...(effectiveRetryId ? { retryId: effectiveRetryId } : {}),
        now: now(),
      });
      if (!registered) return { state: "gateway_required" as const };
      if (registered.created && (registered.status === "pending" || registered.status === "leased")) {
        return modern
          ? { ...modernJobState(source, { ...registered, status: registered.status as "pending" | "leased", lastErrorCode: null })!, created: true }
          : { state: "processing" as const, ...registered };
      }
      if (
        registered.status !== "pending" && registered.status !== "leased"
        && registered.status !== "succeeded" && registered.status !== "terminal_failed"
      ) throw new CandidateArtifactError();
      const replay = await boundJob(source.userId, source.savedItemId, registered.jobId);
      if (!replayMayAdvance(registered.status, replay.job.status)) {
        throw new CandidateArtifactError();
      }
      if (modern) {
        const result = modernJobState(replay.source, replay.job);
        if (result) return result.state === "processing" ? { ...result, created: registered.created } : result;
      }
      if (replay.job.status === "terminal_failed") return nonReadyJobState(replay.job);
      const replayArtifact = ready(replay.source);
      if (replayArtifact) return replayArtifact;
      const state = nonReadyJobState(replay.job);
      return state.state === "processing"
        ? { ...state, created: registered.created }
        : state;
    },
  };
}

type CandidateService = ReturnType<typeof createCandidateService>;

const MAX_BODY_BYTES = 256;

async function boundedRecoveryBody(request: Request) {
  if (!request.body) return {};
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
  // Next's Node adapter can represent a bodyless POST as an empty stream.
  // It has passed the same media-type and size checks as a nonempty body.
  if (byteLength === 0) return {};
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return RecoveryBodySchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
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
  if (error instanceof NothingToAnalyzeError) {
    return noStore(failure({ code: "NOTHING_TO_ANALYZE", message: "Mark at least one expression that has no learning card.", retryable: false }, requestId), 409);
  }
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
        const rawJobId = new URL(request.url).searchParams.get("jobId");
        const value = rawJobId === null
          ? await service.read(auth.userId, savedItemId)
          : await service.readJob(auth.userId, savedItemId, IdSchema.parse(rawJobId));
        return noStore(success(value, id), 200);
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
      let body: z.infer<typeof RecoveryBodySchema>;
      try {
        body = await boundedRecoveryBody(request);
      } catch {
        return noStore(failure({ code: "VALIDATION_FAILED", message: "Invalid request.", retryable: false }, id), 400);
      }
      try {
        const value = await service.recover(auth.userId, savedItemId, body.retryId, body.highlightId);
        return noStore(success(value, id), value.state === "processing" ? 202 : 200);
      } catch (error) {
        return routeError(error, id);
      }
    },
  };
}
