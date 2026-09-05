import { createHash } from "node:crypto";

import { z } from "zod";

import { CandidateExpressionListSchema, type CandidateExpression } from "@/contracts/knowledge";
import { PracticeTaskSchema, type PracticeTask } from "@/contracts/practice";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import type { ModelGatewayPin } from "@/server/ai/provider";
import {
  ACTIVATE_PRACTICE_PROMPT_VERSION,
  ActivationOutputSchema,
  buildActivatePracticePrompt,
} from "@/server/ai/prompts/activate.v1";
import type { StructuredJsonGateway, StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";

export type CandidateArtifactRecord = {
  readonly id: string;
  readonly userId: string;
  readonly videoSourceId: string;
  readonly savedItemId: string;
  readonly artifactType: string;
  readonly content: unknown;
};

export type PracticeDraftRecord = {
  readonly id: string;
  readonly userId: string;
  readonly videoSourceId: string;
  readonly savedItemId: string;
  readonly candidateArtifactId: string;
  readonly candidateIndex: number;
  readonly futureUserExpressionId: string;
  readonly nativeLanguage: "en";
  readonly targetLanguage: "zh-CN";
  readonly targetExpression: string;
  readonly promptChinese: string;
  readonly instructionsEnglish: string;
  readonly goalEnglish: string;
  readonly status: "active" | "completed" | "abandoned";
  readonly activationPromptVersion: string | null;
  readonly activationModel: string | null;
  readonly activationGatewayConfigId: string | null;
  readonly activationGatewayRevision: number | null;
  readonly activationGatewayFingerprint: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CandidateSelection = {
  readonly savedItemId: string;
  readonly candidateArtifactId: string;
  readonly candidateIndex: number;
};

export const CandidateSelectionSchema = z.strictObject({
  savedItemId: z.string().uuid(),
  candidateArtifactId: z.string().uuid(),
  candidateIndex: z.number().int().min(0).max(2),
});

const CandidateContentSchema = z.strictObject({ candidates: CandidateExpressionListSchema });
const UserIdSchema = z.string().uuid();

export type PracticeErrorCode =
  | "VALIDATION_FAILED"
  | "NOT_FOUND"
  | "GATEWAY_REQUIRED"
  | "PROVIDER_FAILED"
  | "REVISION_CONFLICT"
  | "INTERNAL_ERROR";

export class PracticeError extends Error {
  override readonly name = "PracticeError";

  constructor(readonly code: PracticeErrorCode, readonly retryable = false) {
    super(code);
  }
}

const MAX_BODY_BYTES = 8 * 1_024;

async function boundedJson(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new TypeError("invalid request");
  }
  if (!request.body) throw new TypeError("invalid request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new TypeError("invalid request");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export function practiceErrorResponse(error: unknown, requestId: string): Response {
  const practice = error instanceof PracticeError ? error : new PracticeError("INTERNAL_ERROR", true);
  const details = practice.code === "VALIDATION_FAILED"
    ? { code: "VALIDATION_FAILED" as const, message: "Invalid practice request", status: 400 }
    : practice.code === "NOT_FOUND"
      ? { code: "FORBIDDEN" as const, message: "Practice item not found", status: 404 }
      : practice.code === "GATEWAY_REQUIRED"
        ? { code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED" as const, message: "An active model gateway is required", status: 409 }
        : practice.code === "PROVIDER_FAILED"
          ? { code: "PROVIDER_OUTPUT_INVALID" as const, message: "Practice Provider is temporarily unavailable", status: 503 }
          : practice.code === "REVISION_CONFLICT"
            ? { code: "CONFLICT" as const, message: "Practice revision conflicts with current history", status: 409 }
            : { code: "INTERNAL_ERROR" as const, message: "Practice is temporarily unavailable", status: 500 };
  return Response.json(
    failure({ code: details.code, message: details.message, retryable: practice.retryable }, requestId),
    { status: details.status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function readPracticeMutation(
  request: Request,
  dependencies: {
    readonly authenticate: (request: Request) => Promise<WebSessionResult>;
    readonly appUrl: string;
    readonly requestId: string;
  },
): Promise<{ readonly ok: true; readonly userId: string; readonly body: unknown } | { readonly ok: false; readonly response: Response }> {
  const authenticated = await dependencies.authenticate(request);
  if (!authenticated.ok) {
    const code = authenticated.reason === "missing" ? "AUTH_REQUIRED" as const : "SESSION_EXPIRED" as const;
    const message = authenticated.reason === "missing" ? "Authentication is required" : "Your session has expired";
    return { ok: false, response: Response.json(
      failure({ code, message, retryable: false }, dependencies.requestId),
      { status: 401, headers: { "Cache-Control": "no-store" } },
    ) };
  }
  if (request.headers.get("origin") !== new URL(dependencies.appUrl).origin) {
    return { ok: false, response: Response.json(
      failure({ code: "FORBIDDEN", message: "Request origin is not allowed", retryable: false }, dependencies.requestId),
      { status: 403, headers: { "Cache-Control": "no-store" } },
    ) };
  }
  const contentType = request.headers.get("content-type");
  if (
    contentType === null ||
    !/^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i.test(contentType)
  ) {
    return {
      ok: false,
      response: practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), dependencies.requestId),
    };
  }
  try {
    return { ok: true, userId: authenticated.userId, body: await boundedJson(request) };
  } catch {
    return { ok: false, response: practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), dependencies.requestId) };
  }
}

export interface PracticeRepository {
  findCandidate(userId: string, selection: CandidateSelection): Promise<CandidateArtifactRecord | null>;
  findDraftBySelection(userId: string, selection: CandidateSelection): Promise<PracticeDraftRecord | null>;
  findDraft(userId: string, taskId: string): Promise<PracticeDraftRecord | null>;
  insertDraft(input: PracticeDraftRecord): Promise<PracticeDraftRecord>;
  resolveActiveGatewayPin(userId: string): Promise<ModelGatewayPin | null>;
  findAttempt(userId: string, attemptId: string): Promise<import("@/server/repositories/attempt-repository").PracticeDraftAttemptRecord | null>;
  nextRevision(userId: string, taskId: string): Promise<number>;
  insertAttempt(input: import("@/server/repositories/attempt-repository").PracticeDraftAttemptRecord): Promise<import("@/server/repositories/attempt-repository").PracticeDraftAttemptRecord>;
}

export type ResolvedPracticeEgress = {
  readonly gateway: StructuredJsonGateway;
  readonly pin: ModelGatewayPin | null;
};

export async function resolvePracticeEgress(
  userId: string,
  dependencies: {
    readonly ci: boolean;
    readonly fixtureGateway: StructuredJsonGateway;
    readonly gatewayResolver: StructuredJsonGatewayResolver;
    readonly repository: Pick<PracticeRepository, "resolveActiveGatewayPin">;
  },
): Promise<ResolvedPracticeEgress> {
  if (dependencies.ci) return { gateway: dependencies.fixtureGateway, pin: null };
  const pin = await dependencies.repository.resolveActiveGatewayPin(userId);
  if (!pin) throw new PracticeError("GATEWAY_REQUIRED");
  try {
    return { gateway: await dependencies.gatewayResolver.resolve(userId, pin), pin };
  } catch {
    throw new PracticeError("PROVIDER_FAILED", true);
  }
}

function deterministicUuid(scope: string): string {
  const bytes = Buffer.from(createHash("sha256").update(scope).digest().subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function practiceTaskView(draft: PracticeDraftRecord): PracticeTask {
  return PracticeTaskSchema.parse({
    id: draft.id,
    userId: draft.userId,
    userExpressionId: draft.futureUserExpressionId,
    kind: "use_it_now",
    nativeLanguage: draft.nativeLanguage,
    targetLanguage: draft.targetLanguage,
    targetExpression: draft.targetExpression,
    promptChinese: draft.promptChinese,
    instructionsEnglish: draft.instructionsEnglish,
    goalEnglish: draft.goalEnglish,
    dueAt: null,
    createdAt: draft.createdAt,
  });
}

function exactCandidate(artifact: CandidateArtifactRecord, selection: CandidateSelection): CandidateExpression {
  if (
    artifact.artifactType !== "saved_item_analysis" ||
    artifact.id !== selection.candidateArtifactId ||
    artifact.savedItemId !== selection.savedItemId
  ) throw new PracticeError("NOT_FOUND");
  const content = CandidateContentSchema.safeParse(artifact.content);
  const candidate = content.success ? content.data.candidates[selection.candidateIndex] : undefined;
  if (!candidate) throw new PracticeError("NOT_FOUND");
  return candidate;
}

export function createPracticeTaskService(dependencies: {
  readonly repository: PracticeRepository;
  readonly gatewayResolver: StructuredJsonGatewayResolver;
  readonly fixtureGateway: StructuredJsonGateway;
  readonly ci: boolean;
  readonly now: () => string;
  readonly attemptId: () => string;
  readonly onPersisted?: () => void;
}) {
  return {
    async activate(userIdValue: string, selectionValue: CandidateSelection): Promise<PracticeTask> {
      const userId = UserIdSchema.safeParse(userIdValue);
      const selection = CandidateSelectionSchema.safeParse(selectionValue);
      if (!userId.success || !selection.success) throw new PracticeError("VALIDATION_FAILED");

      const artifact = await dependencies.repository.findCandidate(userId.data, selection.data);
      if (!artifact || artifact.userId !== userId.data) throw new PracticeError("NOT_FOUND");
      const candidate = exactCandidate(artifact, selection.data);
      const existing = await dependencies.repository.findDraftBySelection(userId.data, selection.data);
      if (existing) return practiceTaskView(existing);

      const resolved = await resolvePracticeEgress(userId.data, dependencies);
      let output: z.infer<typeof ActivationOutputSchema>;
      try {
        output = ActivationOutputSchema.parse(await resolved.gateway.complete(
          ACTIVATE_PRACTICE_PROMPT_VERSION,
          buildActivatePracticePrompt(candidate),
          {
            systemPrompt: `Popcorn learning artifact task ${ACTIVATE_PRACTICE_PROMPT_VERSION}. Return only the requested JSON object.`,
            timeoutMs: 30_000,
            maxTokens: 250,
            normalize(value) {
              const parsed = ActivationOutputSchema.safeParse(value);
              if (parsed.success) return { success: true, data: parsed.data };
              const fieldPath = parsed.error.issues[0]?.path.join(".");
              return { success: false, ...(fieldPath ? { fieldPath } : {}) };
            },
          },
        ));
        if (
          output.targetExpression !== candidate.expression ||
          output.evidenceText !== candidate.evidenceText ||
          output.communicativeFunction !== candidate.communicativeFunction ||
          output.promptChinese.includes(candidate.expression) ||
          !/[？?]\s*$/u.test(output.promptChinese)
        ) throw new TypeError("invalid grounded learner-first activation");
      } catch {
        throw new PracticeError("PROVIDER_FAILED", true);
      }

      const taskId = deterministicUuid([
        "practice-draft-v1", userId.data, selection.data.savedItemId,
        selection.data.candidateArtifactId, String(selection.data.candidateIndex),
      ].join(":"));
      const now = dependencies.now();
      const draft: PracticeDraftRecord = {
        id: taskId,
        userId: userId.data,
        videoSourceId: artifact.videoSourceId,
        savedItemId: selection.data.savedItemId,
        candidateArtifactId: selection.data.candidateArtifactId,
        candidateIndex: selection.data.candidateIndex,
        futureUserExpressionId: dependencies.attemptId(),
        nativeLanguage: "en",
        targetLanguage: "zh-CN",
        targetExpression: candidate.expression,
        promptChinese: output.promptChinese,
        instructionsEnglish: output.instructionsEnglish,
        goalEnglish: output.goalEnglish,
        status: "active",
        activationPromptVersion: resolved.pin ? ACTIVATE_PRACTICE_PROMPT_VERSION : null,
        activationModel: resolved.pin ? resolved.gateway.model : null,
        activationGatewayConfigId: resolved.pin?.configId ?? null,
        activationGatewayRevision: resolved.pin?.revision ?? null,
        activationGatewayFingerprint: resolved.pin?.fingerprint ?? null,
        createdAt: now,
        updatedAt: now,
      };
      let persisted: PracticeDraftRecord;
      try {
        persisted = await dependencies.repository.insertDraft(draft);
      } catch {
        throw new PracticeError("INTERNAL_ERROR", true);
      }
      dependencies.onPersisted?.();
      return practiceTaskView(persisted);
    },
  };
}

export function createPracticeTaskHttpHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly activate: (userId: string, selection: CandidateSelection) => Promise<unknown>;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  return async (request: Request): Promise<Response> => {
    const requestId = dependencies.requestId();
    const mutation = await readPracticeMutation(request, { ...dependencies, requestId });
    if (!mutation.ok) return mutation.response;
    const selection = CandidateSelectionSchema.safeParse(mutation.body);
    if (!selection.success) return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"), requestId);
    try {
      return Response.json(success(await dependencies.activate(mutation.userId, selection.data), requestId), {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return practiceErrorResponse(error, requestId);
    }
  };
}
