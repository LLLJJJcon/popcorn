import type { MasteryState } from "@/contracts/memory";
import type { LearningCardFields } from "@/contracts/knowledge";
import type { PracticeSituation } from "@/contracts/practice";

export type DueTransferSource = {
  readonly id: string;
  readonly userId: string;
  readonly reviewTaskId: string;
  readonly userExpressionId: string;
  readonly targetExpression: string;
  readonly originalPromptChinese: string;
  readonly priorPromptChinese?: readonly string[];
  readonly dueAt: string;
  readonly masteryState: MasteryState;
  readonly transferOrdinal?: number;
};

export type DueTransferTask = Omit<DueTransferSource, "originalPromptChinese" | "priorPromptChinese" | "transferOrdinal"> & {
  readonly promptChinese: string;
  readonly instructionsEnglish: string;
  readonly goalEnglish: string;
  readonly contextFingerprint: string;
  readonly situation?: PracticeSituation;
  readonly learningCard?: LearningCardFields;
  readonly scenarioVersion?: number;
  readonly scenarioFingerprint?: string;
  readonly metadataMode?: "modern"|"legacy";
};
