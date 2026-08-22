import { createHash } from "node:crypto";

import type { MasteryState } from "@/contracts/memory";

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
};

function normalized(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, "").trim();
}

function fingerprint(parts: readonly string[]): string {
  const lengthPrefixed = parts.map((part) => `${Array.from(part).length}:${part}`).join("");
  return createHash("sha256").update(lengthPrefixed, "utf8").digest("hex");
}

const TRANSFER_SCENES = [
  { kind: "lunch", anchors: ["午餐", "食堂"] },
  { kind: "shopping", anchors: ["网购", "充电线"] },
  { kind: "ride", anchors: ["出行", "打车"] },
  { kind: "rain", anchors: ["下雨", "雨伞"] },
] as const;

type TransferSceneKind = typeof TRANSFER_SCENES[number]["kind"];

function sceneKind(promptChinese: string): TransferSceneKind | null {
  const prompt = normalized(promptChinese);
  return TRANSFER_SCENES.find((scene) => scene.anchors.every((anchor) => prompt.includes(anchor)))?.kind ?? null;
}

function transferContext(targetExpression: string, ordinal: number, kind: TransferSceneKind): string {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) throw new TypeError("transfer ordinal must be a non-negative integer");
  const amount = 200 + ordinal * 37;
  switch (kind) {
    case "lunch":
      return `午餐时，同事发现公司食堂一份普通套餐竟然要${amount}元。请用“${targetExpression}”自然回应。`;
    case "shopping":
      return `网购时，朋友发现一根普通充电线竟然标价${amount}元。请用“${targetExpression}”自然回应。`;
    case "ride":
      return `出行时，同学发现十分钟的普通打车行程竟然收费${amount}元。请用“${targetExpression}”自然回应。`;
    case "rain":
      return `下雨时，邻居发现租一把普通雨伞竟然要${amount}元。请用“${targetExpression}”自然回应。`;
  }
}

/** Builds a fixed, answer-free transfer context; it deliberately does not ask a Provider to supply an answer. */
export function buildDueTransferTask(source: DueTransferSource): DueTransferTask {
  if (!source.originalPromptChinese.trim()) throw new TypeError("transfer context must differ from the original context");
  const ordinal = source.transferOrdinal ?? 0;
  const usedScenes = new Set(
    [source.originalPromptChinese, ...(source.priorPromptChinese ?? [])]
      .map(sceneKind)
      .filter((kind): kind is TransferSceneKind => kind !== null),
  );
  const selectedScene = TRANSFER_SCENES.find((scene) => !usedScenes.has(scene.kind))
    ?? TRANSFER_SCENES[ordinal % TRANSFER_SCENES.length]!;
  const promptChinese = transferContext(source.targetExpression, ordinal, selectedScene.kind);
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
