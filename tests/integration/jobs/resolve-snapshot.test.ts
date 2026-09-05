import { createHash } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJob } from "@/contracts/knowledge";
import {
  MAX_JOB_ATTEMPTS,
  createJobResultKey,
  leaseJob,
  nextJobFailure,
} from "@/server/domain/lease-job";
import {
  createJobProcessor,
  createSupabaseDurableJobStore,
  createSupabaseTranscriptStore,
  type DurableJobStore,
} from "@/server/jobs/process-jobs";
import { createResolveSnapshotHandler } from "@/server/jobs/handlers/resolve-snapshot";
import type { NativeTranscriptSnapshot, TranscriptProvider } from "@/server/transcript/provider";
import {
  RESOLVE_SNAPSHOT_MODEL_VERSION,
  RESOLVE_SNAPSHOT_PROMPT_VERSION,
  createResolveSnapshotJobKey,
  createTranscriptRoute,
} from "@/server/transcript/provider";
import {
  createInternalProcessRoute,
  createJobStatusRoute,
  parsePublicResolveSnapshotResult,
} from "@/server/jobs/process-jobs";

const NOW = "2026-08-17T00:00:00.000Z";
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const JOB_ID = "10000000-0000-4000-8000-000000000001";
const SOURCE_ID = "20000000-0000-4000-8000-000000000001";
const SAVE_ID = "30000000-0000-4000-8000-000000000001";
const SNAPSHOT_ID = "40000000-0000-4000-8000-000000000001";
const LATEST_SNAPSHOT_ID = "40000000-0000-4000-8000-000000000002";

const persistedSnapshot: NativeTranscriptSnapshot = {
  language: "zh-CN",
  transcriptHash: "e".repeat(64),
  plainText: "第一句。 第二句。",
  timestampedText: "[0:02] 第一句。\n[1:05] 第二句。",
  segments: [
    {
      stableId: "d".repeat(64),
      position: 0,
      originalChinese: "第一句。",
      startSeconds: 2,
      endSeconds: 4,
      language: "zh-CN",
    },
    {
      stableId: "e".repeat(64),
      position: 1,
      originalChinese: "第二句。",
      startSeconds: 65,
      endSeconds: 67,
      language: "zh-CN",
    },
  ],
};

function job(overrides: Partial<KnowledgeJob> = {}): KnowledgeJob {
  return KnowledgeJobSchema.parse({
    id: JOB_ID,
    userId: USER_A,
    sourceId: SOURCE_ID,
    savedItemId: SAVE_ID,
    type: "resolve_snapshot",
    status: "pending",
    dedupeKey: "a".repeat(64),
    attemptCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: "2026-08-16T00:00:00.000Z",
    updatedAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  });
}

const snapshot: NativeTranscriptSnapshot = {
  language: "zh-CN",
  transcriptHash: "b".repeat(64),
  plainText: "你好",
  timestampedText: "[0:00] 你好",
  segments: [
    {
      stableId: "c".repeat(64),
      position: 0,
      originalChinese: "你好",
      startSeconds: 0,
      endSeconds: 1,
      language: "zh-CN",
    },
  ],
};

function storeFixture(initial: KnowledgeJob): DurableJobStore & {
  states: KnowledgeJob[];
  privateInput: unknown;
  privateResult: unknown;
  persisted: NativeTranscriptSnapshot[];
} {
  const states = [initial];
  let claimConsumed = false;
  return {
    states,
    privateInput: { providerJobId: "provider-private-123" },
    privateResult: null,
    persisted: [],
    async claimJobs(limit, now) {
      if (claimConsumed) return [];
      claimConsumed = true;
      const current = states.at(-1)!;
      const decision = leaseJob(current, now);
      if (decision.kind !== "leased") return [];
      states.push(decision.job);
      return [decision.job].slice(0, limit);
    },
    async readPrivateInput(expectedUserId, jobId) {
      expect(expectedUserId).toBe(USER_A);
      expect(jobId).toBe(JOB_ID);
      return this.privateInput;
    },
    async readVideoId(expectedUserId, sourceId) {
      expect(expectedUserId).toBe(USER_A);
      expect(sourceId).toBe(SOURCE_ID);
      return "abc123XYZ00";
    },
    async transitionFailure(expectedUserId, expectedLease, state, privateChange) {
      expect(expectedUserId).toBe(state.userId);
      expect(expectedLease).toMatchObject({ userId: expectedUserId, status: "leased" });
      if (privateChange.providerJobId !== null) {
        this.privateInput = { providerJobId: privateChange.providerJobId };
      }
      if (privateChange.clearInput) this.privateInput = {};
      states.push(state);
      return true;
    },
    async persistSnapshotEvidence(expectedUserId, leased, result, completedAt) {
      expect(expectedUserId).toBe(leased.userId);
      expect(completedAt).toBe(NOW);
      this.persisted.push(result);
      return SNAPSHOT_ID;
    },
    async completeResolved(expectedUserId, leased, snapshotId, completedAt) {
      expect(expectedUserId).toBe(leased.userId);
      expect(snapshotId).toBe(SNAPSHOT_ID);
      expect(completedAt).toBe(NOW);
      this.privateResult = { snapshotId: SNAPSHOT_ID };
      this.privateInput = {};
      states.push({
        ...leased,
        status: "succeeded",
        nextAttemptAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        updatedAt: completedAt,
      });
      return true;
    },
    async readLearningArtifactEvidence() {
      throw new Error("not used by resolve_snapshot fixtures");
    },
    async transitionLearningArtifactFailure() {
      throw new Error("not used by resolve_snapshot fixtures");
    },
    async completeGatewayLearningArtifact() {
      throw new Error("not used by resolve_snapshot fixtures");
    },
  };
}

