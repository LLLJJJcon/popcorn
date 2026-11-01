import { z } from "zod";
import { PracticeError } from "@/server/domain/create-practice-task";
import type { createReviewPracticeService } from "@/server/domain/review-practice";
import type { DurableJobStore, JobHandler, JobHandlerResult, ReviewPreparationJobOutcome } from "@/server/jobs/process-jobs";

const InputSchema = z.strictObject({ kind: z.literal("prepare_transfer_task"), reviewTaskId: z.string().uuid() });
const ConfirmedFailureSchema = z.object({ kind: z.literal("prepare"), requestId: z.string().uuid(), state: z.literal("failed") });
const MAX_POLL_CALLS = 300;
const POLL_INTERVAL_MS = 1_000;

/** Polls one persisted review cycle; never creates retry IDs or generic artifact retries. */
export function createPrepareTransferTaskHandler({ store, service, now = () => new Date().toISOString(), wait = duration => new Promise(resolve => setTimeout(resolve, duration)) }: {
  store: DurableJobStore;
  service: Pick<ReturnType<typeof createReviewPracticeService>, "prepareInBackground">;
  now?: () => string;
  wait?: (milliseconds: number) => Promise<void>;
}): JobHandler {
  return async (job, expectedUserId, claimedAt): Promise<JobHandlerResult> => {
    if (job.userId !== expectedUserId) throw new Error("expected owner does not match claimed review preparation job");
    if (job.status !== "leased" || job.type !== "prepare_transfer_task") throw new TypeError("review preparation handler received another job type or state");
    const deadline = Date.parse(job.leaseExpiresAt);
    const claimed = Date.parse(claimedAt);
    const clock = (): string | null => { try { const value = now(); return Number.isFinite(Date.parse(value)) ? value : null; } catch { return null; } };
    const active = (time: string | null) => time !== null && Number.isFinite(deadline) && Date.parse(time) < deadline;
    if (!Number.isFinite(claimed) || claimed >= deadline || !active(clock()) || !store.finishReviewPreparationJob) return "deferred";
    const finish = async (outcome: ReviewPreparationJobOutcome): Promise<JobHandlerResult> => {
      const time = clock(), publish = store.finishReviewPreparationJob;
      if (!active(time) || !time || !publish) return "deferred";
      try {
        const persisted = await publish.call(store, expectedUserId, job, outcome, time);
        return persisted === true ? outcome.status === "succeeded" ? "completed" : "failed" : "deferred";
      } catch { return "deferred"; }
    };

    let raw: unknown;
    try { raw = await store.readPrivateInput(expectedUserId, job.id); }
    catch { return "deferred"; }
    const parsed = InputSchema.safeParse(raw);
    if (!parsed.success) return finish({ status: "terminal_failed", errorCode: "VALIDATION_FAILED" });
    const reviewTaskId = parsed.data.reviewTaskId;
    // Every poll uses this exact DB-owned job identity and original lease fence.
    const fence = { jobId: job.id, attemptCount: job.attemptCount, leaseExpiresAt: job.leaseExpiresAt };
    for (let poll = 0; poll < MAX_POLL_CALLS; poll++) {
      if (!active(clock())) return "deferred";
      try {
        const result = await service.prepareInBackground(expectedUserId, reviewTaskId, fence);
        if (result.reviewTaskId !== reviewTaskId) return "deferred";
        if (result.status === "ready") {
          if (!z.string().uuid().safeParse(result.id).success) return "deferred";
          return finish({ status: "succeeded", reviewTaskId, taskId: result.id });
        }
        if (result.status !== "preparing") return "deferred";
      } catch (error) {
        if (!(error instanceof PracticeError)) return "deferred";
        const confirmed = ConfirmedFailureSchema.safeParse(error.details?.operation);
        if (error.code === "GATEWAY_REQUIRED" || error.code === "LEGACY_METADATA_REQUIRED" || (confirmed.success && confirmed.data.requestId === job.id)) {
          return finish({ status: "terminal_failed", reviewTaskId, errorCode: error.code });
        }
        if (error.code !== "REQUEST_IN_PROGRESS") return "deferred";
      }
      if (poll + 1 >= MAX_POLL_CALLS) return "deferred";
      const time = clock();
      if (!active(time) || !time) return "deferred";
      try { await wait(Math.min(POLL_INTERVAL_MS, deadline - Date.parse(time))); }
      catch { return "deferred"; }
    }
    return "deferred";
  };
}
