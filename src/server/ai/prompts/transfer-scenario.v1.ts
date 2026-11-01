import { z } from "zod";
import type { WireNormalizer } from "@/server/ai/model-output";
import { ModelGatewayError } from "@/server/ai/provider";
import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";
import type { StructuredJsonCompletionOptions, StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import type { TransferDirection } from "@/server/domain/transfer-target";
import { ActivationOutputSchema, createActivationWireNormalizer, type ActivationInput } from "./activate.v2";
import { framePrompt, readFixturePromptData } from "./instruction-framing";
import { getTargetSetting, type TargetFunction, type TargetSetting, type UsageSetting } from "./learning-intent-constants";

export const TRANSFER_SCENARIO_PROMPT_VERSION = "transfer-scenario-v1";
export const TRANSFER_SCENARIO_MAX_TOKENS = MODEL_OUTPUT_TOKENS.transferScenario;
export const TRANSFER_SCENARIO_TIMEOUT_MS = 20_000;
export const TRANSFER_SCENARIO_TASK_INSTRUCTION = "[Review situation] You write one review situation for an intermediate learner of Mandarin Chinese whose helper language is English. The learner learned the target expression earlier and is reviewing it after a gap. The expression is hidden at first, so the learner must recall it. The situation and task must make the intention clear without hinting at the wording.\n\nUse \"card\" to understand the meaning, intention, tone and suitable settings. Design the situation as follows:\n- It must make the target intention necessary, following targetFunction.rule.\n- It takes place in targetSetting (see targetSetting.description), with one concrete interlocutor who fits that setting. For formal_writing, the learner writes one sentence of a message or speech instead of speaking.\n- transferType \"near\": choose a new everyday topic that differs from every text in previousSituations.\n- transferType \"far\": choose a topic from a different area of life than every text in previousSituations, and an interlocutor whose relationship to the learner differs from those in previousSituations (for example a coworker instead of a friend).\n- situationZh: natural Simplified Chinese an intermediate learner can read, 1 to 3 short sentences, at most 120 characters, ending with what the interlocutor says or asks.\n- Never include the target expression, and never give wording that shows how to answer.\n- situationEn: a faithful English translation of situationZh, at most 60 words, also without the target expression.\n- interlocutor: in Chinese, at most 10 characters.\n- taskEn: one English instruction of at most 30 words saying what to do in the reply. Do not mention or translate the target expression.\n\nOutput exactly: {\"situationZh\":\"...\",\"situationEn\":\"...\",\"interlocutor\":\"...\",\"taskEn\":\"...\"}";
export const TransferScenarioOutputSchema = ActivationOutputSchema.strict();
export type TransferScenarioOutput = z.infer<typeof TransferScenarioOutputSchema>;
export type TransferScenarioInput = {
  readonly card: ActivationInput["card"];
  readonly targetFunction: TargetFunction;
  readonly targetSetting: TargetSetting;
  readonly transferType: TransferDirection;
  readonly previousSituations: readonly string[];
};
export type TransferScenarioValidationContext = { readonly targetExpression: string; readonly previousSituations: readonly string[] };

export function buildTransferScenarioPrompt(input: TransferScenarioInput) {
  return framePrompt(TRANSFER_SCENARIO_TASK_INSTRUCTION, {
    task: "review_situation",
    card: { expression: input.card.expression, meaningHere: input.card.meaningHere, useItWhen: input.card.useItWhen, toneAndWho: input.card.toneAndWho },
    targetFunction: { value: input.targetFunction.value, label: input.targetFunction.label, rule: input.targetFunction.rule },
    targetSetting: { value: input.targetSetting.value, label: input.targetSetting.label, description: input.targetSetting.description },
    transferType: input.transferType, previousSituations: input.previousSituations,
  });
}
export const normalizeTransferScenarioWire: WireNormalizer<TransferScenarioOutput> = value => {
  const decoded = TransferScenarioOutputSchema.safeParse(value);
  if (decoded.success) return { success: true, data: decoded.data };
  const fieldPath = decoded.error.issues[0]?.path.join(".");
  return { success: false, ...(fieldPath ? { fieldPath } : {}) };
};
export function createTransferScenarioWireNormalizer(context: TransferScenarioValidationContext): WireNormalizer<TransferScenarioOutput> {
  const existing = createActivationWireNormalizer({ targetExpression: context.targetExpression, avoidSituations: context.previousSituations });
  return value => {
    const strict = normalizeTransferScenarioWire(value);
    if (!strict.success) return strict;
    if (strict.data.interlocutor.includes(context.targetExpression)) return { success: false, fieldPath: "interlocutor" };
    return existing(strict.data);
  };
}
export function validateTransferScenarioOutput(value: unknown, context: TransferScenarioValidationContext): TransferScenarioOutput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
  const decoded = createTransferScenarioWireNormalizer(context)(value as Record<string, unknown>);
  if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding", decoded.fieldPath);
  return decoded.data;
}

const fixtureContext: Record<UsageSetting, { zh: string; en: string; interlocutor: string }> = {
  casual_chat: { zh: "你和朋友进行复习模拟", en: "You are in a review simulation with a friend", interlocutor: "朋友" },
  daily_errands: { zh: "你和店员进行复习模拟", en: "You are in a review simulation with a shop assistant", interlocutor: "店员" },
  work_school: { zh: "你和同事进行复习模拟", en: "You are in a review simulation with a coworker", interlocutor: "同事" },
  formal_writing: { zh: "你给读者写一封模拟邮件", en: "You are writing a simulated email to a reader", interlocutor: "读者" },
  online_social: { zh: "你和群友进行复习模拟", en: "You are in a review simulation with a group member", interlocutor: "群友" },
};
const FixtureInputSchema = z.object({ card: z.object({ expression: z.string().min(1) }), targetSetting: z.object({ value: z.string() }), transferType: z.enum(["near", "far"]), previousSituations: z.array(z.string()) });
/** Synthetic deterministic CI identities only; never a runtime fallback or semantic quality evidence. */
export function createTransferScenarioFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/transfer-scenario-v1",
    async complete<T>(_version: string, userPrompt: string, options: StructuredJsonCompletionOptions<T>): Promise<T> {
      const decoded = FixtureInputSchema.safeParse(readFixturePromptData(userPrompt));
      if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
      const input = decoded.data;
      const setting = fixtureContext[getTargetSetting(input.targetSetting.value).value];
      const normalize = createTransferScenarioWireNormalizer({ targetExpression: input.card.expression, previousSituations: input.previousSituations });
      // N historical situations can occupy at most N of these N+1 test identities.
      for (let identity = 1; identity <= input.previousSituations.length + 1; identity++) {
        const output = { situationZh: `${setting.zh}，这是第${identity}次测试。对方问：“这次交流你有什么想法？”`, situationEn: `${setting.en}, test number ${identity}. The other person asks, “What are your thoughts on this exchange?”`, interlocutor: setting.interlocutor, taskEn: "Give your response for this simulated review exchange." };
        if (!normalize(output).success) continue;
        const result = options.normalize(output);
        if (!result.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", result.fieldPath);
        return result.data;
      }
      throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding", "situationZh");
    },
  };
}