describe("durable resolve_snapshot processing", () => {
  test("atomically attaches the first Provider 202 with the exact frozen retry state", async () => {
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const transitionFailure = vi.fn(async () => true);
    const legacyPersistState = vi.fn(async () => true);
    const legacyWritePrivateInput = vi.fn(async () => undefined);
    const store = {
      readPrivateInput: vi.fn(async () => null),
      readVideoId: vi.fn(async () => "abc123XYZ00"),
      transitionFailure,
      persistState: legacyPersistState,
      writePrivateInput: legacyWritePrivateInput,
    } as unknown as DurableJobStore;
    const handler = createResolveSnapshotHandler({
      store,
      provider: {
        request: vi.fn(async () => ({
          kind: "pending" as const,
          providerJobId: "provider-new-123",
        })),
        poll: vi.fn(),
      },
    });
    const expectedFailure = nextJobFailure(decision.job, "SYNC_RETRYING", NOW);

    await expect(handler(decision.job, USER_A, NOW)).resolves.toBe("deferred");

    expect(transitionFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      decision.job,
      expectedFailure,
      { providerJobId: "provider-new-123", clearInput: false },
    );
    expect(legacyPersistState).not.toHaveBeenCalled();
    expect(legacyWritePrivateInput).not.toHaveBeenCalled();
  });

  test("terminalizes an attempt-five initial Provider 202 without attaching its unusable ID", async () => {
    const decision = leaseJob(job({ attemptCount: MAX_JOB_ATTEMPTS - 1 }), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const transitionFailure = vi.fn(async () => true);
    const store = {
      readPrivateInput: vi.fn(async () => null),
      readVideoId: vi.fn(async () => "abc123XYZ00"),
      transitionFailure,
    } as unknown as DurableJobStore;
    const handler = createResolveSnapshotHandler({
      store,
      provider: {
        request: vi.fn(async () => ({
          kind: "pending" as const,
          providerJobId: "provider-never-polled",
        })),
        poll: vi.fn(),
      },
    });
    const expectedFailure = nextJobFailure(decision.job, "SYNC_RETRYING", NOW);

    await expect(handler(decision.job, USER_A, NOW)).resolves.toBe("failed");
    expect(expectedFailure.status).toBe("terminal_failed");
    expect(transitionFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      decision.job,
      expectedFailure,
      { providerJobId: null, clearInput: true },
    );
  });

  test("a pending-poll lost fence returns only deferred with no split mutation", async () => {
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const transitionFailure = vi.fn(async () => false);
    const legacyPersistState = vi.fn(async () => true);
    const cleanup = vi.fn(async () => undefined);
    const store = {
      readPrivateInput: vi.fn(async () => ({ providerJobId: "provider-private-123" })),
      transitionFailure,
      persistState: legacyPersistState,
      clearPrivateProviderInput: cleanup,
    } as unknown as DurableJobStore;
    const handler = createResolveSnapshotHandler({
      store,
      provider: {
        request: vi.fn(),
        poll: vi.fn(async () => ({ kind: "pending" as const })),
      },
    });

    await expect(handler(decision.job, USER_A, NOW)).resolves.toBe("deferred");
    expect(transitionFailure).toHaveBeenCalledTimes(1);
    expect(legacyPersistState).not.toHaveBeenCalled();
    expect(cleanup).not.toHaveBeenCalled();
  });

  test.each([
    {
      label: "pending poll",
      providerResult: { kind: "pending" as const },
      errorCode: "SYNC_RETRYING",
      terminal: false,
    },
    {
      label: "unsupported terminal result",
      providerResult: {
        kind: "unsupported" as const,
        code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED" as const,
      },
      errorCode: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
      terminal: true,
    },
  ])("uses one atomic failure transition for $label", async ({ providerResult, errorCode, terminal }) => {
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const transitionFailure = vi.fn(async () => true);
    const cleanup = vi.fn(async () => undefined);
    const store = {
      readPrivateInput: vi.fn(async () => ({ providerJobId: "provider-private-123" })),
      transitionFailure,
      persistState: vi.fn(async () => true),
      clearPrivateProviderInput: cleanup,
    } as unknown as DurableJobStore;
    const handler = createResolveSnapshotHandler({
      store,
      provider: { request: vi.fn(), poll: vi.fn(async () => providerResult) },
    });
    const expectedState = terminal
      ? {
          ...decision.job,
          status: "terminal_failed" as const,
          nextAttemptAt: null,
          leaseExpiresAt: null,
          lastErrorCode: errorCode,
          updatedAt: NOW,
        }
      : nextJobFailure(decision.job, errorCode, NOW);

    await handler(decision.job, USER_A, NOW);

    expect(transitionFailure).toHaveBeenCalledExactlyOnceWith(
      USER_A,
      decision.job,
      expectedState,
      { providerJobId: null, clearInput: terminal },
    );
    expect(cleanup).not.toHaveBeenCalled();
  });

  test("returns deferred after a lost completion fence without split cleanup", async () => {
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const persistSnapshotEvidence = vi.fn(async () => SNAPSHOT_ID);
    const completeResolved = vi.fn(async () => false);
    const cleanup = vi.fn(async () => undefined);
    const store = {
      readPrivateInput: vi.fn(async () => ({ providerJobId: "provider-private-123" })),
      persistSnapshotEvidence,
      completeResolved,
      persistResolved: vi.fn(async () => false),
      clearPrivateProviderInput: cleanup,
    } as unknown as DurableJobStore;
    const handler = createResolveSnapshotHandler({
      store,
      provider: {
        request: vi.fn(),
        poll: vi.fn(async () => ({ kind: "ready" as const, snapshot })),
      },
    });

    await expect(handler(decision.job, USER_A, NOW)).resolves.toBe("deferred");
    expect(persistSnapshotEvidence).toHaveBeenCalledWith(USER_A, decision.job, snapshot, NOW);
    expect(completeResolved).toHaveBeenCalledWith(USER_A, decision.job, SNAPSHOT_ID, NOW);
    expect(cleanup).not.toHaveBeenCalled();
  });

  test("runs an atomically claimed bounded batch concurrently", async () => {
    const firstLease = leaseJob(job(), NOW);
    const secondLease = leaseJob(
      job({ id: "10000000-0000-4000-8000-000000000002" }),
      NOW,
    );
    if (firstLease.kind !== "leased" || secondLease.kind !== "leased") {
      throw new Error("fixtures must lease");
    }
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const handler = vi.fn(async () => {
      started += 1;
      await gate;
      return "deferred" as const;
    });
    const processor = createJobProcessor({
      store: {
        ...storeFixture(job()),
        claimJobs: async () => [firstLease.job, secondLease.job],
      },
      handlers: { resolve_snapshot: handler },
    });

    const processing = processor.processBounded(NOW, 2);
    await Promise.resolve();
    const startedBeforeRelease = started;
    release();
    await processing;

    expect(startedBeforeRelease).toBe(2);
  });

  test("claims with an owner predicate and prevents a concurrent second owner", async () => {
    const store = storeFixture(job());
    const provider: TranscriptProvider = {
      request: vi.fn(),
      poll: vi.fn(async () => ({ kind: "pending" as const })),
    };
    const handler = createResolveSnapshotHandler({ store, provider });
    const processor = createJobProcessor({ store, handlers: { resolve_snapshot: handler } });

    const first = await processor.processBounded(NOW, 1);
    const second = await processor.processBounded(NOW, 1);

    expect(first.claimed).toBe(1);
    expect(second.claimed).toBe(0);
    expect(store.states.at(-1)?.status).toBe("retryable_failed");
  });

  test("recovers an expired lease but refuses an active lease and wrong expected owner", async () => {
    const expired = storeFixture(job({
      status: "leased",
      attemptCount: 1,
      leaseExpiresAt: NOW,
    }));
    const active = storeFixture(job({
      status: "leased",
      attemptCount: 1,
      leaseExpiresAt: "2026-08-17T00:00:00.001Z",
    }));
    const provider: TranscriptProvider = {
      request: vi.fn(),
      poll: vi.fn(async () => ({ kind: "pending" as const })),
    };

    const recovered = createJobProcessor({
      store: expired,
      handlers: { resolve_snapshot: createResolveSnapshotHandler({ store: expired, provider }) },
    });
    const refused = createJobProcessor({
      store: active,
      handlers: { resolve_snapshot: createResolveSnapshotHandler({ store: active, provider }) },
    });

    const ownerCheckLease = leaseJob(job(), NOW);
    if (ownerCheckLease.kind !== "leased") throw new Error("fixture must lease");
    await expect(
      createResolveSnapshotHandler({ store: expired, provider })(
        ownerCheckLease.job,
        USER_B,
        NOW,
      ),
    ).rejects.toThrow(/owner/i);
    await expect(recovered.processBounded(NOW, 1)).resolves.toMatchObject({ claimed: 1 });
    await expect(refused.processBounded(NOW, 1)).resolves.toMatchObject({ claimed: 0 });
  });

  test("persists completed polling, clears private data, and marks success", async () => {
    const store = storeFixture(job());
    const provider: TranscriptProvider = {
      request: vi.fn(),
      poll: vi.fn(async () => ({ kind: "ready" as const, snapshot })),
    };
    const processor = createJobProcessor({
      store,
      handlers: { resolve_snapshot: createResolveSnapshotHandler({ store, provider }) },
    });

    await processor.processBounded(NOW, 1);

    expect(store.persisted).toEqual([snapshot]);
    expect(store.privateInput).toEqual({});
    expect(store.privateResult).toEqual({ snapshotId: SNAPSHOT_ID });
    expect(store.states.at(-1)).toMatchObject({ status: "succeeded", updatedAt: NOW });
  });

  test("starts Provider work durably when a capture job has no private reference", async () => {
    const store = storeFixture(job());
    store.privateInput = null;
    const provider: TranscriptProvider = {
      request: vi.fn(async () => ({
        kind: "pending" as const,
        providerJobId: "provider-new-123",
      })),
      poll: vi.fn(),
    };
    const processor = createJobProcessor({
      store,
      handlers: { resolve_snapshot: createResolveSnapshotHandler({ store, provider }) },
    });

    const result = await processor.processBounded(NOW, 1);

    expect(provider.request).toHaveBeenCalledWith("abc123XYZ00");
    expect(provider.poll).not.toHaveBeenCalled();
    expect(store.privateInput).toEqual({ providerJobId: "provider-new-123" });
    expect(store.states.at(-1)).toMatchObject({
      status: "retryable_failed",
      lastErrorCode: "SYNC_RETRYING",
      updatedAt: NOW,
    });
    expect(result).toMatchObject({ claimed: 1, deferred: 1 });
  });

  test("uses frozen retry and terminal failure rules", async () => {
    const store = storeFixture(job({
      status: "leased",
      attemptCount: MAX_JOB_ATTEMPTS - 1,
      leaseExpiresAt: NOW,
    }));
    const provider: TranscriptProvider = {
      request: vi.fn(),
      poll: vi.fn(async () => ({
        kind: "failure" as const,
        code: "PROVIDER_UNAVAILABLE" as const,
        retryable: true,
      })),
    };
    const processor = createJobProcessor({
      store,
      handlers: { resolve_snapshot: createResolveSnapshotHandler({ store, provider }) },
    });

    await processor.processBounded(NOW, 1);

    expect(store.states.at(-1)).toMatchObject({
      status: "terminal_failed",
      attemptCount: MAX_JOB_ATTEMPTS,
      leaseExpiresAt: null,
      updatedAt: NOW,
    });
  });
});

describe("CONTRACT-006 Supabase RPC adapters", () => {
  // Mutation caught: stopping the candidate scan after Supabase's first 1,000-row page.
  test("finds an older complete snapshot after a full page of incomplete candidates", async () => {
    const incompleteCandidates = Array.from({ length: 1_000 }, (_, position) => ({
      id: `40000000-0000-4000-8000-${(position + 10).toString(16).padStart(12, "0")}`,
      user_id: USER_A,
      video_source_id: SOURCE_ID,
      transcript_hash: "a".repeat(64),
      transcript_language: "zh-CN",
    }));
    const candidates = [
      ...incompleteCandidates,
      {
        id: SNAPSHOT_ID,
        user_id: USER_A,
        video_source_id: SOURCE_ID,
        transcript_hash: persistedSnapshot.transcriptHash,
        transcript_language: "zh-CN",
      },
    ];
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "abc123XYZ00" },
        error: null,
      })),
    };
    const snapshotQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async (from: number, to: number) => ({
        data: candidates.slice(from, to + 1),
        error: null,
      })),
      then: (onfulfilled: (value: { data: typeof incompleteCandidates; error: null }) => unknown) =>
        Promise.resolve({ data: incompleteCandidates, error: null }).then(onfulfilled),
    };
    const segmentsQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: { snapshotId: string }, column: string, value: string) {
        if (column === "snapshot_id") this.snapshotId = value;
        return this;
      }),
      order: vi.fn(function (this: unknown) { return this; }),
      snapshotId: "",
      range: vi.fn(async function (this: { snapshotId: string }) {
        return {
          data: this.snapshotId === SNAPSHOT_ID
            ? [{
                stable_id: "complete-stable-id",
                position: 0,
                original_chinese: "完整快照。",
                start_seconds: 0,
                end_seconds: 1,
                language: "zh-CN",
                user_id: USER_A,
                snapshot_id: SNAPSHOT_ID,
              }]
            : [],
          error: null,
        };
      }),
    };
    const from = vi.fn((table: string) => {
      if (table === "video_sources") return sourceQuery;
      if (table === "video_snapshots") return snapshotQuery;
      if (table === "transcript_segments") return segmentsQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const store = createSupabaseTranscriptStore({ from } as never, () => NOW);

    const latest = await store.readLatestSnapshot(USER_A, "abc123XYZ00");

    expect(latest).toMatchObject({
      snapshotId: SNAPSHOT_ID,
      snapshot: { plainText: "完整快照。" },
    });
    expect(snapshotQuery.range).toHaveBeenCalledWith(0, 999);
    expect(snapshotQuery.range).toHaveBeenCalledWith(1_000, 1_999);
    expect(segmentsQuery.eq).toHaveBeenCalledWith("snapshot_id", SNAPSHOT_ID);
  });

  // Mutation caught: selecting a non-latest snapshot or truncating paged transcript evidence.
  test("reads the latest owned snapshot with all paged segments and deterministic filters", async () => {
    const rows = Array.from({ length: 1_001 }, (_, position) => ({
      stable_id: `latest-stable-${position}`,
      position,
      original_chinese: `最新第${position}句。`,
      start_seconds: position,
      end_seconds: position + 1,
      language: "zh-CN",
      user_id: USER_A,
      snapshot_id: LATEST_SNAPSHOT_ID,
    }));
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "abc123XYZ00" },
        error: null,
      })),
    };
    const latestCandidateRows = [
      {
        id: LATEST_SNAPSHOT_ID,
        user_id: USER_A,
        video_source_id: SOURCE_ID,
        transcript_hash: "a".repeat(64),
        transcript_language: "zh-CN",
        captured_at: "2026-08-17T00:00:00.000Z",
      },
      {
        id: SNAPSHOT_ID,
        user_id: USER_A,
        video_source_id: SOURCE_ID,
        transcript_hash: "b".repeat(64),
        transcript_language: "zh-CN",
        captured_at: "2026-08-16T00:00:00.000Z",
      },
    ];
    const snapshotQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async () => ({ data: latestCandidateRows, error: null })),
    };
    const segmentsQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async (from: number, to: number) => ({
        data: rows.slice(from, to + 1),
        error: null,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "video_sources") return sourceQuery;
      if (table === "video_snapshots") return snapshotQuery;
      if (table === "transcript_segments") return segmentsQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const store = createSupabaseTranscriptStore({ from } as never, () => NOW);

    const latest = await store.readLatestSnapshot(USER_A, "abc123XYZ00");

    expect(latest?.snapshotId).toBe(LATEST_SNAPSHOT_ID);
    expect(latest?.snapshot.transcriptHash).toBe("a".repeat(64));
    expect(latest?.snapshot.segments).toHaveLength(1_001);
    expect(latest?.snapshot.segments.at(0)).toMatchObject({
      stableId: "latest-stable-0",
      position: 0,
    });
    expect(latest?.snapshot.segments.at(-1)).toMatchObject({
      stableId: "latest-stable-1000",
      position: 1_000,
    });
    expect(sourceQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(sourceQuery.eq).toHaveBeenCalledWith("youtube_video_id", "abc123XYZ00");
    expect(snapshotQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(snapshotQuery.eq).toHaveBeenCalledWith("video_source_id", SOURCE_ID);
    expect(snapshotQuery.eq).toHaveBeenCalledWith("transcript_language", "zh-CN");
    expect(snapshotQuery.order).toHaveBeenCalledWith("captured_at", { ascending: false });
    expect(snapshotQuery.order).toHaveBeenCalledWith("id", { ascending: false });
    expect(segmentsQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(segmentsQuery.eq).toHaveBeenCalledWith("snapshot_id", LATEST_SNAPSHOT_ID);
    expect(segmentsQuery.range).toHaveBeenCalledWith(0, 999);
    expect(segmentsQuery.range).toHaveBeenCalledWith(1_000, 1_999);
  });

  test("reads one owned persisted snapshot in segment position order and reconstructs native text", async () => {
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "abc123XYZ00" },
        error: null,
      })),
    };
    const snapshotQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: SNAPSHOT_ID,
          user_id: USER_A,
          video_source_id: SOURCE_ID,
          transcript_hash: persistedSnapshot.transcriptHash,
          transcript_language: "zh-CN",
        },
        error: null,
      })),
    };
    const segmentsQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async () => ({
        data: [
          {
            stable_id: "e".repeat(64), position: 1, original_chinese: "第二句。",
            start_seconds: 65, end_seconds: 67, language: "zh-CN",
            user_id: USER_A, snapshot_id: SNAPSHOT_ID,
          },
          {
            stable_id: "d".repeat(64), position: 0, original_chinese: "第一句。",
            start_seconds: 2, end_seconds: 4, language: "zh-CN",
            user_id: USER_A, snapshot_id: SNAPSHOT_ID,
          },
        ],
        error: null,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "video_sources") return sourceQuery;
      if (table === "video_snapshots") return snapshotQuery;
      if (table === "transcript_segments") return segmentsQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const store = createSupabaseTranscriptStore({ from } as never, () => NOW);

    await expect(store.readSnapshot(USER_A, "abc123XYZ00", SNAPSHOT_ID)).resolves.toEqual(
      persistedSnapshot,
    );
    expect(sourceQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(sourceQuery.eq).toHaveBeenCalledWith("youtube_video_id", "abc123XYZ00");
    expect(snapshotQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(snapshotQuery.eq).toHaveBeenCalledWith("video_source_id", SOURCE_ID);
    expect(snapshotQuery.eq).toHaveBeenCalledWith("id", SNAPSHOT_ID);
    expect(segmentsQuery.eq).toHaveBeenCalledWith("user_id", USER_A);
    expect(segmentsQuery.eq).toHaveBeenCalledWith("snapshot_id", SNAPSHOT_ID);
    expect(segmentsQuery.order).toHaveBeenCalledWith("position", { ascending: true });
    expect(segmentsQuery.range).toHaveBeenCalledWith(0, 999);
  });

  // Mutation caught: applying latest-cache completeness validation to explicit snapshot continuation.
  test("retains sparse but owned explicit snapshot evidence", async () => {
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "abc123XYZ00" },
        error: null,
      })),
    };
    const snapshotQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: SNAPSHOT_ID,
          user_id: USER_A,
          video_source_id: SOURCE_ID,
          transcript_hash: persistedSnapshot.transcriptHash,
          transcript_language: "zh-CN",
        },
        error: null,
      })),
    };
    const segmentsQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async () => ({
        data: [
          {
            stable_id: "sparse-0", position: 0, original_chinese: "第一句。",
            start_seconds: 0, end_seconds: 1, language: "zh-CN",
            user_id: USER_A, snapshot_id: SNAPSHOT_ID,
          },
          {
            stable_id: "sparse-2", position: 2, original_chinese: "第三句。",
            start_seconds: 2, end_seconds: 3, language: "zh-CN",
            user_id: USER_A, snapshot_id: SNAPSHOT_ID,
          },
        ],
        error: null,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "video_sources") return sourceQuery;
      if (table === "video_snapshots") return snapshotQuery;
      if (table === "transcript_segments") return segmentsQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const store = createSupabaseTranscriptStore({ from } as never, () => NOW);

    await expect(store.readSnapshot(USER_A, "abc123XYZ00", SNAPSHOT_ID)).resolves.toMatchObject({
      segments: [{ position: 0 }, { position: 2 }],
      plainText: "第一句。 第三句。",
    });
  });

  test("paginates persisted segments beyond the 1,000-row Data API cap", async () => {
    const rows = Array.from({ length: 1_001 }, (_, position) => ({
      stable_id: `stable-${position}`,
      position,
      original_chinese: `第${position}句。`,
      start_seconds: position,
      end_seconds: position + 1,
      language: "zh-CN",
      user_id: USER_A,
      snapshot_id: SNAPSHOT_ID,
    }));
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: { id: SOURCE_ID, user_id: USER_A, youtube_video_id: "abc123XYZ00" },
        error: null,
      })),
    };
    const snapshotQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({
        data: {
          id: SNAPSHOT_ID,
          user_id: USER_A,
          video_source_id: SOURCE_ID,
          transcript_hash: "f".repeat(64),
          transcript_language: "zh-CN",
        },
        error: null,
      })),
    };
    const segmentsQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      order: vi.fn(function (this: unknown) { return this; }),
      range: vi.fn(async (from: number, to: number) => ({
        data: rows.slice(from, to + 1),
        error: null,
      })),
    };
    const from = vi.fn((table: string) => {
      if (table === "video_sources") return sourceQuery;
      if (table === "video_snapshots") return snapshotQuery;
      if (table === "transcript_segments") return segmentsQuery;
      throw new Error(`unexpected table ${table}`);
    });
    const store = createSupabaseTranscriptStore({ from } as never, () => NOW);

    const result = await store.readSnapshot(USER_A, "abc123XYZ00", SNAPSHOT_ID);

    expect(result?.segments).toHaveLength(1_001);
    expect(result?.segments.at(-1)).toMatchObject({
      stableId: "stable-1000",
      position: 1_000,
      startSeconds: 1_000,
      endSeconds: 1_001,
      language: "zh-CN",
    });
    expect(result?.plainText.endsWith("第1000句。")).toBe(true);
    expect(result?.timestampedText.endsWith("[16:40] 第1000句。")).toBe(true);
    expect(segmentsQuery.range).toHaveBeenCalledWith(0, 999);
    expect(segmentsQuery.range).toHaveBeenCalledWith(1_000, 1_999);
  });

  test("registers a conflict through one RPC and never mutates job tables", async () => {
    const sourceQuery = {
      select: vi.fn(function (this: unknown) { return this; }),
      eq: vi.fn(function (this: unknown) { return this; }),
      maybeSingle: vi.fn(async () => ({ data: { id: SOURCE_ID }, error: null })),
    };
    const from = vi.fn((table: string) => {
      if (table !== "video_sources") throw new Error(`forbidden table mutation: ${table}`);
      return sourceQuery;
    });
    const rpc = vi.fn(async () => ({
      data: [{ knowledge_job_id: JOB_ID, status: "succeeded", created_or_attached: false }],
      error: null,
    }));
    const store = createSupabaseTranscriptStore({ from, rpc } as never, () => NOW);
    await expect(
      store.savePending(USER_A, "abc123XYZ00", "provider-secret", "d".repeat(64)),
    ).resolves.toEqual({ jobId: JOB_ID });

    expect(rpc).toHaveBeenCalledExactlyOnceWith("register_resolve_snapshot_job", {
      p_user_id: USER_A,
      p_video_source_id: SOURCE_ID,
      p_dedupe_key: "d".repeat(64),
      p_provider_job_id: "provider-secret",
      p_now: NOW,
    });
    expect(from).toHaveBeenCalledTimes(1);
  });

  test("maps retry transitions to the exact owner and lease-fenced RPC arguments", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const store = createSupabaseDurableJobStore({ rpc } as never);
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    const failure = nextJobFailure(decision.job, "SYNC_RETRYING", NOW);
    await expect(
      store.transitionFailure(USER_A, decision.job, failure, {
        providerJobId: "provider-new-123",
        clearInput: false,
      }),
    ).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("transition_resolve_snapshot_failure", {
      p_user_id: USER_A,
      p_job_id: JOB_ID,
      p_expected_lease_expires_at: "2026-08-17T00:05:00.000Z",
      p_expected_attempt_count: 1,
      p_target_status: "retryable_failed",
      p_next_attempt_at: "2026-08-17T00:01:00.000Z",
      p_error_code: "SYNC_RETRYING",
      p_provider_job_id: "provider-new-123",
      p_clear_input: false,
      p_now: NOW,
    });
  });

  test("maps completion to one exact RPC and reports a lost fence", async () => {
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    const store = createSupabaseDurableJobStore({ rpc } as never);
    const decision = leaseJob(job(), NOW);
    if (decision.kind !== "leased") throw new Error("fixture must lease");
    await expect(store.completeResolved(USER_A, decision.job, SNAPSHOT_ID, NOW)).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("complete_resolve_snapshot_job", {
      p_user_id: USER_A,
      p_job_id: JOB_ID,
      p_expected_lease_expires_at: "2026-08-17T00:05:00.000Z",
      p_expected_attempt_count: 1,
      p_snapshot_id: SNAPSHOT_ID,
      p_now: NOW,
    });
  });
});

