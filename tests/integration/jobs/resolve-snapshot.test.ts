import { createHash } from "node:crypto";

import { describe, expect, test, vi } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJob } from "@/contracts/knowledge";
import {
  MAX_JOB_ATTEMPTS,
  createJobResultKey,
  leaseJob,
} from "@/server/domain/lease-job";
import {
  createJobProcessor,
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
    async writePrivateInput(expectedUserId, jobId, input) {
      expect(expectedUserId).toBe(USER_A);
      expect(jobId).toBe(JOB_ID);
      this.privateInput = input;
    },
    async persistState(expectedUserId, expectedLease, state) {
      expect(expectedUserId).toBe(state.userId);
      expect(expectedLease).toMatchObject({ userId: expectedUserId, status: "leased" });
      states.push(state);
      return true;
    },
    async persistResolved(expectedUserId, leased, result, completedAt) {
      expect(expectedUserId).toBe(leased.userId);
      expect(completedAt).toBe(NOW);
      this.persisted.push(result);
      this.privateResult = { snapshotId: SNAPSHOT_ID };
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
    async clearPrivateProviderInput(expectedUserId, jobId) {
      expect(expectedUserId).toBe(USER_A);
      expect(jobId).toBe(JOB_ID);
      this.privateInput = {};
    },
  };
}

describe("durable resolve_snapshot processing", () => {
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

  test("HTTP 200 persists the owner snapshot and returns a no-store ready result", async () => {
    const saveReady = vi.fn(async () => ({ snapshotId: SNAPSHOT_ID }));
    const route = createTranscriptRoute({
      authenticate: async () => ({ userId: USER_A }),
      provider: {
        request: vi.fn(async () => ({ kind: "ready" as const, snapshot })),
        poll: vi.fn(),
      },
      store: { saveReady, savePending: vi.fn() },
      requestId: () => "request-ready",
    });

    const response = await route(new Request("https://popcorn.test"), {
      params: Promise.resolve({ videoId: "abc123XYZ00" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(saveReady).toHaveBeenCalledWith(USER_A, "abc123XYZ00", snapshot);
    expect(await response.json()).toMatchObject({
      ok: true,
      data: { kind: "ready", snapshotId: SNAPSHOT_ID, snapshot },
    });
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
