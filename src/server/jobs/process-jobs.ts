import { timingSafeEqual } from "node:crypto";

import {
  KnowledgeJobSchema,
  type KnowledgeJob,
  type KnowledgeJobType,
} from "@/contracts/knowledge";
import { SavedItemKindSchema } from "@/contracts/source";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failure, success } from "@/server/api/respond";
import type {
  NativeTranscriptSnapshot,
  TranscriptProvider,
  TranscriptRouteStore,
} from "@/server/transcript/provider";
import type {
  LearningArtifactEvidence,
  LearningArtifactProviderResolver,
  ModelGatewayPin,
} from "@/server/ai/provider";
import type { StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { createAnalyzeSavedItemHandler } from "@/server/jobs/handlers/analyze-saved-item";
import { createExplainSelectionHandler } from "@/server/jobs/handlers/explain-selection";
import { createGenerateOverviewHandler } from "@/server/jobs/handlers/generate-overview";
import { createResolveSnapshotHandler } from "@/server/jobs/handlers/resolve-snapshot";
import { createTranslateSegmentsHandler } from "@/server/jobs/handlers/translate-segments";
import {
  createSavedItemAnalysisJobKey,
  SavedItemAnalysisJobInputSchema,
  type SavedItemAnalysisEvidence,
} from "@/server/jobs/job-types";
import type { Database, Json } from "@/types/database.generated";

export const MAX_PROCESS_BATCH_SIZE = 5;

export interface DurableJobStore {
  /**
   * Implemented by the controller-owned atomic database claim RPC. It is the
   * only cross-tenant operation: returned rows already carry their DB-derived
   * owner and a persisted lease. All subsequent operations require that owner.
   */
  claimJobs(limit: number, now: string): Promise<readonly KnowledgeJob[]>;
  readPrivateInput(expectedUserId: string, jobId: string): Promise<unknown>;
  readVideoId(expectedUserId: string, sourceId: string): Promise<string>;
  transitionFailure(
    expectedUserId: string,
    expectedLease: Extract<KnowledgeJob, { status: "leased" }>,
    state: Extract<KnowledgeJob, { status: "retryable_failed" | "terminal_failed" }>,
    privateChange: {
      readonly providerJobId: string | null;
      readonly clearInput: boolean;
    },
  ): Promise<boolean>;
  persistSnapshotEvidence(
    expectedUserId: string,
    leased: Extract<KnowledgeJob, { status: "leased" }>,
    snapshot: NativeTranscriptSnapshot,
    completedAt: string,
  ): Promise<string>;
  completeResolved(
    expectedUserId: string,
    leased: Extract<KnowledgeJob, { status: "leased" }>,
    snapshotId: string,
    completedAt: string,
  ): Promise<boolean>;
  readLearningArtifactEvidence(
    expectedUserId: string,
    sourceId: string,
    snapshotId: string,
    segmentIds: readonly string[],
  ): Promise<LearningArtifactEvidence | null>;
  readSavedItemAnalysisEvidence?(
    expectedUserId: string,
    savedItemId: string,
    sourceId: string,
    snapshotId: string,
  ): Promise<SavedItemAnalysisEvidence | null>;
  transitionLearningArtifactFailure(
    expectedUserId: string,
    expectedLease: Extract<KnowledgeJob, { status: "leased" }>,
    state: Extract<KnowledgeJob, { status: "retryable_failed" | "terminal_failed" }>,
    clearInput: boolean,
  ): Promise<boolean>;
  completeGatewayLearningArtifact(
    expectedUserId: string,
    expectedLease: Extract<KnowledgeJob, { status: "leased" }>,
    artifactType: "overview" | "segment_translation" | "selection_explanation" | "saved_item_analysis",
    content: Json,
    promptVersion: string,
    model: string,
    resultKey: string,
    gatewayPin: ModelGatewayPin,
    completedAt: string,
  ): Promise<string | null>;
}

export type JobHandlerResult = "completed" | "deferred" | "failed";
export type JobHandler = (
  job: Extract<KnowledgeJob, { status: "leased" }>,
  expectedUserId: string,
  now: string,
) => Promise<JobHandlerResult>;

type HandlerMap = Partial<Record<KnowledgeJobType, JobHandler>>;

export function createProcessorHandlers({
  store,
  transcriptProvider,
  learningProviderResolver,
  analysisGatewayResolver,
}: {
  readonly store: ReturnType<typeof createSupabaseDurableJobStore>;
  readonly transcriptProvider: TranscriptProvider;
  readonly learningProviderResolver: LearningArtifactProviderResolver;
  readonly analysisGatewayResolver: StructuredJsonGatewayResolver;
}) {
  return {
    resolve_snapshot: createResolveSnapshotHandler({ store, provider: transcriptProvider }),
    generate_overview: createGenerateOverviewHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    translate_segments: createTranslateSegmentsHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    explain_selection: createExplainSelectionHandler({
      store,
      providerResolver: learningProviderResolver,
    }),
    analyze_saved_item: createAnalyzeSavedItemHandler({
      store,
      gatewayResolver: analysisGatewayResolver,
    }),
  };
}

export type ProcessSummary = {
  readonly claimed: number;
  readonly completed: number;
  readonly deferred: number;
  readonly failed: number;
};

type AuthenticatedUser = { readonly userId: string };
type JobStatusRouteContext = {
  readonly params: Promise<{ readonly jobId: string }>;
};

export type PublicJobStatus = {
  readonly id: string;
  readonly status: "pending" | "leased" | "succeeded" | "retryable_failed" | "terminal_failed";
  readonly retryable: boolean;
  readonly result: { readonly snapshotId: string } | { readonly artifactId: string } | null;
};

const PublicResolveSnapshotResultSchema = z
  .object({ snapshotId: z.string().uuid() })
  .strict();
const PublicLearningArtifactResultSchema = z
  .object({ artifactId: z.string().uuid() })
  .strict();

export function parsePublicResolveSnapshotResult(
  value: unknown,
): NonNullable<PublicJobStatus["result"]> {
  return PublicResolveSnapshotResultSchema.parse(value);
}

export function parsePublicLearningArtifactResult(
  value: unknown,
): { readonly artifactId: string } {
  return PublicLearningArtifactResultSchema.parse(value);
}

type JobStatusRouteDependencies = {
  readonly authenticate: (request: Request) => Promise<AuthenticatedUser | null>;
  readonly readPublicStatus: (
    expectedUserId: string,
    jobId: string,
  ) => Promise<PublicJobStatus | null>;
  readonly requestId: () => string;
};

function noStoreJson(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function createJobStatusRoute(dependencies: JobStatusRouteDependencies) {
  return async (
    request: Request,
    context: JobStatusRouteContext,
  ): Promise<Response> => {
    const requestId = dependencies.requestId();
    const authenticated = await dependencies.authenticate(request);
    if (!authenticated) {
      return noStoreJson(
        failure(
          { code: "AUTH_REQUIRED", message: "Authentication is required", retryable: false },
          requestId,
        ),
        401,
      );
    }
    const parsedJobId = z.string().uuid().safeParse((await context.params).jobId);
    if (!parsedJobId.success) {
      return noStoreJson(
        failure({ code: "VALIDATION_FAILED", message: "Invalid job ID", retryable: false }, requestId),
        400,
      );
    }
    const status = await dependencies.readPublicStatus(
      authenticated.userId,
      parsedJobId.data,
    );
    if (!status) {
      return noStoreJson(
        failure({ code: "FORBIDDEN", message: "Job not found", retryable: false }, requestId),
        404,
      );
    }
    return noStoreJson(success(status, requestId), 200);
  };
}

type InternalProcessResult = {
  readonly claimed: number;
  readonly completed: number;
  readonly deferred?: number;
  readonly failed?: number;
};

type InternalProcessDependencies = {
  readonly secret: string;
  readonly maxBatchSize: number;
  readonly processBounded: (limit: number) => Promise<InternalProcessResult>;
};

function hasExactBearer(request: Request, secret: string): boolean {
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return (
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

export function createInternalProcessRoute(dependencies: InternalProcessDependencies) {
  if (dependencies.secret.trim().length === 0) {
    throw new TypeError("internal job secret is required");
  }
  if (!Number.isInteger(dependencies.maxBatchSize) || dependencies.maxBatchSize < 1) {
    throw new RangeError("maxBatchSize must be a positive integer");
  }

  return async (request: Request): Promise<Response> => {
    if (!hasExactBearer(request, dependencies.secret)) {
      return Response.json({ ok: false }, { status: 401 });
    }
    const result = await dependencies.processBounded(dependencies.maxBatchSize);
    return Response.json({
      ok: true,
      claimed: result.claimed,
      completed: result.completed,
      ...(result.deferred === undefined ? {} : { deferred: result.deferred }),
      ...(result.failed === undefined ? {} : { failed: result.failed }),
    }, { status: 200 });
  };
}

function assertCanonicalUtc(value: string): void {
  if (new Date(value).toISOString() !== value) {
    throw new RangeError("now must be a canonical UTC instant");
  }
}

export function createJobProcessor({
  store,
  handlers,
}: {
  readonly store: DurableJobStore;
  readonly handlers: HandlerMap;
}) {
  return {
    async processBounded(now: string, limit: number): Promise<ProcessSummary> {
      assertCanonicalUtc(now);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PROCESS_BATCH_SIZE) {
        throw new RangeError(`limit must be between 1 and ${MAX_PROCESS_BATCH_SIZE}`);
      }

      const claimed = await store.claimJobs(limit, now);
      if (claimed.length > limit) {
        throw new Error("atomic claim returned more jobs than requested");
      }

      const outcomes = await Promise.all(claimed.map(async (rawJob) => {
        const job = KnowledgeJobSchema.parse(rawJob);
        if (job.status !== "leased") {
          throw new Error("atomic claim must return leased jobs");
        }
        const handler = handlers[job.type];
        if (!handler) {
          throw new Error(`no handler registered for ${job.type}`);
        }
        return handler(job, job.userId, now);
      }));
      const summary = { claimed: claimed.length, completed: 0, deferred: 0, failed: 0 };
      for (const outcome of outcomes) summary[outcome] += 1;
      return summary;
    },
  };
}

type JobRow = Database["public"]["Tables"]["knowledge_jobs"]["Row"];

function contractJob(row: JobRow): KnowledgeJob {
  return KnowledgeJobSchema.parse({
    id: row.id,
    userId: row.user_id,
    sourceId: row.video_source_id,
    savedItemId: row.saved_item_id,
    type: row.job_type,
    status: row.status,
    dedupeKey: row.dedupe_key,
    attemptCount: row.attempt_count,
    nextAttemptAt: row.next_attempt_at,
    leaseExpiresAt: row.lease_expires_at,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function objectValue(value: Json, key: string): Json | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value[key]
    : undefined;
}

function optionalString(value: Json | undefined, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function optionalNumber(value: Json | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function savedItemSegmentIds(payload: Json): readonly string[] | null {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return [];
  const one = typeof payload.segmentId === "string" ? [payload.segmentId] : [];
  const many = Array.isArray(payload.segmentIds)
    ? payload.segmentIds.filter((value): value is string => typeof value === "string")
    : [];
  const ids = [...new Set([...one, ...many])];
  return ids.length <= 32 ? ids : null;
}

function savedItemRawText(payload: Json, fallback: string): string {
  const direct = ["originalChinese", "exactQuote", "selectedChinese", "title"]
    .map((key) => objectValue(payload, key))
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return direct ?? fallback;
}

export type SavedItemAnalysisRegistration = {
  readonly userId: string;
  readonly sourceId: string;
  readonly savedItemId: string;
  readonly snapshotId: string;
  readonly transcriptHash: string;
  readonly promptVersion: string;
  readonly now: string;
};

const ActiveGatewayPinRowSchema = z.strictObject({
  config_id: z.string().uuid(),
  revision: z.number().int().positive(),
  config_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  model: z.string().trim().min(1).max(100),
});

const SavedItemAnalysisRegistrationResultSchema = z.strictObject({
  knowledge_job_id: z.string().uuid(),
  status: z.string().trim().min(1).max(100),
  created: z.boolean(),
});

export function createSupabaseSavedItemAnalysisRegistrar(client: SupabaseClient<Database>) {
  return {
    async register(registration: SavedItemAnalysisRegistration) {
      const userId = z.string().uuid().parse(registration.userId);
      const activePin = await client.rpc("resolve_active_user_model_gateway_pin", {
        p_user_id: userId,
      });
      if (activePin.error) throw activePin.error;
      if (activePin.data.length !== 1) return null;
      const pin = ActiveGatewayPinRowSchema.parse(activePin.data[0]);
      const input = SavedItemAnalysisJobInputSchema.parse({
        kind: "analyze_saved_item",
        savedItemId: registration.savedItemId,
        snapshotId: registration.snapshotId,
        transcriptHash: registration.transcriptHash,
        promptVersion: registration.promptVersion,
        gatewayConfigId: pin.config_id,
        gatewayRevision: pin.revision,
        gatewayFingerprint: pin.config_fingerprint,
      });
      const dedupeKey = createSavedItemAnalysisJobKey({
        sourceHash: input.transcriptHash,
        savedItemId: input.savedItemId,
        snapshotId: input.snapshotId,
        promptVersion: input.promptVersion,
        gatewayFingerprint: input.gatewayFingerprint,
      });
      const result = await client.rpc("register_gateway_learning_artifact_job", {
        p_user_id: userId,
        p_video_source_id: z.string().uuid().parse(registration.sourceId),
        p_job_type: "analyze_saved_item",
        p_dedupe_key: dedupeKey,
        p_input: input,
        p_config_id: input.gatewayConfigId,
        p_expected_config_revision: input.gatewayRevision,
        p_expected_config_fingerprint: input.gatewayFingerprint,
        p_now: z.string().datetime({ offset: true }).parse(registration.now),
      });
      if (result.error) throw result.error;
      if (result.data.length !== 1) {
        throw new Error("saved-item analysis registration returned an invalid result");
      }
      const parsed = SavedItemAnalysisRegistrationResultSchema.parse(result.data[0]);
      return {
        jobId: parsed.knowledge_job_id,
        status: parsed.status,
        created: parsed.created,
      };
    },
  };
}

/** Production adapter. The claim RPC is the sole global queue operation. */
export function createSupabaseDurableJobStore(
  client: SupabaseClient<Database>,
): DurableJobStore {
  return {
    async claimJobs(limit, now) {
      const claimed = await client.rpc("claim_knowledge_jobs", {
        p_limit: limit,
        p_now: now,
      });
      if (claimed.error) throw claimed.error;
      return claimed.data.map(contractJob);
    },

    async readPrivateInput(expectedUserId, jobId) {
      const result = await client
        .from("knowledge_job_internal")
        .select("input,user_id")
        .eq("user_id", expectedUserId)
        .eq("knowledge_job_id", jobId)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return null;
      if (result.data.user_id !== expectedUserId) throw new Error("private job owner mismatch");
      return result.data.input;
    },

    async readVideoId(expectedUserId, sourceId) {
      const result = await client
        .from("video_sources")
        .select("youtube_video_id,user_id")
        .eq("user_id", expectedUserId)
        .eq("id", sourceId)
        .single();
      if (result.error || result.data.user_id !== expectedUserId) {
        throw result.error ?? new Error("source owner mismatch");
      }
      return result.data.youtube_video_id;
    },

    async transitionFailure(expectedUserId, expectedLease, state, privateChange) {
      if (
        expectedLease.userId !== expectedUserId ||
        state.userId !== expectedUserId ||
        state.id !== expectedLease.id ||
        state.attemptCount !== expectedLease.attemptCount
      ) {
        throw new Error("job owner or lease mismatch");
      }
      const transitioned = await client.rpc("transition_resolve_snapshot_failure", {
        p_user_id: expectedUserId,
        p_job_id: expectedLease.id,
        p_expected_lease_expires_at: expectedLease.leaseExpiresAt,
        p_expected_attempt_count: expectedLease.attemptCount,
        p_target_status: state.status,
        p_next_attempt_at: state.nextAttemptAt as string,
        p_error_code: state.lastErrorCode,
        p_provider_job_id: privateChange.providerJobId as string,
        p_clear_input: privateChange.clearInput,
        p_now: state.updatedAt,
      });
      if (transitioned.error) throw transitioned.error;
      return transitioned.data;
    },

    async persistSnapshotEvidence(expectedUserId, leased, snapshot, completedAt) {
      if (leased.userId !== expectedUserId) throw new Error("job owner mismatch");
      const source = await client
        .from("video_sources")
        .select("youtube_video_id,user_id")
        .eq("user_id", expectedUserId)
        .eq("id", leased.sourceId)
        .single();
      if (source.error || source.data.user_id !== expectedUserId) {
        throw source.error ?? new Error("source owner mismatch");
      }
      const videoSave = await client
        .from("saved_items")
        .select("payload")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", leased.sourceId)
        .eq("kind", "video")
        .order("captured_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (videoSave.error) throw videoSave.error;
      const payload = videoSave.data?.payload ?? {};
      const inferredDuration = Math.max(
        ...snapshot.segments.map((segment) => segment.endSeconds),
      );
      const snapshotWrite = await client.from("video_snapshots").upsert(
        {
          user_id: expectedUserId,
          video_source_id: leased.sourceId,
          title: optionalString(
            objectValue(payload, "title"),
            `YouTube video ${source.data.youtube_video_id}`,
          ),
          channel: optionalString(objectValue(payload, "channel"), "YouTube"),
          thumbnail_url: `https://i.ytimg.com/vi/${source.data.youtube_video_id}/hqdefault.jpg`,
          duration_seconds: optionalNumber(
            objectValue(payload, "durationSeconds"),
            inferredDuration,
          ),
          description:
            typeof objectValue(payload, "description") === "string"
              ? (objectValue(payload, "description") as string)
              : "",
          transcript_language: "zh-CN",
          transcript_hash: snapshot.transcriptHash,
          captured_at: completedAt,
        },
        { onConflict: "video_source_id,transcript_hash", ignoreDuplicates: true },
      );
      if (snapshotWrite.error) throw snapshotWrite.error;
      const persisted = await client
        .from("video_snapshots")
        .select("id,user_id")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", leased.sourceId)
        .eq("transcript_hash", snapshot.transcriptHash)
        .single();
      if (persisted.error || persisted.data.user_id !== expectedUserId) {
        throw persisted.error ?? new Error("snapshot owner mismatch");
      }
      const segments = snapshot.segments.map((segment) => ({
        user_id: expectedUserId,
        snapshot_id: persisted.data.id,
        stable_id: segment.stableId,
        position: segment.position,
        original_chinese: segment.originalChinese,
        start_seconds: segment.startSeconds,
        end_seconds: segment.endSeconds,
        language: "zh-CN",
      }));
      const segmentWrite = await client
        .from("transcript_segments")
        .upsert(segments, { onConflict: "snapshot_id,stable_id", ignoreDuplicates: true });
      if (segmentWrite.error) throw segmentWrite.error;

      return persisted.data.id;
    },

    async completeResolved(expectedUserId, leased, snapshotId, completedAt) {
      if (leased.userId !== expectedUserId) throw new Error("job owner mismatch");
      const completed = await client.rpc("complete_resolve_snapshot_job", {
        p_user_id: expectedUserId,
        p_job_id: leased.id,
        p_expected_lease_expires_at: leased.leaseExpiresAt,
        p_expected_attempt_count: leased.attemptCount,
        p_snapshot_id: snapshotId,
        p_now: completedAt,
      });
      if (completed.error) throw completed.error;
      return completed.data;
    },

    async readLearningArtifactEvidence(expectedUserId, sourceId, snapshotId, segmentIds) {
      const source = await client.from("video_sources")
        .select("id,user_id,youtube_video_id")
        .eq("user_id", expectedUserId).eq("id", sourceId).maybeSingle();
      if (source.error) throw source.error;
      if (!source.data || source.data.user_id !== expectedUserId) return null;
      const snapshot = await client.from("video_snapshots")
        .select("id,user_id,video_source_id,transcript_hash,title")
        .eq("user_id", expectedUserId).eq("video_source_id", sourceId)
        .eq("id", snapshotId).maybeSingle();
      if (snapshot.error) throw snapshot.error;
      if (!snapshot.data || snapshot.data.user_id !== expectedUserId) return null;
      let query = client.from("transcript_segments")
        .select("stable_id,original_chinese,start_seconds,end_seconds,user_id")
        .eq("user_id", expectedUserId).eq("snapshot_id", snapshotId);
      if (segmentIds.length > 0) query = query.in("stable_id", [...segmentIds]);
      const segments = await query.order("position", { ascending: true });
      if (segments.error) throw segments.error;
      if (segments.data.some((segment) => segment.user_id !== expectedUserId)) throw new Error("transcript owner mismatch");
      if (segmentIds.length > 0) {
        const found = new Set(segments.data.map((segment) => segment.stable_id));
        if (segmentIds.some((id) => !found.has(id))) return null;
      }
      const byId = new Map(segments.data.map((segment) => [segment.stable_id, segment]));
      const ordered = segmentIds.length > 0 ? segmentIds.map((id) => byId.get(id)!) : segments.data;
      return {
        userId: expectedUserId,
        sourceId,
        videoId: source.data.youtube_video_id,
        snapshotId: snapshot.data.id,
        transcriptHash: snapshot.data.transcript_hash,
        title: snapshot.data.title,
        segments: ordered.map((segment) => ({
          stableId: segment.stable_id,
          originalChinese: segment.original_chinese,
          startSeconds: segment.start_seconds,
          endSeconds: segment.end_seconds,
        })),
      };
    },

    async readSavedItemAnalysisEvidence(expectedUserId, savedItemId, sourceId, snapshotId) {
      const item = await client.from("saved_items")
        .select("id,user_id,video_source_id,snapshot_id,kind,status,start_seconds,payload")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", sourceId)
        .eq("id", savedItemId)
        .maybeSingle();
      if (item.error) throw item.error;
      const kind = SavedItemKindSchema.safeParse(item.data?.kind);
      if (
        !item.data ||
        item.data.user_id !== expectedUserId ||
        item.data.video_source_id !== sourceId ||
        item.data.snapshot_id !== snapshotId ||
        item.data.status !== "ready" ||
        !kind.success
      ) return null;

      const snapshot = await client.from("video_snapshots")
        .select("id,user_id,video_source_id,transcript_hash")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", sourceId)
        .eq("id", snapshotId)
        .maybeSingle();
      if (snapshot.error) throw snapshot.error;
      if (
        !snapshot.data ||
        snapshot.data.user_id !== expectedUserId ||
        snapshot.data.video_source_id !== sourceId
      ) return null;

      const exactIds = savedItemSegmentIds(item.data.payload);
      if (exactIds === null) return null;
      let segmentQuery = client.from("transcript_segments")
        .select("stable_id,user_id,snapshot_id,original_chinese,start_seconds,end_seconds,position")
        .eq("user_id", expectedUserId)
        .eq("snapshot_id", snapshotId);
      if (exactIds.length > 0) {
        segmentQuery = segmentQuery.in("stable_id", [...exactIds]);
      } else if (item.data.start_seconds !== null) {
        segmentQuery = segmentQuery
          .gte("end_seconds", Math.max(0, item.data.start_seconds - 30))
          .lte("start_seconds", item.data.start_seconds + 30);
      }
      const segments = await segmentQuery
        .order("position", { ascending: true })
        .limit(exactIds.length > 0 ? 32 : 12);
      if (segments.error) throw segments.error;
      if (segments.data.some((segment) =>
        segment.user_id !== expectedUserId || segment.snapshot_id !== snapshotId
      )) throw new Error("saved-item transcript owner mismatch");
      if (exactIds.length > 0) {
        const found = new Set(segments.data.map((segment) => segment.stable_id));
        if (exactIds.some((id) => !found.has(id))) return null;
      }
      if (segments.data.length === 0) return null;
      const mappedSegments = segments.data.map((segment) => ({
        stableId: segment.stable_id,
        originalChinese: segment.original_chinese,
        startSeconds: segment.start_seconds,
        endSeconds: segment.end_seconds,
      }));
      return {
        userId: expectedUserId,
        sourceId,
        savedItemId,
        snapshotId,
        transcriptHash: snapshot.data.transcript_hash,
        kind: kind.data,
        rawText: savedItemRawText(
          item.data.payload,
          mappedSegments.map((segment) => segment.originalChinese).join("\n"),
        ),
        startSeconds: item.data.start_seconds,
        segments: mappedSegments,
      };
    },

    async transitionLearningArtifactFailure(expectedUserId, expectedLease, state, clearInput) {
      if (
        expectedLease.userId !== expectedUserId || state.userId !== expectedUserId ||
        state.id !== expectedLease.id || state.attemptCount !== expectedLease.attemptCount ||
        !(["generate_overview", "translate_segments", "explain_selection", "analyze_saved_item"] as const)
          .includes(expectedLease.type as "generate_overview" | "translate_segments" | "explain_selection" | "analyze_saved_item")
      ) throw new Error("learning-artifact job owner or lease mismatch");
      const result = await client.rpc("transition_learning_artifact_failure", {
        p_user_id: expectedUserId,
        p_job_id: expectedLease.id,
        p_video_source_id: expectedLease.sourceId,
        p_job_type: expectedLease.type,
        p_expected_lease_expires_at: expectedLease.leaseExpiresAt,
        p_expected_attempt_count: expectedLease.attemptCount,
        p_target_status: state.status,
        p_next_attempt_at: state.nextAttemptAt as string,
        p_error_code: state.lastErrorCode,
        p_clear_input: clearInput,
        p_now: state.updatedAt,
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async completeGatewayLearningArtifact(expectedUserId, expectedLease, artifactType, content, promptVersion, model, resultKey, gatewayPin, completedAt) {
      if (expectedLease.userId !== expectedUserId) throw new Error("learning-artifact owner mismatch");
      const result = await client.rpc("complete_gateway_learning_artifact_job", {
        p_user_id: expectedUserId,
        p_job_id: expectedLease.id,
        p_video_source_id: expectedLease.sourceId,
        p_job_type: expectedLease.type,
        p_expected_lease_expires_at: expectedLease.leaseExpiresAt,
        p_expected_attempt_count: expectedLease.attemptCount,
        p_artifact_type: artifactType,
        p_content: content,
        p_prompt_version: promptVersion,
        p_model: model,
        p_result_key: resultKey,
        p_config_id: gatewayPin.configId,
        p_expected_config_revision: gatewayPin.revision,
        p_expected_config_fingerprint: gatewayPin.fingerprint,
        p_now: completedAt,
      });
      if (result.error) throw result.error;
      return result.data;
    },
  };
}

async function ownedSourceId(
  client: SupabaseClient<Database>,
  expectedUserId: string,
  videoId: string,
): Promise<string> {
  const existing = await client
    .from("video_sources")
    .select("id")
    .eq("user_id", expectedUserId)
    .eq("youtube_video_id", videoId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.id;

  const inserted = await client
    .from("video_sources")
    .insert({
      user_id: expectedUserId,
      youtube_video_id: videoId,
      canonical_url: `https://www.youtube.com/watch?v=${videoId}`,
    })
    .select("id")
    .single();
  if (!inserted.error) return inserted.data.id;

  const raced = await client
    .from("video_sources")
    .select("id")
    .eq("user_id", expectedUserId)
    .eq("youtube_video_id", videoId)
    .single();
  if (raced.error) throw inserted.error;
  return raced.data.id;
}

export function createSupabaseTranscriptStore(
  client: SupabaseClient<Database>,
  now: () => string = () => new Date().toISOString(),
): TranscriptRouteStore {
  return {
    async savePending(expectedUserId, videoId, providerJobId, resultKey) {
      const sourceId = await ownedSourceId(client, expectedUserId, videoId);
      const registered = await client.rpc("register_resolve_snapshot_job", {
        p_user_id: expectedUserId,
        p_video_source_id: sourceId,
        p_dedupe_key: resultKey,
        p_provider_job_id: providerJobId,
        p_now: now(),
      });
      if (registered.error) throw registered.error;
      const registration = registered.data[0];
      if (!registration || registered.data.length !== 1) {
        throw new Error("resolve_snapshot registration returned an invalid result");
      }
      return { jobId: registration.knowledge_job_id };
    },

    async saveReady(expectedUserId, videoId, snapshot) {
      const sourceId = await ownedSourceId(client, expectedUserId, videoId);
      const capturedAt = now();
      const durationSeconds = Math.max(...snapshot.segments.map((segment) => segment.endSeconds));
      const snapshotWrite = await client
        .from("video_snapshots")
        .upsert(
          {
            user_id: expectedUserId,
            video_source_id: sourceId,
            title: `YouTube video ${videoId}`,
            channel: "YouTube",
            thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            duration_seconds: durationSeconds,
            description: "",
            transcript_language: "zh-CN",
            transcript_hash: snapshot.transcriptHash,
            captured_at: capturedAt,
          },
          { onConflict: "video_source_id,transcript_hash", ignoreDuplicates: true },
        );
      if (snapshotWrite.error) throw snapshotWrite.error;
      const persisted = await client
        .from("video_snapshots")
        .select("id,user_id")
        .eq("user_id", expectedUserId)
        .eq("video_source_id", sourceId)
        .eq("transcript_hash", snapshot.transcriptHash)
        .single();
      if (persisted.error || persisted.data.user_id !== expectedUserId) {
        throw persisted.error ?? new Error("snapshot owner mismatch");
      }
      const segments = snapshot.segments.map((segment) => ({
        user_id: expectedUserId,
        snapshot_id: persisted.data.id,
        stable_id: segment.stableId,
        position: segment.position,
        original_chinese: segment.originalChinese,
        start_seconds: segment.startSeconds,
        end_seconds: segment.endSeconds,
        language: "zh-CN",
      }));
      const segmentWrite = await client
        .from("transcript_segments")
        .upsert(segments, { onConflict: "snapshot_id,stable_id", ignoreDuplicates: true });
      if (segmentWrite.error) throw segmentWrite.error;
      return { snapshotId: persisted.data.id };
    },
  };
}

export function createServiceJobClient(
  url: string,
  serviceRoleKey: string,
): SupabaseClient<Database> {
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
