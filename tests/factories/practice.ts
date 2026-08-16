import type {
  CandidateExpression,
  EvaluationResult,
  GeneratedArtifact,
  KnowledgeJob,
  PracticeTask,
} from "@/contracts";

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

export function makePracticeTask(overrides: Partial<PracticeTask> = {}): PracticeTask {
  return {
    id: "00000000-0000-4000-8000-000000000201",
    userExpressionId: "00000000-0000-4000-8000-000000000202",
    kind: "use_it_now",
    nativeLanguage: "en",
    targetLanguage: "zh-CN",
    targetExpression: "太离谱了",
    promptEnglish: "React to a friend telling you that a taxi charged ten times the normal price.",
    contextEnglish: "You are chatting informally with a close friend.",
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

export function makeKnowledgeJob(overrides: Partial<KnowledgeJob> = {}): KnowledgeJob {
  return {
    id: "00000000-0000-4000-8000-000000000302",
    userId: "00000000-0000-4000-8000-000000000002",
    sourceId: "00000000-0000-4000-8000-000000000001",
    savedItemId: null,
    type: "generate_overview",
    status: "pending",
    dedupeKey: "b".repeat(64),
    attemptCount: 0,
    nextAttemptAt: "2026-08-16T10:00:00.000Z",
    leaseExpiresAt: null,
    lastErrorCode: null,
    createdAt: "2026-08-16T10:00:00.000Z",
    updatedAt: "2026-08-16T10:00:00.000Z",
    ...overrides,
  };
}
