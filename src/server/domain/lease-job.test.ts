import { describe, expect, test } from "vitest";

import { KnowledgeJobSchema, type KnowledgeJob } from "@/contracts/knowledge";

import {
  LEASE_DURATION_MS,
  MAX_JOB_ATTEMPTS,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  createJobResultKey,
  leaseJob,
  nextJobFailure,
  retryDelayMs,
} from "./lease-job";

const NOW = "2026-08-16T00:00:00.000Z";
const SOURCE_HASH = "a".repeat(64);
const SAVED_ITEM_HASH = "b".repeat(64);

function job(overrides: Partial<KnowledgeJob> = {}): KnowledgeJob {
  return KnowledgeJobSchema.parse({
    id: "00000000-0000-4000-8000-000000000401",
    userId: "00000000-0000-4000-8000-000000000402",
    sourceId: "00000000-0000-4000-8000-000000000403",
    savedItemId: "00000000-0000-4000-8000-000000000404",
    type: "analyze_saved_item",
    dedupeKey: "c".repeat(64),
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    ...overrides,
  });
}

describe("operational constants", () => {
  test("freezes lease, attempt, retry-base, and retry-cap values", () => {
    expect(LEASE_DURATION_MS).toBe(5 * 60 * 1_000);
    expect(MAX_JOB_ATTEMPTS).toBe(5);
    expect(RETRY_BASE_DELAY_MS).toBe(60 * 1_000);
    expect(RETRY_MAX_DELAY_MS).toBe(60 * 60 * 1_000);
  });
});

describe("leaseJob", () => {
  test.each([
    job(),
    job({
      status: "retryable_failed",
      attemptCount: 1,
      nextAttemptAt: NOW,
      lastErrorCode: "PROVIDER_UNAVAILABLE",
    }),
    job({
      status: "leased",
      attemptCount: 1,
      leaseExpiresAt: NOW,
    }),
  ])("leases eligible jobs and treats equality as due", (input) => {
    const before = structuredClone(input);
    const decision = leaseJob(input, NOW);

    expect(decision).toEqual({
      kind: "leased",
      job: {
        ...input,
        status: "leased",
        attemptCount: input.attemptCount + 1,
        nextAttemptAt: null,
        leaseExpiresAt: "2026-08-16T00:05:00.000Z",
        lastErrorCode: null,
        updatedAt: NOW,
      },
    });
    expect(input).toEqual(before);
  });

  test.each([
    job({
      status: "retryable_failed",
      attemptCount: 1,
      nextAttemptAt: "2026-08-16T00:00:00.001Z",
      lastErrorCode: "PROVIDER_UNAVAILABLE",
    }),
    job({
      status: "leased",
      attemptCount: 1,
      leaseExpiresAt: "2026-08-16T00:00:00.001Z",
    }),
    job({ status: "succeeded", attemptCount: 1 }),
    job({
      status: "terminal_failed",
      attemptCount: 5,
      lastErrorCode: "JOB_RETRY_EXHAUSTED",
    }),
  ])("does not lease ineligible jobs and preserves the original", (input) => {
    const before = structuredClone(input);
    const decision = leaseJob(input, NOW);

    expect(decision.kind).toBe("not_eligible");
    if (decision.kind === "not_eligible") {
      expect(decision.job).toBe(input);
      expect(decision.job).toEqual(before);
    }
    expect(input).toEqual(before);
  });

  test.each(["invalid", "2026-02-30T00:00:00.000Z", ""])(
    "rejects invalid injected clock %j",
    (now) => {
      expect(() => leaseJob(job(), now)).toThrow(/valid ISO 8601/i);
    },
  );

  test("rejects an attempt that would exceed the operational maximum", () => {
    expect(() => leaseJob(job({ attemptCount: 5 }), NOW)).toThrow(
      /attempt count/i,
    );
  });
});

