import type {
  AttemptRecorded,
  CandidateExpression,
  EvaluationResult,
  GeneratedArtifact,
  KnowledgeJob,
  PracticeTask,
  ReviewTask,
} from "@/contracts";

type PracticeTaskFixture = Omit<
  Extract<PracticeTask, { kind: "use_it_now" }>,
  "kind" | "dueAt"
> & {
  kind: PracticeTask["kind"];
  dueAt: string | null;
};

type KnowledgeJobFixture = Omit<
  Extract<KnowledgeJob, { status: "pending" }>,
  "status" | "nextAttemptAt" | "leaseExpiresAt" | "lastErrorCode"
> & {
  status: KnowledgeJob["status"];
  nextAttemptAt: string | null;
  leaseExpiresAt: string | null;
  lastErrorCode: string | null;
};

export function makeCandidateExpression(
  overrides: Partial<CandidateExpression> = {},
): CandidateExpression {
  return {
    expression: "太离谱了",
    englishMeaning: "That is outrageous.",
    englishExplanation: "A colloquial reaction to something extremely unreasonable.",
    tone: "Incredulous",
    communicativeFunction: "Expressing disbelief",
    register: "Informal spoken language",
    evidenceText: "这也太离谱了吧。",
    segmentIds: ["seg-42"],
    startSeconds: 42,
    endSeconds: 48,
    confidence: 0.98,
    ...overrides,
  };
}

export function makePracticeTask(
  overrides: Partial<PracticeTaskFixture> = {},
): PracticeTaskFixture {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    userId: "00000000-0000-4000-8000-000000000002",
    userExpressionId: "00000000-0000-4000-8000-000000000202",
    kind: "use_it_now",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: "太离谱了",
    promptChinese: "你的朋友说出租车收了平时十倍的价钱。",
    instructionsEnglish: "Respond naturally in Chinese using the target expression.",
    goalEnglish: "React with disbelief to an unreasonable price.",
    createdAt: "2026-08-16T10:00:00.000Z",
    dueAt: null,
    ...overrides,
  };
}

export function makeEvaluationResult(
  overrides: Partial<EvaluationResult> = {},
): EvaluationResult {
  return {
    passed: true,
    accuracy: {
      score: 5,
      englishFeedback: "The expression is accurate.",
    },
    naturalness: {
      score: 4,
      englishFeedback: "The response sounds natural in conversation.",
    },
    contextualFit: {
      score: 5,
      englishFeedback: "The expression fits this situation well.",
    },
    independentUse: true,
    assistanceLevel: "none",
    ...overrides,
  };
}

export function makeAttemptRecorded(
  overrides: Partial<AttemptRecorded> = {},
): AttemptRecorded {
  return {
    id: "00000000-0000-4000-8000-000000000203",
    userId: "00000000-0000-4000-8000-000000000002",
    practiceTaskId: "00000000-0000-4000-8000-000000000201",
    userExpressionId: "00000000-0000-4000-8000-000000000202",
    responseChinese: "这也太离谱了吧。",
    evaluation: makeEvaluationResult(),
    submittedAt: "2026-08-16T10:01:00.000Z",
    createdAt: "2026-08-16T10:01:01.000Z",
    ...overrides,
  };
}

export function makeReviewTask(overrides: Partial<ReviewTask> = {}): ReviewTask {
  return {
    id: "00000000-0000-4000-8000-000000000204",
    userId: "00000000-0000-4000-8000-000000000002",
    userExpressionId: "00000000-0000-4000-8000-000000000202",
    masteryState: "tried",
    status: "pending",
    dueAt: "2026-08-17T10:00:00.000Z",
    intervalDays: 1,
    consecutiveSuccesses: 0,
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

export function makeGeneratedArtifact(
  overrides: Partial<GeneratedArtifact> = {},
): GeneratedArtifact {
  return {
    id: "00000000-0000-4000-8000-000000000301",
    userId: "00000000-0000-4000-8000-000000000002",
    sourceId: "00000000-0000-4000-8000-000000000001",
    savedItemId: null,
    type: "overview",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    content: { summary: "中文概览" },
    promptVersion: "overview-v1",
    model: "gpt-5.6",
    resultKey: "a".repeat(64),
    createdAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}

export function makeKnowledgeJob(
  overrides: Partial<KnowledgeJobFixture> = {},
): KnowledgeJobFixture {
  return {
    id: "00000000-0000-4000-8000-000000000302",
    userId: "00000000-0000-4000-8000-000000000002",
    sourceId: "00000000-0000-4000-8000-000000000001",
    savedItemId: null,
    type: "generate_overview",
    status: "pending",
    dedupeKey: "b".repeat(64),
    attemptCount: 0,
    nextAttemptAt: null,
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}
