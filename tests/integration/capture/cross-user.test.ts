import { describe, expect, test, vi } from "vitest";

import type { KnowledgeJob } from "@/contracts";
import { createResolveSnapshotHandler } from "@/server/jobs/handlers/resolve-snapshot";
import {
  createJobStatusRoute,
  createSupabaseDurableJobStore,
  type DurableJobStore,
} from "@/server/jobs/process-jobs";
import { createSavedItemRepository } from "@/server/repositories/saved-item-repository";

const USER_A = "00000000-0000-4000-8000-000000000002";
const USER_B = "00000000-0000-4000-8000-000000000003";
const SOURCE_A = "00000000-0000-4000-8000-000000000201";
const SNAPSHOT_A = "00000000-0000-4000-8000-000000000202";
const SAVE_A = "00000000-0000-4000-8000-000000000203";
const JOB_A = "00000000-0000-4000-8000-000000000204";
const NOW = "2026-08-16T10:00:00.000Z";

const leasedJob: Extract<KnowledgeJob, { status: "leased" }> = {
  id: JOB_A,
  userId: USER_A,
  sourceId: SOURCE_A,
  savedItemId: SAVE_A,
  type: "resolve_snapshot",
  status: "leased",
  dedupeKey: "a".repeat(64),
  attemptCount: 1,
  nextAttemptAt: null,
  leaseExpiresAt: "2026-08-16T10:05:00.000Z",
  lastErrorCode: null,
  createdAt: NOW,
  updatedAt: NOW,
};

type QueryResult = { data: unknown; error: unknown };

function queryClient(results: Record<string, QueryResult>) {
  const ownerFilters: Array<[string, unknown]> = [];
  return {
    ownerFilters,
    client: {
      from(table: string) {
        const result = results[table] ?? { data: null, error: null };
        const builder = {
          select() { return builder; },
          eq(column: string, value: unknown) {
            if (column === "user_id") ownerFilters.push([table, value]);
            return builder;
          },
          in() { return builder; },
          maybeSingle: async () => result,
          order: async () => result,
        };
        return builder;
      },
      rpc: vi.fn(),
    },
  };
}

describe("Batch A cross-user capture and worker boundaries", () => {
  test("user B cannot read user A public job or invoke user A capture client", async () => {
    const readPublicStatus = vi.fn(async (expectedUserId: string) =>
      expectedUserId === USER_A
        ? { id: JOB_A, status: "pending" as const, retryable: true, result: null }
        : null,
    );
    const route = createJobStatusRoute({
      authenticate: async () => ({ userId: USER_B }),
      readPublicStatus,
      requestId: () => "req-cross-user",
    });
    const response = await route(
      new Request(`https://app.popcorn.local/api/v1/jobs/${JOB_A}`),
      { params: Promise.resolve({ jobId: JOB_A }) },
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "FORBIDDEN" },
    });
    expect(readPublicStatus).toHaveBeenCalledWith(USER_B, JOB_A);

    const rpc = vi.fn();
    const repository = createSavedItemRepository({ ownerUserId: USER_A, rpc });
    await expect(repository.capture(USER_B, {} as never)).rejects.toThrow(
      "Capture client owner does not match",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  test("service evidence reads fail closed for leaked source, snapshot, or segment owners", async () => {
    const leakedSource = queryClient({
      video_sources: {
        data: { id: SOURCE_A, user_id: USER_A, youtube_video_id: "dQw4w9WgXcQ" },
        error: null,
      },
    });
    await expect(
      createSupabaseDurableJobStore(leakedSource.client as never)
        .readLearningArtifactEvidence(USER_B, SOURCE_A, SNAPSHOT_A, ["seg-a"]),
    ).resolves.toBeNull();

    const leakedSnapshot = queryClient({
      video_sources: {
        data: { id: SOURCE_A, user_id: USER_B, youtube_video_id: "dQw4w9WgXcQ" },
        error: null,
      },
      video_snapshots: {
        data: {
          id: SNAPSHOT_A,
          user_id: USER_A,
          video_source_id: SOURCE_A,
          transcript_hash: "b".repeat(64),
          title: "中文访谈",
        },
        error: null,
      },
    });
    await expect(
      createSupabaseDurableJobStore(leakedSnapshot.client as never)
        .readLearningArtifactEvidence(USER_B, SOURCE_A, SNAPSHOT_A, ["seg-a"]),
    ).resolves.toBeNull();

    const leakedSegment = queryClient({
      video_sources: {
        data: { id: SOURCE_A, user_id: USER_B, youtube_video_id: "dQw4w9WgXcQ" },
        error: null,
      },
      video_snapshots: {
        data: {
          id: SNAPSHOT_A,
          user_id: USER_B,
          video_source_id: SOURCE_A,
          transcript_hash: "b".repeat(64),
          title: "中文访谈",
        },
        error: null,
      },
      transcript_segments: {
        data: [{
          stable_id: "seg-a",
          original_chinese: "这也太离谱了吧。",
          start_seconds: 10,
          end_seconds: 14,
          user_id: USER_A,
        }],
        error: null,
      },
    });
    await expect(
      createSupabaseDurableJobStore(leakedSegment.client as never)
        .readLearningArtifactEvidence(USER_B, SOURCE_A, SNAPSHOT_A, ["seg-a"]),
    ).rejects.toThrow("transcript owner mismatch");
    expect(leakedSegment.ownerFilters).toEqual([
      ["video_sources", USER_B],
      ["video_snapshots", USER_B],
      ["transcript_segments", USER_B],
    ]);
  });

  test("a worker given the wrong expected owner stops before private reads or Providers", async () => {
    const store = {
      readPrivateInput: vi.fn(),
      readVideoId: vi.fn(),
    } as unknown as DurableJobStore;
    const provider = {
      request: vi.fn(),
      poll: vi.fn(),
    };
    const handler = createResolveSnapshotHandler({ store, provider });

    await expect(handler(leasedJob, USER_B, NOW)).rejects.toThrow(
      "expected owner does not match",
    );
    expect(store.readPrivateInput).not.toHaveBeenCalled();
    expect(store.readVideoId).not.toHaveBeenCalled();
    expect(provider.request).not.toHaveBeenCalled();
    expect(provider.poll).not.toHaveBeenCalled();
  });
});
