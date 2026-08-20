import type { PracticeDraftRecord } from "@/server/domain/create-practice-task";
import {
  createRecordValidAttemptService,
  createSupabasePracticePromotionRepository,
  type PracticePromotionRepository,
} from "@/server/domain/record-valid-attempt";
import type { PracticeDraftAttemptRecord } from "@/server/repositories/attempt-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const DRAFT = "22222222-2222-4222-8222-222222222222";
const ATTEMPT = "33333333-3333-4333-8333-333333333333";
const EXPRESSION = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-08-21T02:03:04.000Z";
const DUE = "2026-08-22T02:03:04.000Z";

const draft: PracticeDraftRecord = {
  id: DRAFT,
  userId: USER,
  videoSourceId: "55555555-5555-4555-8555-555555555555",
  savedItemId: "66666666-6666-4666-8666-666666666666",
  candidateArtifactId: "77777777-7777-4777-8777-777777777777",
  candidateIndex: 0,
  futureUserExpressionId: EXPRESSION,
  nativeLanguage: "en",
  targetLanguage: "zh-CN",
  targetExpression: "　太离谱了　",
  promptChinese: "朋友说一杯咖啡要一百元，你会怎么回应？",
  instructionsEnglish: "Reply in natural Chinese.",
  goalEnglish: "React to the unreasonable price.",
  status: "active",
  activationPromptVersion: null,
  activationModel: null,
  activationGatewayConfigId: null,
  activationGatewayRevision: null,
  activationGatewayFingerprint: null,
  createdAt: NOW,
  updatedAt: NOW,
};

function attempt(overrides: Partial<PracticeDraftAttemptRecord> = {}): PracticeDraftAttemptRecord {
  return {
    id: ATTEMPT,
    userId: USER,
    practiceDraftId: DRAFT,
    futureUserExpressionId: EXPRESSION,
    revision: 1,
    responseChinese: "这个价格也太离谱了。",
    passed: true,
    accuracyScore: 5,
    accuracyFeedbackEnglish: "Accurate.",
    naturalnessScore: 5,
    naturalnessFeedbackEnglish: "Natural.",
    contextualFitScore: 5,
    contextualFitFeedbackEnglish: "Fits.",
    independentUse: true,
    assistanceLevel: "none",
    submittedAt: NOW,
    evaluationPromptVersion: null,
    evaluationModel: null,
    evaluationGatewayConfigId: null,
    evaluationGatewayRevision: null,
    evaluationGatewayFingerprint: null,
    createdAt: NOW,
    ...overrides,
  };
}

const promoted = {
  expressionSenseId: "88888888-8888-4888-8888-888888888888",
  occurrenceId: "99999999-9999-4999-8999-999999999999",
  userExpressionId: EXPRESSION,
  practiceTaskId: DRAFT,
  attemptId: ATTEMPT,
  masteryEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reviewTaskId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  created: true,
};

describe("valid original promotion service", () => {
  test("derives tried, normalized target and one-day schedule before the exact RPC boundary", async () => {
    const repository: PracticePromotionRepository = { promote: vi.fn(async () => promoted) };
    const service = createRecordValidAttemptService({ repository });

    await expect(service.promote(USER, draft, attempt())).resolves.toEqual(promoted);
    expect(repository.promote).toHaveBeenCalledExactlyOnceWith({
      userId: USER,
      practiceDraftAttemptId: ATTEMPT,
      normalizedExpressionText: "太离谱了",
      dueAt: DUE,
      intervalDays: 1,
    });
  });

  test.each([
    ["failed original", { passed: false }],
    ["passing revision", { revision: 2 }],
    ["assisted original", { independentUse: false, assistanceLevel: "hint" as const }],
  ])("refuses %s without calling promotion", async (_label, overrides) => {
    const repository: PracticePromotionRepository = { promote: vi.fn(async () => promoted) };
    const service = createRecordValidAttemptService({ repository });
    await expect(service.promote(USER, draft, attempt(overrides))).rejects.toThrow();
    expect(repository.promote).not.toHaveBeenCalled();
  });

  test("maps the generated RPC without exposing provider or client authority", async () => {
    const rpc = vi.fn(async () => ({ data: [{
      expression_sense_id: promoted.expressionSenseId,
      occurrence_id: promoted.occurrenceId,
      user_expression_id: promoted.userExpressionId,
      practice_task_id: promoted.practiceTaskId,
      attempt_id: promoted.attemptId,
      mastery_event_id: promoted.masteryEventId,
      review_task_id: promoted.reviewTaskId,
      created: false,
    }], error: null }));
    const repository = createSupabasePracticePromotionRepository({ rpc } as never);

    await expect(repository.promote({
      userId: USER,
      practiceDraftAttemptId: ATTEMPT,
      normalizedExpressionText: "太离谱了",
      dueAt: DUE,
      intervalDays: 1,
    })).resolves.toEqual({ ...promoted, created: false });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("promote_valid_practice_draft_attempt", {
      p_user_id: USER,
      p_practice_draft_attempt_id: ATTEMPT,
      p_normalized_expression_text: "太离谱了",
      p_due_at: DUE,
      p_interval_days: 1,
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toMatch(/api.?key|prompt|raw|provider|model/i);
  });
});
