import type { AssistanceLevel } from "@/contracts/practice";
import type { WireNormalizer } from "@/server/ai/model-output";
import { framePrompt } from "./instruction-framing";
import type { TargetFunction, TargetSetting } from "./learning-intent-constants";
import { buildEvaluatePracticePrompt as buildLegacyPrompt, normalizePracticeEvaluationWire as normalizeLegacyWire, parsePracticeEvaluationOutput as parseLegacyOutput, createEvaluationFixtureGateway as legacyFixture, type PracticeEvaluationWire } from "./evaluate.v1";

export const EVALUATE_PRACTICE_PROMPT_VERSION = "evaluate-practice-v5";
export const EVALUATION_MAX_TOKENS = 700;
export const EVALUATION_TIMEOUT_MS = 30_000;
export type EvaluationInput = {
  readonly targetExpression: string;
  readonly targetMeaning: string;
  readonly situationZh: string;
  readonly interlocutor: string;
  readonly targetSetting: TargetSetting;
  readonly targetFunction: TargetFunction;
  readonly taskEn: string;
  readonly toneAndWho: string;
  readonly watchOut: string | null;
  readonly learnerResponse: string;
};

const OLD_SCOPE = "Use only targetExpression, promptChinese, and learnerResponse. Infer the target sense from the supplied situation; do not assume a hidden source sense, reference answer, speaker relationship, regional preference, or extra task requirement.";
const NEW_SCOPE = "Use targetExpression, targetMeaning, situationZh, interlocutor, targetSetting, targetFunction, taskEn and learnerResponse. The target sense is targetMeaning; using the expression in a different sense is a meaning error under Accuracy A2. The speaker relationship and setting are the ones given by interlocutor and targetSetting. toneAndWho and watchOut describe correct usage of the expression; use them only as reference when judging, never as extra requirements. Do not assume a reference answer, a regional preference or any requirement beyond taskEn.";
const CONTEXT_ACT = "Here the requested act is the one defined by targetFunction.rule, directed at the interlocutor, as stated in taskEn.";
const MINIMAL_REVISION = "The revision must change as little as possible from the learner's sentence. Omit naturalRevisionChinese when all three scores are 5.";
// Reuse the frozen v4 system text, applying only the three approved substitutions.
// User data stays isolated and the old builder/rubric remains unchanged.
const systemPrompt = buildLegacyPrompt({ targetExpression: "", promptChinese: "", learnerResponse: "" }).systemPrompt
  .replace(OLD_SCOPE, NEW_SCOPE)
  .replace("such as reacting, refusing, requesting, or reassuring?", `such as reacting, refusing, requesting, or reassuring? ${CONTEXT_ACT}`)
  .replace("and contain the target expression.", `and contain the target expression. ${MINIMAL_REVISION}`);

export function buildEvaluatePracticePrompt(input: EvaluationInput) {
  const data = {
    task: "evaluation", targetExpression: input.targetExpression, targetMeaning: input.targetMeaning,
    situationZh: input.situationZh, interlocutor: input.interlocutor,
    targetSetting: { value: input.targetSetting.value, label: input.targetSetting.label, description: input.targetSetting.description },
    targetFunction: { value: input.targetFunction.value, label: input.targetFunction.label, rule: input.targetFunction.rule },
    taskEn: input.taskEn, toneAndWho: input.toneAndWho, watchOut: input.watchOut, learnerResponse: input.learnerResponse,
  };
  return { systemPrompt, userPrompt: framePrompt("", data).userPrompt };
}

export const normalizePracticeEvaluationWire: WireNormalizer<PracticeEvaluationWire> = value => {
  const decoded = normalizeLegacyWire(value);
  if (!decoded.success) return decoded;
  if ([decoded.data.accuracy, decoded.data.naturalness, decoded.data.contextualFit].every(dimension => dimension.score === 5)) {
    return { success: true, data: { accuracy: decoded.data.accuracy, naturalness: decoded.data.naturalness, contextualFit: decoded.data.contextualFit } };
  }
  return decoded;
};

export function parsePracticeEvaluationOutput(value: unknown, targetExpression: string, assistanceLevel: AssistanceLevel) {
  const parsed = parseLegacyOutput(value, targetExpression, assistanceLevel);
  return [parsed.evaluation.accuracy, parsed.evaluation.naturalness, parsed.evaluation.contextualFit].every(dimension => dimension.score === 5)
    ? { ...parsed, coaching: null }
    : parsed;
}

/** Retains the existing fixture semantics; targetExpression is still top-level in v5. */
export const createEvaluationFixtureGateway = legacyFixture;
export type { PracticeEvaluationWire } from "./evaluate.v1";
