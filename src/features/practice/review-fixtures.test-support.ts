import type { Completion, DueReviewState, DueTransfer } from "@/contracts/review-practice";
import type { PracticeMaterialView } from "./material-schema";

/** Test-only transport fixtures; never imported by production code. */
export function reviewTransferFixture(reviewTaskId: string, material: PracticeMaterialView, scenarioVersion = 1): DueTransfer {
  const scenarioFingerprint = (scenarioVersion === 1 ? "a" : "b").repeat(64);
  const situation = material.task.situation;
  const reviewState: DueReviewState = { reviewTaskId, identity: { taskId: material.task.id, scenarioVersion, scenarioFingerprint }, regenerated: scenarioVersion > 1, canRegenerate: scenarioVersion === 1, expressionRevealedAt: null, examplesOpenedAt: null, firstAnswer: null, latestRevision: null };
  return { status: "ready", id: material.task.id, reviewTaskId, targetExpression: material.task.targetExpression, promptChinese: material.task.promptChinese, instructionsEnglish: material.task.instructionsEnglish, goalEnglish: material.task.goalEnglish, material, scenarioVersion, scenarioFingerprint, situationEn: situation?.situationEn ?? null, interlocutor: situation?.interlocutor ?? null, taskEn: situation?.taskEn ?? material.task.instructionsEnglish, targetFunction: situation?.targetFunction ?? null, targetSetting: situation?.targetSetting ?? null, transferType: situation ? "near" : null, metadataMode: situation ? "modern" : "legacy", scenarioSource: situation ? "model" : "legacy", canRegenerate: reviewState.canRegenerate, expressionRevealed: false, reviewState };
}

export function completedReviewFixture(transfer: DueTransfer, result: Completion, responseChinese: string): DueTransfer {
  const { evaluation, coaching, reviewState: _state, ...receipt } = result;
  void _state;
  return { ...transfer, canRegenerate: false, reviewState: { ...transfer.reviewState, canRegenerate: false, firstAnswer: { attemptId: result.attemptId, responseChinese, evaluation, coaching, naturalVersion: coaching?.naturalRevisionChinese ?? null, submittedAt: "2026-11-01T00:00:00.000Z", result: receipt } } };
}
