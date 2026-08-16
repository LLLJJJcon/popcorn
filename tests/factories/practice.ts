import type {
  CandidateExpression,
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
