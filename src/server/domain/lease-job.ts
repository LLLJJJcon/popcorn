import { createHash } from "node:crypto";

import type { KnowledgeJob, KnowledgeJobType } from "@/contracts/knowledge";

export const LEASE_DURATION_MS = 5 * 60 * 1_000;
export const MAX_JOB_ATTEMPTS = 5;
export const RETRY_BASE_DELAY_MS = 60 * 1_000;
export const RETRY_MAX_DELAY_MS = 60 * 60 * 1_000;

const CONTRACT_MAX_ATTEMPTS = 20;
const ERROR_CATEGORY_MAX_LENGTH = 100;
const CANONICAL_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256_HASH = /^[0-9a-f]{64}$/;
const JOB_TYPES = new Set<KnowledgeJobType>([
  "resolve_snapshot",
  "generate_overview",
  "translate_segments",
  "explain_selection",
  "analyze_saved_item",
]);

type LeasedJob = Extract<KnowledgeJob, { status: "leased" }>;
export type FailedJob = Extract<
  KnowledgeJob,
  { status: "retryable_failed" | "terminal_failed" }
>;

export type LeaseDecision =
  | { readonly kind: "leased"; readonly job: LeasedJob }
  | {
      readonly kind: "not_eligible";
      readonly job: KnowledgeJob;
      readonly reason: "not_due" | "active_lease" | "succeeded" | "terminal_failed";
    };

export type JobResultKeyInput = {
  readonly jobType: KnowledgeJobType;
  readonly sourceHash: string;
  readonly savedItemHash: string | null;
  readonly promptVersion: string;
  readonly modelVersion: string;
};

function parseUtcClock(value: string): number {
  if (!CANONICAL_UTC_INSTANT.test(value)) {
    throw new RangeError("now must be a valid ISO 8601 UTC instant");
  }

  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new RangeError("now must be a valid ISO 8601 UTC instant");
  }

  return milliseconds;
}

function assertOperationalAttemptCount(attemptCount: number, minimum: number): void {
  if (
    !Number.isInteger(attemptCount) ||
    attemptCount < minimum ||
    attemptCount > MAX_JOB_ATTEMPTS
  ) {
    throw new RangeError(
      `attempt count must be between ${minimum} and ${MAX_JOB_ATTEMPTS}`,
    );
  }
}

function notEligible(job: KnowledgeJob): LeaseDecision {
  switch (job.status) {
    case "retryable_failed":
      return { kind: "not_eligible", job, reason: "not_due" };
    case "leased":
      return { kind: "not_eligible", job, reason: "active_lease" };
    case "succeeded":
      return { kind: "not_eligible", job, reason: "succeeded" };
    case "terminal_failed":
      return { kind: "not_eligible", job, reason: "terminal_failed" };
    case "pending":
      throw new Error("pending jobs are eligible");
  }
}

export function leaseJob(job: KnowledgeJob, now: string): LeaseDecision {
  const nowMs = parseUtcClock(now);
  const eligible =
    job.status === "pending" ||
    (job.status === "retryable_failed" && Date.parse(job.nextAttemptAt) <= nowMs) ||
    (job.status === "leased" && Date.parse(job.leaseExpiresAt) <= nowMs);

  if (!eligible) {
    return notEligible(job);
  }

  assertOperationalAttemptCount(job.attemptCount, 0);
  if (job.attemptCount === MAX_JOB_ATTEMPTS) {
    throw new RangeError(`attempt count cannot exceed ${MAX_JOB_ATTEMPTS}`);
  }

  return {
    kind: "leased",
    job: {
      ...job,
      status: "leased",
      attemptCount: job.attemptCount + 1,
      nextAttemptAt: null,
      leaseExpiresAt: new Date(nowMs + LEASE_DURATION_MS).toISOString(),
      lastErrorCode: null,
      updatedAt: now,
    },
  };
}

export function retryDelayMs(completedAttemptCount: number): number {
  if (
    !Number.isInteger(completedAttemptCount) ||
    completedAttemptCount < 1 ||
    completedAttemptCount > CONTRACT_MAX_ATTEMPTS
  ) {
    throw new RangeError(
      `attempt count must be between 1 and ${CONTRACT_MAX_ATTEMPTS}`,
    );
  }

  return Math.min(
    RETRY_BASE_DELAY_MS * 2 ** (completedAttemptCount - 1),
    RETRY_MAX_DELAY_MS,
  );
}

function normalizeErrorCategory(error: string): string {
  const normalized = error.trim();
  if (
    normalized.length === 0 ||
    [...normalized].length > ERROR_CATEGORY_MAX_LENGTH
  ) {
    throw new RangeError(
      `error category must contain 1 to ${ERROR_CATEGORY_MAX_LENGTH} characters`,
    );
  }

  return normalized;
}

export function nextJobFailure(
  job: KnowledgeJob,
  error: string,
  now: string,
): FailedJob {
  const nowMs = parseUtcClock(now);
  if (job.status !== "leased") {
    throw new TypeError("only a leased job can record a failure");
  }

  assertOperationalAttemptCount(job.attemptCount, 1);
  const lastErrorCode = normalizeErrorCategory(error);

  if (job.attemptCount === MAX_JOB_ATTEMPTS) {
    return {
      ...job,
      status: "terminal_failed",
      nextAttemptAt: null,
      leaseExpiresAt: null,
      lastErrorCode,
      updatedAt: now,
    };
  }

  return {
    ...job,
    status: "retryable_failed",
    nextAttemptAt: new Date(nowMs + retryDelayMs(job.attemptCount)).toISOString(),
    leaseExpiresAt: null,
    lastErrorCode,
    updatedAt: now,
  };
}

function assertHash(value: string, field: string): void {
  if (!SHA256_HASH.test(value)) {
    throw new TypeError(`${field} must be a lowercase SHA-256 hash`);
  }
}

function assertVersion(value: string, field: string): void {
  if (value.trim().length === 0 || [...value].length > 100) {
    throw new TypeError(`${field} must contain 1 to 100 characters`);
  }
}

function encodeComponent(name: string, value: string | null): string {
  if (value === null) {
    return `${Buffer.byteLength(name, "utf8")}:${name}:N;`;
  }

  return `${Buffer.byteLength(name, "utf8")}:${name}:S${Buffer.byteLength(value, "utf8")}:${value};`;
}

export function createJobResultKey(input: JobResultKeyInput): string {
  if (!JOB_TYPES.has(input.jobType)) {
    throw new TypeError("jobType must be a supported knowledge job type");
  }
  assertHash(input.sourceHash, "sourceHash");
  if (input.savedItemHash !== null) {
    assertHash(input.savedItemHash, "savedItemHash");
  }
  assertVersion(input.promptVersion, "promptVersion");
  assertVersion(input.modelVersion, "modelVersion");

  const canonical = [
    encodeComponent("schema", "popcorn-job-result-key-v1"),
    encodeComponent("jobType", input.jobType),
    encodeComponent("sourceHash", input.sourceHash),
    encodeComponent("savedItemHash", input.savedItemHash),
    encodeComponent("promptVersion", input.promptVersion),
    encodeComponent("modelVersion", input.modelVersion),
  ].join("");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