describe("route security and public shapes", () => {
  test("uses the frozen result-key contract for one source-level transcript job", () => {
    const sourceHash = createHash("sha256")
      .update("https://www.youtube.com/watch?v=abc123XYZ00")
      .digest("hex");

    expect(createResolveSnapshotJobKey("abc123XYZ00")).toBe(
      createJobResultKey({
        jobType: "resolve_snapshot",
        sourceHash,
        savedItemHash: null,
        promptVersion: RESOLVE_SNAPSHOT_PROMPT_VERSION,
        modelVersion: RESOLVE_SNAPSHOT_MODEL_VERSION,
      }),
    );
    expect(createResolveSnapshotJobKey("abc123XYZ01")).not.toBe(
      createResolveSnapshotJobKey("abc123XYZ00"),
    );
  });

  // Mutation caught: removing the no-snapshot cache lookup and calling Provider first.
  test("returns the latest owned snapshot before requesting the Provider", async () => {
    const provider = { request: vi.fn(), poll: vi.fn() };
    const readLatestSnapshot = vi.fn(async () => ({
      snapshotId: SNAPSHOT_ID,
      snapshot: persistedSnapshot,
    }));
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider,
      store: {
        readLatestSnapshot,
        readSnapshot: vi.fn(),
        saveReady: vi.fn(),
        savePending: vi.fn(),
      },
      requestId: () => "request-cache-hit",
    });

    const response = await route(new Request("https://popcorn.test"), {
      params: Promise.resolve({ videoId: "abc123XYZ00" }),
    });

    expect(response.status).toBe(200);
    expect(readLatestSnapshot).toHaveBeenCalledExactlyOnceWith(USER_A, "abc123XYZ00");
    expect(provider.request).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { kind: "ready", snapshotId: SNAPSHOT_ID, snapshot: persistedSnapshot },
    });
  });

  // Mutation caught: treating a cache miss as ready instead of retaining Provider fallback.
  test("calls the Provider exactly once after a latest-snapshot cache miss", async () => {
    const provider = {
      request: vi.fn(async () => ({ kind: "ready" as const, snapshot })),
      poll: vi.fn(),
    };
    const readLatestSnapshot = vi.fn(async () => null);
    const saveReady = vi.fn(async () => ({ snapshotId: SNAPSHOT_ID }));
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider,
      store: {
        readLatestSnapshot,
        readSnapshot: vi.fn(),
        saveReady,
        savePending: vi.fn(),
      },
      requestId: () => "request-cache-miss",
    });

    const response = await route(new Request("https://popcorn.test"), {
      params: Promise.resolve({ videoId: "abc123XYZ00" }),
    });

    expect(response.status).toBe(200);
    expect(readLatestSnapshot).toHaveBeenCalledExactlyOnceWith(USER_A, "abc123XYZ00");
    expect(provider.request).toHaveBeenCalledExactlyOnceWith("abc123XYZ00");
    expect(saveReady).toHaveBeenCalledExactlyOnceWith(USER_A, "abc123XYZ00", snapshot);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { kind: "ready", snapshotId: SNAPSHOT_ID, snapshot },
    });
  });

  test("HTTP 200 persists the owner snapshot and returns a no-store ready result", async () => {
    const saveReady = vi.fn(async () => ({ snapshotId: SNAPSHOT_ID }));
    const readSnapshot = vi.fn();
    const provider = {
      request: vi.fn(async () => ({ kind: "ready" as const, snapshot })),
      poll: vi.fn(),
    };
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider,
      store: {
        readLatestSnapshot: vi.fn(async () => null),
        readSnapshot,
        saveReady,
        savePending: vi.fn(),
      },
      requestId: () => "request-ready",
    });

    const response = await route(new Request("https://popcorn.test"), {
      params: Promise.resolve({ videoId: "abc123XYZ00" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(provider.request).toHaveBeenCalledExactlyOnceWith("abc123XYZ00");
    expect(readSnapshot).not.toHaveBeenCalled();
    expect(saveReady).toHaveBeenCalledWith(USER_A, "abc123XYZ00", snapshot);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { kind: "ready", snapshotId: SNAPSHOT_ID, snapshot },
    });
  });

  test("a snapshot continuation returns the exact owned snapshot without Provider access", async () => {
    const provider = {
      request: vi.fn(),
      poll: vi.fn(),
    };
    const readSnapshot = vi.fn(async () => persistedSnapshot);
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider,
      store: {
        readLatestSnapshot: vi.fn(async () => null),
        readSnapshot,
        saveReady: vi.fn(),
        savePending: vi.fn(),
      },
      requestId: () => "request-continuation",
    });

    const response = await route(
      new Request(`https://popcorn.test?snapshotId=${SNAPSHOT_ID}`),
      { params: Promise.resolve({ videoId: "abc123XYZ00" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(readSnapshot).toHaveBeenCalledExactlyOnceWith(USER_A, "abc123XYZ00", SNAPSHOT_ID);
    expect(provider.request).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { kind: "ready", snapshotId: SNAPSHOT_ID, snapshot: persistedSnapshot },
    });
  });

  test.each([
    ["a malformed", "not-a-snapshot", undefined],
    ["a foreign or wrong-video", SNAPSHOT_ID, null],
  ])("%s snapshot continuation is bounded and never falls back to Provider", async (
    _label,
    snapshotId,
    readResult,
  ) => {
    const provider = { request: vi.fn(), poll: vi.fn() };
    const readSnapshot = vi.fn(async (): Promise<NativeTranscriptSnapshot | null> => readResult ?? null);
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider,
      store: {
        readLatestSnapshot: vi.fn(async () => null),
        readSnapshot,
        saveReady: vi.fn(),
        savePending: vi.fn(),
      },
      requestId: () => "request-bounded",
    });

    const response = await route(
      new Request(`https://popcorn.test?snapshotId=${snapshotId}`),
      { params: Promise.resolve({ videoId: "abc123XYZ00" }) },
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatchObject({
      code: "TRANSCRIPT_UNAVAILABLE",
      retryable: false,
    });
    expect(provider.request).not.toHaveBeenCalled();
    if (snapshotId === SNAPSHOT_ID) {
      expect(readSnapshot).toHaveBeenCalledExactlyOnceWith(USER_A, "abc123XYZ00", SNAPSHOT_ID);
    } else {
      expect(readSnapshot).not.toHaveBeenCalled();
    }
  });

  test("HTTP 202 stores a private Provider ID and returns only Popcorn's job UUID", async () => {
    const savePending = vi.fn(async () => ({ jobId: JOB_ID }));
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider: {
        request: vi.fn(async () => ({ kind: "pending" as const, providerJobId: "provider-secret" })),
        poll: vi.fn(),
      },
      store: {
        readLatestSnapshot: vi.fn(async () => null),
        readSnapshot: vi.fn(),
        saveReady: vi.fn(),
        savePending,
      },
      requestId: () => "request-1",
    });

    const response = await route(new Request("https://popcorn.test"), {
      params: Promise.resolve({ videoId: "abc123XYZ00" }),
    });
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(savePending).toHaveBeenCalledWith(
      USER_A,
      "abc123XYZ00",
      "provider-secret",
      createResolveSnapshotJobKey("abc123XYZ00"),
    );
    expect(JSON.stringify(body)).not.toContain("provider-secret");
    expect(body).toMatchObject({ ok: true, data: { kind: "pending", jobId: JOB_ID } });
  });

  test("successful public job status is owner-only, bounded, and excludes private fields", async () => {
    const readPublicStatus = vi.fn(async (expectedUserId: string) =>
      expectedUserId === USER_A
        ? {
            id: JOB_ID,
            status: "succeeded" as const,
            retryable: false,
            result: { snapshotId: SNAPSHOT_ID },
          }
        : null,
    );
    const route = createJobStatusRoute({
      authenticate: async (request) =>
        request.headers.get("x-user") ? { userId: request.headers.get("x-user")! } : null,
      readPublicStatus,
      requestId: () => "request-2",
    });

    const own = await route(
      new Request("https://popcorn.test", { headers: { "x-user": USER_A } }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );
    const other = await route(
      new Request("https://popcorn.test", { headers: { "x-user": USER_B } }),
      { params: Promise.resolve({ jobId: JOB_ID }) },
    );

    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toBe("no-store");
    const ownBody = await own.json();
    expect(ownBody).toMatchObject({
      ok: true,
      data: {
        id: JOB_ID,
        status: "succeeded",
        retryable: false,
        result: { snapshotId: SNAPSHOT_ID },
      },
    });
    expect(JSON.stringify(ownBody)).not.toMatch(/provider|input|payload|provider-private/i);
    expect(other.status).toBe(404);
    expect(other.headers.get("cache-control")).toBe("no-store");
    expect(readPublicStatus).toHaveBeenCalledWith(USER_A, JOB_ID);
    expect(readPublicStatus).toHaveBeenCalledWith(USER_B, JOB_ID);
  });

  test("rejects Provider fields and raw payloads from the bounded public result", () => {
    expect(() =>
      parsePublicResolveSnapshotResult({
        snapshotId: SNAPSHOT_ID,
        providerJobId: "provider-private-123",
      }),
    ).toThrow();
    expect(() =>
      parsePublicResolveSnapshotResult({
        snapshotId: SNAPSHOT_ID,
        payload: { transcript: "raw" },
      }),
    ).toThrow();
  });

  test("internal processing requires the exact secret and uses a constant bound", async () => {
    const processBounded = vi.fn(async () => ({ claimed: 2, completed: 1 }));
    const route = createInternalProcessRoute({
      secret: "internal-secret",
      processBounded,
      maxBatchSize: 10,
    });

    const denied = await route(new Request("https://popcorn.test", { method: "POST" }));
    const accepted = await route(
      new Request("https://popcorn.test", {
        method: "POST",
        headers: { authorization: "Bearer internal-secret" },
        body: JSON.stringify({ source: "supabase_cron", limit: 999, jobId: JOB_ID }),
      }),
    );

    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ ok: false });
    expect(processBounded).toHaveBeenCalledWith(10);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ ok: true, claimed: 2, completed: 1 });
  });
});
