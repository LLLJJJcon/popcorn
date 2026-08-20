import { z } from "zod";

import { CandidateExpressionSchema, type CandidateExpression } from "@/contracts/knowledge";
import { EnglishTextSchema, TargetChineseTextSchema } from "@/contracts/source";
import type { StructuredJsonGateway } from "@/server/ai/structured-json-gateway";

export const ACTIVATE_PRACTICE_PROMPT_VERSION = "activate-practice-v1";

export const ActivationOutputSchema = z.strictObject({
  promptChinese: TargetChineseTextSchema.max(2_000),
  instructionsEnglish: EnglishTextSchema.max(1_000),
  goalEnglish: EnglishTextSchema.max(1_000),
  targetExpression: TargetChineseTextSchema.max(500),
  evidenceText: TargetChineseTextSchema.max(2_000),
  communicativeFunction: EnglishTextSchema.max(1_000),
});

export type ActivationOutput = z.infer<typeof ActivationOutputSchema>;

export function buildActivatePracticePrompt(candidate: CandidateExpression): string {
  return [
    "Create one learner-first Mandarin practice situation for an English-speaking learner.",
    "Return JSON only with promptChinese, instructionsEnglish, goalEnglish, targetExpression, evidenceText, and communicativeFunction.",
    "The Chinese prompt must be a short situation or learner question ending in ? or ？, not a completed answer.",
    "The English instructions and goal must ask the learner to produce their own Simplified Chinese response.",
    "Do not provide a model answer, example response, translation of a full answer, or extra fields.",
    "Echo targetExpression, evidenceText, and communicativeFunction byte-for-byte from the supplied source object.",
    "Ground the task only in this source-derived expression and its documented function:",
    JSON.stringify(candidate),
  ].join("\n");
}

export function createActivationFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/activation-v1",
    async complete(_promptVersion, prompt) {
      const candidate = CandidateExpressionSchema.parse(JSON.parse(
        prompt.slice(prompt.lastIndexOf("\n") + 1),
      ));
      return {
        promptChinese: "朋友告诉你一件让人难以置信的事。你会怎么回应？",
        instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
        goalEnglish: "Use the target expression to react naturally to the situation.",
        targetExpression: candidate.expression,
        evidenceText: candidate.evidenceText,
        communicativeFunction: candidate.communicativeFunction,
      };
    },
  };
}
