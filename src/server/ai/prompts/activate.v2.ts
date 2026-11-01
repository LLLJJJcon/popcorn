import { createHash } from "node:crypto";
import { z } from "zod";
import { TargetChineseTextSchema } from "@/contracts/source";
import type { WireNormalizer } from "@/server/ai/model-output";
import { ModelGatewayError } from "@/server/ai/provider";
import type { StructuredJsonCompletionOptions, StructuredJsonGateway } from "@/server/ai/structured-json-gateway";
import { framePrompt, readFixturePromptData } from "./instruction-framing";
import { getTargetFunction, getTargetSetting, type TargetFunction, type TargetSetting, type FunctionCategory, type UsageSetting } from "./learning-intent-constants";

export const ACTIVATE_PRACTICE_PROMPT_VERSION = "activate-practice-v3";
export const ACTIVATION_MAX_TOKENS = 400;
export const ACTIVATION_TIMEOUT_MS = 20_000;
export const ACTIVATION_TASK_INSTRUCTION = "[First practice situation] You write one practice situation for an intermediate learner of Mandarin Chinese whose helper language is English. The learner will reply in Chinese and should naturally need the target expression to do so. The learner can see the target expression and its meaning; the situation itself must not contain it.\n\nUse \"card\" to understand the meaning, intention, tone and suitable settings. Design the situation as follows:\n- It must make the target intention necessary: following targetFunction.rule, there must be something to emphasize, complain about, praise, react to, explain, concede, suggest, connect or describe.\n- It takes place in targetSetting (see targetSetting.description), with one concrete interlocutor who fits that setting, such as a friend, a coworker or a shop assistant. For formal_writing, the learner writes one sentence of a message or speech instead of speaking.\n- Choose an everyday topic that differs from sourceLine and from every text in avoidSituations.\n- situationZh: natural Simplified Chinese an intermediate learner can read, 1 to 3 short sentences, at most 120 characters. Describe what is happening and end with what the interlocutor says or asks, so the learner has something to reply to.\n- Never include the target expression, and never give wording that shows how to answer.\n- situationEn: a faithful English translation of situationZh, at most 60 words, also without the target expression.\n- interlocutor: who the learner is talking to, in Chinese, at most 10 characters (for example 同事).\n- taskEn: one English instruction of at most 30 words saying what to do in the reply, for example \"Reply to your coworker and complain about how expensive the lunch is.\" Do not mention or translate the target expression.\n\nOutput exactly: {\"situationZh\":\"...\",\"situationEn\":\"...\",\"interlocutor\":\"...\",\"taskEn\":\"...\"}";

const englishWords = (text: string) => text.trim().split(/\s+/u).length;
const EnglishScenarioTextSchema = z.string().trim().min(1).refine(text => /[A-Za-z]/u.test(text), "Expected English prose");
export const ActivationOutputSchema = z.object({
  situationZh: TargetChineseTextSchema.refine(text => [...text].length <= 120, "At most 120 characters"),
  situationEn: EnglishScenarioTextSchema.refine(text => englishWords(text) <= 60, "At most 60 words"),
  interlocutor: TargetChineseTextSchema.refine(text => [...text].length <= 10, "At most 10 characters"),
  taskEn: EnglishScenarioTextSchema.refine(text => englishWords(text) <= 30, "At most 30 words"),
});
export type ActivationOutput = z.infer<typeof ActivationOutputSchema>;
export type ActivationInput = {
  readonly card: { readonly expression: string; readonly meaningHere: string; readonly useItWhen: string; readonly toneAndWho: string };
  readonly targetFunction: TargetFunction;
  readonly targetSetting: TargetSetting;
  readonly sourceLine: string;
  readonly avoidSituations: readonly string[];
};
export type ActivationValidationContext = { readonly targetExpression: string; readonly avoidSituations: readonly string[] };

export function buildActivatePracticePrompt(input: ActivationInput) {
  // Project explicitly: card examples and other source fields never cross this boundary.
  return framePrompt(ACTIVATION_TASK_INSTRUCTION, {
    task: "first_practice_situation",
    card: { expression: input.card.expression, meaningHere: input.card.meaningHere, useItWhen: input.card.useItWhen, toneAndWho: input.card.toneAndWho },
    targetFunction: { value: input.targetFunction.value, label: input.targetFunction.label, rule: input.targetFunction.rule },
    targetSetting: { value: input.targetSetting.value, label: input.targetSetting.label, description: input.targetSetting.description },
    sourceLine: input.sourceLine, avoidSituations: input.avoidSituations,
  });
}

export const normalizeActivationWire: WireNormalizer<ActivationOutput> = value => {
  const parsed = ActivationOutputSchema.safeParse(value);
  if (parsed.success) return { success: true, data: parsed.data };
  const fieldPath = parsed.error.issues[0]?.path.join(".");
  return { success: false, ...(fieldPath ? { fieldPath } : {}) };
};

