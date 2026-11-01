import { MasteryStateSchema, type MasteryState } from "@/contracts/memory";
import { FunctionCategorySchema, UsageSettingSchema } from "@/contracts/knowledge";
import { getTargetFunction, getTargetSetting, type FunctionCategory, type UsageSetting, type TargetFunction, type TargetSetting } from "@/server/ai/prompts/learning-intent-constants";

export type TransferDirection = "near" | "far";
export type TransferTargetInput = {
  readonly masteryState: MasteryState;
  readonly functionCategories: readonly FunctionCategory[];
  readonly usageSettings: readonly UsageSetting[];
  readonly lastTransferType?: TransferDirection | null;
};

/** Only call with a modern learning card. Legacy metadata must be resolved by the caller. */
export function selectTransferTarget(input: TransferTargetInput): { transferType: TransferDirection; targetFunction: TargetFunction; targetSetting: TargetSetting } {
  const mastery = MasteryStateSchema.parse(input.masteryState);
  if (input.functionCategories.length === 0) throw new TypeError("Review requires a modern intention");
  const functions = input.functionCategories.map(value => FunctionCategorySchema.parse(value));
  const settings = input.usageSettings.map(value => UsageSettingSchema.parse(value));
  if (input.lastTransferType != null && input.lastTransferType !== "near" && input.lastTransferType !== "far") throw new TypeError("Invalid previous transfer direction");
  const transferType: TransferDirection = mastery === "tried" ? "near" : mastery === "reused" ? "far" : input.lastTransferType === "near" ? "far" : "near";
  const primary = functions[0];
  const firstSetting = settings[0] ?? "casual_chat";
  return {
    transferType,
    targetFunction: getTargetFunction(transferType === "far" ? functions[1] ?? primary : primary),
    targetSetting: getTargetSetting(transferType === "far" ? settings.find(value => value !== firstSetting) ?? firstSetting : firstSetting),
  };
}
