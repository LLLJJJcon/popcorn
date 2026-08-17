import { timingSafeEqual } from "node:crypto";

import {
  KnowledgeJobSchema,
  type KnowledgeJob,
  type KnowledgeJobType,
} from "@/contracts/knowledge";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failure, success } from "@/server/api/respond";
import type {
  NativeTranscriptSnapshot,
  TranscriptRouteStore,
} from "@/server/transcript/provider";
import type { Database, Json } from "@/types/database.generated";

export const MAX_PROCESS_BATCH_SIZE = 10;

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
}

export type JobHandlerResult = "completed" | "deferred" | "failed";
export type JobHandler = (
  job: Extract<KnowledgeJob, { status: "leased" }>,
  expectedUserId: string,
  now: string,
) => Promise<JobHandlerResult>;

type HandlerMap = Partial<Record<KnowledgeJobType, JobHandler>>;

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
  readonly result: { readonly snapshotId: string } | null;
};

const PublicResolveSnapshotResultSchema = z
  .object({ snapshotId: z.string().uuid() })
  .strict();

export function parsePublicResolveSnapshotResult(
  value: unknown,
): NonNullable<PublicJobStatus["result"]> {
  return PublicResolveSnapshotResultSchema.parse(value);
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
    return Response.json({ ok: true, ...result }, { status: 200 });
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
