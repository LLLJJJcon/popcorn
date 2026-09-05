import {
  EvaluationResultSchema,
  PracticeCoachingSchema,
  type AssistanceLevel,
  type EvaluationResult,
  type PracticeCoaching,
  type PracticeTask,
} from "@/contracts/practice";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";

export const EVALUATE_PRACTICE_PROMPT_VERSION = "evaluate-practice-v2";

export function buildEvaluatePracticePrompt(
  task: PracticeTask,
  responseChinese: string,
  assistanceLevel: AssistanceLevel = "none",
): string {
  return [
    "Evaluate an English-speaking learner's original Simplified Chinese response.",
    "Return JSON only with passed, accuracy, naturalness, contextualFit, independentUse, assistanceLevel, and naturalRevisionChinese.",
    "Each dimension must contain an integer score from 1 to 5 and concise English feedback.",
    "Set assistanceLevel to the supplied value. independentUse must be true only when assistanceLevel is none.",
    "Return one concise naturalRevisionChinese after the learner has submitted; it must preserve the intended meaning and include the target expression.",
    "Do not add a model answer before submission, prompt, secret, or extra field.",
    "Evaluate only against the supplied target and situation:",
    JSON.stringify({
      targetExpression: task.targetExpression,
      promptChinese: task.promptChinese,
      instructionsEnglish: task.instructionsEnglish,
      goalEnglish: task.goalEnglish,
      responseChinese,
      assistanceLevel,
    }),
  ].join("\n");
}

const fixtureEvaluation = {
  passed: true,
  accuracy: { score: 4, englishFeedback: "The target expression is used with the intended meaning." },
  naturalness: { score: 4, englishFeedback: "The response is natural for an informal spoken exchange." },
  contextualFit: { score: 4, englishFeedback: "The response directly fits the supplied situation." },
  independentUse: true,
  assistanceLevel: "none",
  naturalRevisionChinese: "这个价格也太离谱了吧。",
};

export type ParsedPracticeEvaluation = {
  readonly evaluation: EvaluationResult;
  readonly coaching: PracticeCoaching | null;
};

export function parsePracticeEvaluationOutput(
  value: unknown,
  targetExpression: string,
  assistanceLevel: AssistanceLevel,
): ParsedPracticeEvaluation {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("invalid Practice evaluation output");
  }
  const { naturalRevisionChinese, ...evaluationValue } = value as Record<string, unknown>;
  const evaluation = EvaluationResultSchema.parse({
    ...evaluationValue,
    independentUse: assistanceLevel === "none",
    assistanceLevel,
  });
  const parsedCoaching = PracticeCoachingSchema.safeParse({ naturalRevisionChinese });
  const coaching = parsedCoaching.success && parsedCoaching.data.naturalRevisionChinese.includes(targetExpression)
    ? parsedCoaching.data
    : null;
  return { evaluation, coaching };
}

export function createEvaluationFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/evaluation-v2",
    async complete(_promptVersion, prompt) {
      const promptInput = JSON.parse(prompt.slice(prompt.lastIndexOf("\n") + 1)) as {
        readonly targetExpression?: unknown;
        readonly assistanceLevel?: unknown;
      };
      const targetExpression = typeof promptInput.targetExpression === "string"
        ? promptInput.targetExpression
        : "太离谱了";
      const assistanceLevel = promptInput.assistanceLevel === "hint" || promptInput.assistanceLevel === "model_answer"
        ? promptInput.assistanceLevel
        : "none";
      return {
        ...fixtureEvaluation,
        independentUse: assistanceLevel === "none",
        assistanceLevel,
        naturalRevisionChinese: targetExpression === "太离谱了"
          ? fixtureEvaluation.naturalRevisionChinese
          : `${targetExpression}。`,
      };
    },
  };
}
