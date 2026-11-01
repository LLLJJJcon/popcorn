import type { z } from "zod";
import { FunctionCategorySchema, UsageSettingSchema } from "@/contracts/knowledge";

export type FunctionCategory = z.infer<typeof FunctionCategorySchema>;
export type UsageSetting = z.infer<typeof UsageSettingSchema>;
export type TargetFunction = { readonly value: FunctionCategory; readonly label: string; readonly rule: string };
export type TargetSetting = { readonly value: UsageSetting; readonly label: string; readonly description: string };

/** Verbatim §8.3 input data, kept outside all system instructions. */
export const LEARNING_FUNCTIONS = {
  emphasize: { label: "Emphasize", rule: "Something is clearly beyond the usual degree and needs to be stressed." },
  complain: { label: "Complain", rule: "Something annoying, unfair or costly has happened and the speaker needs to express dissatisfaction." },
  praise: { label: "Praise", rule: "Someone or something deserves praise or approval." },
  react: { label: "React", rule: "Something surprising, unexpected or shocking has just happened and needs an immediate reaction." },
  explain_sum_up: { label: "Explain · Sum up", rule: "The other person has not understood, or a discussion needs to be summed up." },
  concede_contrast: { label: "Concede · Contrast", rule: "The speaker needs to accept one point the other person makes and then offer a different view." },
  suggest: { label: "Suggest", rule: "The other person needs advice or needs to be persuaded." },
  connect_ideas: { label: "Connect ideas", rule: "A short account needs a transition, a contrast or a follow-on point." },
  describe: { label: "Describe", rule: "A person, thing or event needs to be described." },
  other: { label: "Other", rule: "Use useItWhen to decide what the situation must require." },
} as const satisfies Record<FunctionCategory, Omit<TargetFunction, "value">>;

export const LEARNING_SETTINGS = {
  casual_chat: { label: "Casual chat", description: "Chatting with friends or family, or sending private messages." },
  daily_errands: { label: "Daily errands", description: "Talking with shop staff or service workers while shopping, eating out, taking a taxi or running errands." },
  work_school: { label: "Work & school", description: "Talking with colleagues, managers, teachers or classmates, including meetings and class." },
  formal_writing: { label: "Formal writing & speeches", description: "Writing formal emails, reports or notices, or giving a speech." },
  online_social: { label: "Online posts", description: "Writing posts, comments, group-chat messages or bullet comments." },
} as const satisfies Record<UsageSetting, Omit<TargetSetting, "value">>;

export function getTargetFunction(value: unknown): TargetFunction {
  const parsed = FunctionCategorySchema.safeParse(value);
  const resolved = parsed.success ? parsed.data : "other";
  return { value: resolved, ...LEARNING_FUNCTIONS[resolved] };
}

export function getTargetSetting(value: unknown): TargetSetting {
  const parsed = UsageSettingSchema.safeParse(value);
  const resolved = parsed.success ? parsed.data : "casual_chat";
  return { value: resolved, ...LEARNING_SETTINGS[resolved] };
}
