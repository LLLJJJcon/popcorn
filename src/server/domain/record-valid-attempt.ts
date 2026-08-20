import type { SupabaseClient } from "@supabase/supabase-js";

import { TargetChineseTextSchema } from "@/contracts/source";
import { advanceMastery } from "@/server/domain/mastery";
import { scheduleReview } from "@/server/domain/schedule-review";
import type { PracticeDraftRecord } from "@/server/domain/create-practice-task";
import type { PracticeDraftAttemptRecord } from "@/server/repositories/attempt-repository";
import type { Database } from "@/types/database.generated";

export type PracticePromotionResult = {
  readonly expressionSenseId: string;
  readonly occurrenceId: string;
  readonly userExpressionId: string;
  readonly practiceTaskId: string;
  readonly attemptId: string;
  readonly masteryEventId: string;
  readonly reviewTaskId: string;
  readonly created: boolean;
};

export type PracticePromotionRepository = {
  promote(input: {
    readonly userId: string;
    readonly practiceDraftAttemptId: string;
    readonly normalizedExpressionText: string;
    readonly dueAt: string;
    readonly intervalDays: 1;
  }): Promise<PracticePromotionResult>;
};

function normalizeTarget(value: string): string {
  return TargetChineseTextSchema.max(200).parse(value.normalize("NFKC").trim());
}

export function createRecordValidAttemptService({
  repository,
}: {
  readonly repository: PracticePromotionRepository;
}) {
  return {
    async promote(
      userId: string,
      draft: PracticeDraftRecord,
      attempt: PracticeDraftAttemptRecord,
    ): Promise<PracticePromotionResult> {
      if (
        userId !== draft.userId || userId !== attempt.userId ||
        draft.id !== attempt.practiceDraftId ||
        draft.futureUserExpressionId !== attempt.futureUserExpressionId ||
        attempt.revision !== 1 || !attempt.passed ||
        !attempt.independentUse || attempt.assistanceLevel !== "none" ||
        advanceMastery(null, { kind: "valid_original_attempt" }) !== "tried"
      ) throw new TypeError("attempt is not eligible for promotion");

      const schedule = scheduleReview({ kind: "first_tried", now: attempt.submittedAt });
      if (schedule.intervalDays !== 1) throw new TypeError("invalid initial review schedule");
      return repository.promote({
        userId,
        practiceDraftAttemptId: attempt.id,
        normalizedExpressionText: normalizeTarget(draft.targetExpression),
        dueAt: schedule.dueAt,
        intervalDays: 1,
      });
    },
  };
}

export function createSupabasePracticePromotionRepository(
  client: SupabaseClient<Database>,
): PracticePromotionRepository {
  return {
    async promote(input) {
      const result = await client.rpc("promote_valid_practice_draft_attempt", {
        p_user_id: input.userId,
        p_practice_draft_attempt_id: input.practiceDraftAttemptId,
        p_normalized_expression_text: input.normalizedExpressionText,
        p_due_at: input.dueAt,
        p_interval_days: input.intervalDays,
      });
      if (result.error) throw result.error;
      const row = result.data[0];
      if (!row || result.data.length !== 1) throw new Error("practice promotion returned no receipt");
      return {
        expressionSenseId: row.expression_sense_id,
        occurrenceId: row.occurrence_id,
        userExpressionId: row.user_expression_id,
        practiceTaskId: row.practice_task_id,
        attemptId: row.attempt_id,
        masteryEventId: row.mastery_event_id,
        reviewTaskId: row.review_task_id,
        created: row.created,
      };
    },
  };
}
