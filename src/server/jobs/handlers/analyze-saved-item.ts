import type { KnowledgeJob } from "@/contracts/knowledge";
import {
  safeModelFailureCode,
  type SafeModelFailure,
} from "@/server/ai/model-output";
import { ModelGatewayError, type ModelGatewayPin } from "@/server/ai/provider";
import {
  ANALYZE_SAVED_ITEM_PROMPT_VERSION,
  buildAnalyzeSavedItemPrompt,
  normalizeSavedItemAnalysisWire,
} from "@/server/ai/prompts/analyze-saved-item.v1";
import type { StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import {
  SavedItemAnalysisJobInputSchema,
  groundSavedItemAnalysisContent,
} from "@/server/jobs/job-types";
import type {
  DurableJobStore,
  JobHandler,
  JobHandlerResult,
} from "@/server/jobs/process-jobs";
import type { Json } from "@/types/database.generated";

type LeasedJob = Extract<KnowledgeJob, { status: "leased" }>;
type TerminalJob = Extract<KnowledgeJob, { status: "terminal_failed" }>;

function terminalFailure(job: LeasedJob, lastErrorCode: string, now: string): TerminalJob {
  return {
    ...job,
    status: "terminal_failed",
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode,
    updatedAt: now,
  };
}

export function createAnalyzeSavedItemHandler({ store, gatewayResolver }: {
  readonly store: DurableJobStore;
  readonly gatewayResolver: StructuredJsonGatewayResolver;
}): JobHandler {
  return async (job, expectedUserId, now): Promise<JobHandlerResult> => {
    if (job.userId !== expectedUserId) {
      throw new Error("expected owner does not match claimed saved-item analysis job");
    }
    if (job.type !== "analyze_saved_item" || !job.savedItemId) {
      throw new TypeError("saved-item analysis handler received another job type");
    }

    let fallbackFailure: SafeModelFailure = new ModelGatewayError(
      "PROVIDER_OUTPUT_INVALID",
      "grounding",
    );
    try {
      const input = SavedItemAnalysisJobInputSchema.parse(
        await store.readPrivateInput(expectedUserId, job.id),
      );
      if (input.savedItemId !== job.savedItemId) {
        throw new Error("saved-item analysis input does not match the claimed job");
      }
      if (!store.readSavedItemAnalysisEvidence) {
        throw new Error("saved-item analysis evidence reader is unavailable");
      }
      const evidence = await store.readSavedItemAnalysisEvidence(
        expectedUserId,
        job.savedItemId,
        job.sourceId,
        input.snapshotId,
      );
      if (
        !evidence ||
        evidence.userId !== expectedUserId ||
        evidence.sourceId !== job.sourceId ||
        evidence.savedItemId !== job.savedItemId ||
        evidence.snapshotId !== input.snapshotId ||
        evidence.transcriptHash !== input.transcriptHash
      ) {
        throw new Error("persisted saved-item analysis evidence mismatch");
      }

      const gatewayPin: ModelGatewayPin = {
        configId: input.gatewayConfigId,
        revision: input.gatewayRevision,
        fingerprint: input.gatewayFingerprint,
      };
      fallbackFailure = new ModelGatewayError("PROVIDER_UNAVAILABLE", "transport");
      const gateway = await gatewayResolver.resolve(expectedUserId, gatewayPin);
      const promptVersion = input.promptVersion;
      if (promptVersion !== ANALYZE_SAVED_ITEM_PROMPT_VERSION) {
        throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID");
      }
      const prompt = buildAnalyzeSavedItemPrompt({
        kind: evidence.kind,
        rawText: evidence.rawText,
        sourceLines: evidence.segments.map((segment, sourceLineIndex) => ({
          sourceLineIndex,
          originalChinese: segment.originalChinese,
        })),
      });
      const raw = await gateway.complete(
        promptVersion,
        prompt.userPrompt,
        {
          systemPrompt: prompt.systemPrompt,
          timeoutMs: 30_000,
          maxTokens: 900,
          normalize: normalizeSavedItemAnalysisWire,
        },
      );
      fallbackFailure = new ModelGatewayError(
        "PROVIDER_OUTPUT_INVALID",
        "grounding",
        "sourceLineIndices",
      );
      const content = groundSavedItemAnalysisContent(raw, evidence);
      if (new TextEncoder().encode(JSON.stringify(content)).byteLength > 262_144) {
        throw new RangeError("saved-item analysis artifact is too large");
      }
      fallbackFailure = { code: "INTERNAL", stage: "persistence" };
      const artifactId = await store.completeGatewayLearningArtifact(
        expectedUserId,
        job,
        "saved_item_analysis",
        content as Json,
        promptVersion,
        gateway.model,
        job.dedupeKey,
        gatewayPin,
        now,
      );
      return artifactId ? "completed" : "deferred";
    } catch (error) {
      const code = error instanceof ModelGatewayError
        ? safeModelFailureCode(error)
        : safeModelFailureCode(fallbackFailure);
      const state = terminalFailure(job, code, now);
      const persisted = await store.transitionLearningArtifactFailure(
        expectedUserId,
        job as LeasedJob,
        state,
        true,
      );
      if (!persisted) return "deferred";
      return "failed";
    }
  };
}