/** Scenario dedup only. Never substitute for the historical mastery-context hash. */
export function scenarioFingerprint(situationZh: string): string {
  const canonical = situationZh.normalize("NFKC").replace(/[\p{P}\p{Z}\s]+/gu, "").toLowerCase();
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function createActivationWireNormalizer(context: ActivationValidationContext): WireNormalizer<ActivationOutput> {
  const avoided = new Set(context.avoidSituations.map(scenarioFingerprint));
  return value => {
    const decoded = normalizeActivationWire(value);
    if (!decoded.success) return decoded;
    for (const field of ["situationZh", "situationEn", "taskEn"] as const) {
      if (decoded.data[field].includes(context.targetExpression)) return { success: false, fieldPath: field };
    }
    if (avoided.has(scenarioFingerprint(decoded.data.situationZh))) return { success: false, fieldPath: "situationZh" };
    return decoded;
  };
}

export function validateActivationOutput(value: unknown, context: ActivationValidationContext): ActivationOutput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
  const decoded = createActivationWireNormalizer(context)(value as Record<string, unknown>);
  if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding", decoded.fieldPath);
  return decoded.data;
}

// Synthetic CI exchanges exercise shape, persistence and round identity only.
// They are never a live generation fallback or evidence of expression/meaning fit.
// The user withdrew §8.7's generic product templates; none are imported here.
const FIXTURE_SETTING_CONTEXT: Record<UsageSetting, { zh: string; en: string; interlocutor: string }> = {
  casual_chat: { zh: "你和朋友聊天", en: "You are chatting with a friend", interlocutor: "朋友" },
  daily_errands: { zh: "你在商店和店员说话", en: "You are talking with a shop assistant", interlocutor: "店员" },
  work_school: { zh: "你在办公室和同事交谈", en: "You are talking with a coworker at the office", interlocutor: "同事" },
  formal_writing: { zh: "你正在给一位读者写邮件", en: "You are writing an email to a reader", interlocutor: "读者" },
  online_social: { zh: "你在群里和群友交流", en: "You are exchanging messages with someone in a group chat", interlocutor: "群友" },
};
const FIXTURE_ACT: Record<FunctionCategory, string> = {
  emphasize: "Emphasize your main point in this test reply.",
  complain: "Express dissatisfaction in this test reply.",
  praise: "Express praise in this test reply.",
  react: "React to the news in this test reply.",
  explain_sum_up: "Sum up your main point in this test reply.",
  concede_contrast: "Acknowledge one point and offer a different view in this test reply.",
  suggest: "Offer a suggestion in this test reply.",
  connect_ideas: "Connect your points in this test reply.",
  describe: "Give a description in this test reply.",
  other: "Respond in this test exchange.",
};
const FixtureInputSchema = z.object({
  card: z.object({ expression: z.string().min(1) }),
  targetFunction: z.object({ value: z.string() }),
  targetSetting: z.object({ value: z.string() }),
  avoidSituations: z.array(z.string()),
});

/** Deterministic test provider, selected only by the existing CI fixture mode. */
export function createActivationFixtureGateway(): StructuredJsonGateway {
  return {
    model: "fixture/activation-v3",
    async complete<T>(_version: string, userPrompt: string, options: StructuredJsonCompletionOptions<T>): Promise<T> {
      const parsed = FixtureInputSchema.safeParse(readFixturePromptData(userPrompt));
      if (!parsed.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema");
      const input = parsed.data;
      const setting = FIXTURE_SETTING_CONTEXT[getTargetSetting(input.targetSetting.value).value];
      const intent = getTargetFunction(input.targetFunction.value).value;
      const context = { targetExpression: input.card.expression, avoidSituations: input.avoidSituations };
      const normalize = createActivationWireNormalizer(context);
      // At most N supplied scenes can occupy these N+1 unique test identities.
      // This scales with test input and imposes no fixed product round ceiling.
      for (let sequence = 1; sequence <= input.avoidSituations.length + 1; sequence += 1) {
        const output: ActivationOutput = {
          situationZh: `${setting.zh}，这是第${sequence}次模拟交流。对方问：“这件事你怎么看？”`,
          situationEn: `${setting.en} in test exchange ${sequence}. The other person asks, “What do you think about this?”`,
          interlocutor: setting.interlocutor,
          taskEn: FIXTURE_ACT[intent],
        };
        if (!normalize(output).success) continue;
        const decoded = options.normalize(output);
        if (!decoded.success) throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "wire_schema", decoded.fieldPath);
        return decoded.data;
      }
      throw new ModelGatewayError("PROVIDER_OUTPUT_INVALID", "grounding", "situationZh");
    },
  };
}
