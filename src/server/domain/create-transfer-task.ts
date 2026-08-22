import { createHash } from "node:crypto";

import type { MasteryState } from "@/contracts/memory";

export type DueTransferSource = {
  readonly id: string;
  readonly userId: string;
  readonly reviewTaskId: string;
  readonly userExpressionId: string;
  readonly targetExpression: string;
  readonly originalPromptChinese: string;
  readonly dueAt: string;
  readonly masteryState: MasteryState;
  readonly transferOrdinal?: number;
};

export type DueTransferTask = Omit<DueTransferSource, "originalPromptChinese" | "transferOrdinal"> & {
  readonly promptChinese: string;
  readonly instructionsEnglish: string;
  readonly goalEnglish: string;
  readonly contextFingerprint: string;
};

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").trim();
}

function fingerprint(parts: readonly string[]): string {
  const lengthPrefixed = parts.map((part) => `${Array.from(part).length}:${part}`).join("");
  return createHash("sha256").update(lengthPrefixed, "utf8").digest("hex");
}

function transferContext(targetExpression: string, ordinal: number, variantOffset = 0): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) throw new TypeError("transfer ordinal must be a non-negative integer");
  const variant = (ordinal + variantOffset) % 4;
  const amount = 200 + ordinal * 37;
  switch (variant) {
    case 0:
      return `午餐时，同事发现公司食堂一份普通套餐竟然要${amount}元。请用“${targetExpression}”自然回应。`;
    case 1:
      return `网购时，朋友发现一根普通充电线竟然标价${amount}元。请用“${targetExpression}”自然回应。`;
    case 2:
      return `出行时，同学发现十分钟的普通打车行程竟然收费${amount}元。请用“${targetExpression}”自然回应。`;
    default:
      return `下雨时，邻居发现租一把普通雨伞竟然要${amount}元。请用“${targetExpression}”自然回应。`;
  }
}

/** Builds a fixed, answer-free transfer context; it deliberately does not ask a Provider to supply an answer. */
export function buildDueTransferTask(source: DueTransferSource): DueTransferTask {
  if (!source.originalPromptChinese.trim()) throw new TypeError("transfer context must differ from the original context");
  const ordinal = source.transferOrdinal ?? 0;
  const firstChoice = transferContext(source.targetExpression, ordinal);
  const promptChinese = normalized(firstChoice) === normalized(source.originalPromptChinese)
    ? transferContext(source.targetExpression, ordinal, 1)
    : firstChoice;
  const instructionsEnglish = "Reply with one natural Simplified Chinese sentence. Do not copy a model answer.";
  const goalEnglish = "Use the target expression in a new everyday context without receiving a complete answer.";
  return {
    id: source.id,
    userId: source.userId,
    reviewTaskId: source.reviewTaskId,
    userExpressionId: source.userExpressionId,
    targetExpression: source.targetExpression,
    dueAt: source.dueAt,
    masteryState: source.masteryState,
    promptChinese,
    instructionsEnglish,
    goalEnglish,
    contextFingerprint: fingerprint([source.targetExpression, promptChinese, instructionsEnglish, goalEnglish]),
  };
}
