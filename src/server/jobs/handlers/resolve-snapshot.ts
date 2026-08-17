import type { KnowledgeJob } from "@/contracts/knowledge";
import { nextJobFailure } from "@/server/domain/lease-job";
import type {
  DurableJobStore,
  JobHandler,
  JobHandlerResult,
} from "@/server/jobs/process-jobs";
import type {
  TranscriptPollResult,
  TranscriptProvider,
  TranscriptRequestResult,
} from "@/server/transcript/provider";

const MAX_PROVIDER_JOB_ID_LENGTH = 200;

function providerJobIdFrom(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("private job input must be an object");
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).some((key) => key !== "providerJobId") ||
    typeof input.providerJobId !== "string" ||
    input.providerJobId.trim() !== input.providerJobId ||
    input.providerJobId.length === 0 ||
    input.providerJobId.length > MAX_PROVIDER_JOB_ID_LENGTH
  ) {
    throw new TypeError("private job input must contain one bounded providerJobId");
  }
  return input.providerJobId;
}

function terminalFailure(
  job: Extract<KnowledgeJob, { status: "leased" }>,
  code: string,
  now: string,
): Extract<KnowledgeJob, { status: "terminal_failed" }> {
  return {
    ...job,
    status: "terminal_failed",
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode: code,
    updatedAt: now,
  };
}

async function persistTerminal(
  store: DurableJobStore,
  expectedUserId: string,
  job: Extract<KnowledgeJob, { status: "leased" }>,
  code: string,
  now: string,
): Promise<JobHandlerResult> {
  const persisted = await store.persistState(
    expectedUserId,
    job,
    terminalFailure(job, code, now),
  );
  if (!persisted) return "deferred";
  await store.clearPrivateProviderInput(expectedUserId, job.id);
  return "failed";
}

export function createResolveSnapshotHandler({
  store,
  provider,
}: {
  readonly store: DurableJobStore;
  readonly provider: TranscriptProvider;
}): JobHandler {
  return async (job, expectedUserId, now) => {
    if (job.userId !== expectedUserId) {
      throw new Error("expected owner does not match the claimed job owner");
    }
    if (job.type !== "resolve_snapshot") {
      throw new TypeError("resolve snapshot handler received another job type");
    }

    const privateInput = await store.readPrivateInput(expectedUserId, job.id);
    let result: TranscriptRequestResult | TranscriptPollResult;
    if (
      privateInput === null ||
      (typeof privateInput === "object" &&
        !Array.isArray(privateInput) &&
        Object.keys(privateInput).length === 0)
    ) {
      const videoId = await store.readVideoId(expectedUserId, job.sourceId);
      const initialResult = await provider.request(videoId);
      if (initialResult.kind === "pending") {
        const retryState = nextJobFailure(job, "SYNC_RETRYING", now);
        const persisted = await store.persistState(
          expectedUserId,
          job,
          retryState,
        );
        if (!persisted) return "deferred";
        await store.writePrivateInput(expectedUserId, job.id, {
          providerJobId: initialResult.providerJobId,
        });
        return "deferred";
      }
      result = initialResult;
    } else {
      let providerJobId: string;
      try {
        providerJobId = providerJobIdFrom(privateInput);
      } catch {
        return persistTerminal(
          store,
          expectedUserId,
          job,
          "PROVIDER_OUTPUT_INVALID",
          now,
        );
      }
      result = await provider.poll(providerJobId);
    }

    /* Both an initial request and one durable poll converge here. */
    if (result.kind === "ready") {
      const persisted = await store.persistResolved(
        expectedUserId,
        job,
        result.snapshot,
        now,
      );
      if (!persisted) return "deferred";
      await store.clearPrivateProviderInput(expectedUserId, job.id);
      return "completed";
    }
    if (result.kind === "pending") {
      await store.persistState(
        expectedUserId,
        job,
        nextJobFailure(job, "SYNC_RETRYING", now),
      );
      return "deferred";
    }
    if (result.kind === "unsupported") {
      return persistTerminal(store, expectedUserId, job, result.code, now);
    }
    if (!result.retryable) {
      return persistTerminal(store, expectedUserId, job, result.code, now);
    }

    const failed = nextJobFailure(job, result.code, now);
    const persisted = await store.persistState(expectedUserId, job, failed);
    if (!persisted) return "deferred";
    if (failed.status === "terminal_failed") {
      await store.clearPrivateProviderInput(expectedUserId, job.id);
      return "failed";
    }
    return "deferred";
  };
}
