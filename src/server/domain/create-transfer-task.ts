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
};

export type DueTransferTask = Omit<DueTransferSource, "originalPromptChinese"> & {
  readonly promptChinese: string;
  readonly instructionsEnglish: string;
  readonly goalEnglish: string;
  readonly contextFingerprint: string;
};

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").trim();
}

function fingerprint(parts: readonly string[]): string {
  return createHash("sha256").update(parts.join("\u0000"), "utf8").digest("hex");
}

/** Builds a fixed, answer-free transfer context; it deliberately does not ask a Provider to supply an answer. */
export function buildDueTransferTask(source: DueTransferSource): DueTransferTask {
  const promptChinese = `同事说一件很普通的事情竟然要花很多钱。请用“${source.targetExpression}”自然回应。`;
  if (!source.originalPromptChinese.trim() || normalized(promptChinese) === normalized(source.originalPromptChinese)) {
    throw new TypeError("transfer context must differ from the original context");
  }
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