describe("nextJobFailure", () => {
  test("uses bounded exponential backoff from the completed attempt count", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(3)).toBe(240_000);
    expect(retryDelayMs(20)).toBe(RETRY_MAX_DELAY_MS);

    const failed = nextJobFailure(
      job({ status: "leased", attemptCount: 3, leaseExpiresAt: "2026-08-16T00:05:00.000Z" }),
      "PROVIDER_UNAVAILABLE",
      NOW,
    );

    expect(failed).toEqual({
      ...job({ status: "leased", attemptCount: 3, leaseExpiresAt: "2026-08-16T00:05:00.000Z" }),
      status: "retryable_failed",
      nextAttemptAt: "2026-08-16T00:04:00.000Z",
      leaseExpiresAt: null,
      lastErrorCode: "PROVIDER_UNAVAILABLE",
      updatedAt: NOW,
    });
  });

  test("makes failure of the fifth leased attempt terminal", () => {
    const input = job({
      status: "leased",
      attemptCount: 5,
      leaseExpiresAt: "2026-08-16T00:05:00.000Z",
    });
    const before = structuredClone(input);

    expect(nextJobFailure(input, "PROVIDER_UNAVAILABLE", NOW)).toEqual({
      ...input,
      status: "terminal_failed",
      nextAttemptAt: null,
      leaseExpiresAt: null,
      lastErrorCode: "PROVIDER_UNAVAILABLE",
      updatedAt: NOW,
    });
    expect(input).toEqual(before);
  });

  test("does not mutate a leased input when recording failure", () => {
    const input = job({
      status: "leased",
      attemptCount: 2,
      leaseExpiresAt: "2026-08-16T00:05:00.000Z",
    });
    const before = structuredClone(input);

    nextJobFailure(input, "PROVIDER_RATE_LIMITED", NOW);

    expect(input).toEqual(before);
  });

  test("rejects non-leased inputs", () => {
    expect(() => nextJobFailure(job(), "PROVIDER_UNAVAILABLE", NOW)).toThrow(
      /leased/i,
    );
  });

  test.each(["", "   ", "x".repeat(101)])(
    "rejects invalid error category %j",
    (error) => {
      expect(() =>
        nextJobFailure(
          job({
            status: "leased",
            attemptCount: 1,
            leaseExpiresAt: "2026-08-16T00:05:00.000Z",
          }),
          error,
          NOW,
        ),
      ).toThrow(/error category/i);
    },
  );

  test("rejects leased attempt underflow and overflow", () => {
    const invalidUnderflow = {
      ...job({ status: "leased", attemptCount: 1, leaseExpiresAt: NOW }),
      attemptCount: 0,
    } as KnowledgeJob;
    const invalidOverflow = {
      ...job({ status: "leased", attemptCount: 5, leaseExpiresAt: NOW }),
      attemptCount: 6,
    } as KnowledgeJob;

    expect(() => nextJobFailure(invalidUnderflow, "ERROR", NOW)).toThrow(
      /attempt count/i,
    );
    expect(() => nextJobFailure(invalidOverflow, "ERROR", NOW)).toThrow(
      /attempt count/i,
    );
  });
});

describe("createJobResultKey", () => {
  const input = {
    jobType: "analyze_saved_item" as const,
    sourceHash: SOURCE_HASH,
    savedItemHash: SAVED_ITEM_HASH,
    promptVersion: "saved-analysis.v1",
    modelVersion: "gpt-fixture-v1",
  };

  test("returns a stable lowercase SHA-256 key", () => {
    const first = createJobResultKey(input);
    const second = createJobResultKey({ ...input });

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });

  test.each([
    ["job type", { jobType: "generate_overview" as const }],
    ["source hash", { sourceHash: "d".repeat(64) }],
    ["saved-item hash", { savedItemHash: "e".repeat(64) }],
    ["prompt version", { promptVersion: "saved-analysis.v2" }],
    ["model version", { modelVersion: "gpt-fixture-v2" }],
  ])("changes when the %s changes", (_component, override) => {
    expect(createJobResultKey({ ...input, ...override })).not.toBe(
      createJobResultKey(input),
    );
  });

  test("distinguishes a null saved-item hash from a real hash", () => {
    expect(createJobResultKey({ ...input, savedItemHash: null })).not.toBe(
      createJobResultKey(input),
    );
  });

  test("uses unambiguous component boundaries", () => {
    expect(
      createJobResultKey({ ...input, promptVersion: "ab", modelVersion: "c" }),
    ).not.toBe(
      createJobResultKey({ ...input, promptVersion: "a", modelVersion: "bc" }),
    );
  });
});
