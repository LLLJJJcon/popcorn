import type { z } from "zod";

import type { KnowledgeJob } from "@/contracts/knowledge";
import type {
  LearningArtifactEvidence,
  LearningArtifactJobType,
  LearningArtifactProvider,
  LearningArtifactProviderResolver,
  ModelGatewayPin,
} from "@/server/ai/provider";
import {
  ModelGatewayError,
  OverviewJobInputSchema,
  validateOverviewContent,
} from "@/server/ai/provider";
import { nextJobFailure } from "@/server/domain/lease-job";
import type { DurableJobStore, JobHandler, JobHandlerResult } from "@/server/jobs/process-jobs";
import type { Json } from "@/types/database.generated";

type LeasedJob = Extract<KnowledgeJob, { status: "leased" }>;
type ArtifactType = "overview" | "segment_translation" | "selection_explanation";

export function createLearningArtifactHandler<TInput extends {
  readonly snapshotId: string;
  readonly transcriptHash: string;
  readonly promptVersion: string;
  readonly gatewayConfigId: string;
  readonly gatewayRevision: number;
  readonly gatewayFingerprint: string;
}>({
  store,
  providerResolver,
  jobType,
  artifactType,
  inputSchema,
  segmentIds,
  validateEvidence,
  invoke,
  validate,
}: {
  readonly store: DurableJobStore;
  readonly providerResolver: LearningArtifactProviderResolver;
  readonly jobType: LearningArtifactJobType;
  readonly artifactType: ArtifactType;
  readonly inputSchema: z.ZodType<TInput>;
  readonly segmentIds: (input: TInput) => readonly string[];
  readonly validateEvidence?: (evidence: LearningArtifactEvidence, input: TInput) => void;
  readonly invoke: (provider: LearningArtifactProvider, evidence: LearningArtifactEvidence, input: TInput) => Promise<unknown>;
  readonly validate: (value: unknown, evidence: LearningArtifactEvidence, input: TInput) => Json;
}): JobHandler {
  return async (job, expectedUserId, now): Promise<JobHandlerResult> => {
    if (job.userId !== expectedUserId) throw new Error("expected owner does not match claimed job");
    if (job.type !== jobType) throw new TypeError(`${jobType} handler received ${job.type}`);
    let code = "PROVIDER_OUTPUT_INVALID";
    try {
      const input = inputSchema.parse(await store.readPrivateInput(expectedUserId, job.id));
      const evidence = await store.readLearningArtifactEvidence(
        expectedUserId,
        job.sourceId,
        input.snapshotId,
        segmentIds(input),
      );
      if (!evidence || evidence.transcriptHash !== input.transcriptHash) throw new Error("persisted evidence mismatch");
      validateEvidence?.(evidence, input);
      const gatewayPin: ModelGatewayPin = {
        configId: input.gatewayConfigId,
        revision: input.gatewayRevision,
        fingerprint: input.gatewayFingerprint,
      };
      code = "PROVIDER_UNAVAILABLE";
      const resolved = await providerResolver.resolve(expectedUserId, gatewayPin);
      const raw = await invoke(resolved.provider, evidence, input);
      code = "PROVIDER_OUTPUT_INVALID";
      const content = validate(raw, evidence, input);
      if (new TextEncoder().encode(JSON.stringify(content)).byteLength > 262_144) throw new RangeError("artifact content too large");
      const artifactId = await store.completeGatewayLearningArtifact(
        expectedUserId,
        job,
        artifactType,
        content,
        input.promptVersion,
        resolved.model,
        job.dedupeKey,
        gatewayPin,
        now,
      );
      return artifactId ? "completed" : "deferred";
    } catch (error) {
      const failureCode = error instanceof ModelGatewayError ? error.code : code;
      const state = nextJobFailure(job, failureCode, now);
      const terminal = state.status === "terminal_failed";
      const persisted = await store.transitionLearningArtifactFailure(
        expectedUserId,
        job as LeasedJob,
        state,
        terminal,
      );
      if (!persisted) return "deferred";
      return terminal ? "failed" : "deferred";
    }
  };
}

export function createGenerateOverviewHandler({
  store,
  providerResolver,
}: {
  readonly store: DurableJobStore;
  readonly providerResolver: LearningArtifactProviderResolver;
}): JobHandler {
  return createLearningArtifactHandler<z.infer<typeof OverviewJobInputSchema>>({
    store,
    providerResolver,
    jobType: "generate_overview",
    artifactType: "overview",
    inputSchema: OverviewJobInputSchema,
    segmentIds: () => [],
    invoke: (activeProvider, evidence) => activeProvider.generateOverview(evidence),
    validate: (value, evidence) => validateOverviewContent(value, evidence) as Json,
  });
}
