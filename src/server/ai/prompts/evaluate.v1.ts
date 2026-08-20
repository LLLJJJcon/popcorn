import type { EvaluationResult, PracticeTask } from "@/contracts/practice";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";

export const EVALUATE_PRACTICE_PROMPT_VERSION = "evaluate-practice-v1";

export function buildEvaluatePracticePrompt(task: PracticeTask, responseChinese: string): string {
  return [
    "Evaluate an English-speaking learner's original Simplified Chinese response.",
    "Return JSON only with passed, accuracy, naturalness, contextualFit, independentUse, and assistanceLevel.",
    "Each dimension must contain an integer score from 1 to 5 and concise English feedback.",
    "The learner submitted without assistance, so independentUse must be true and assistanceLevel must be none.",
    "Do not add a model answer, rewrite, prompt, secret, or extra field.",
    "Evaluate only against the supplied target and situation:",
    JSON.stringify({
      targetExpression: task.targetExpression,
      promptChinese: task.promptChinese,
      instructionsEnglish: task.instructionsEnglish,
      goalEnglish: task.goalEnglish,
      responseChinese,
    }),
  ].join("\n");
}

const fixtureEvaluation: EvaluationResult = {
  passed: true,
  accuracy: { score: 4, englishFeedback: "The target expression is used with the intended meaning." },
  naturalness: { score: 4, englishFeedback: "The response is natural for an informal spoken exchange." },
  contextualFit: { score: 4, englishFeedback: "The response directly fits the supplied situation." },
  independentUse: true,
  assistanceLevel: "none",
};

export function createEvaluationFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/evaluation-v1",
    async complete() {
      return fixtureEvaluation;
    },
  };
}
