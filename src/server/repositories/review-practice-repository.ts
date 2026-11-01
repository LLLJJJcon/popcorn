import type { LearningCardFields } from "@/contracts/knowledge";
import type { MasteryState } from "@/contracts/memory";
import type { DueTransfer, ReviewMutationInput, ReviewRevisionInput, ReviewMarkerResponse, ReviewRevisionResponse } from "@/contracts/review-practice";
import type { PracticeCoaching, EvaluationResult } from "@/contracts/practice";
import type { ModelGatewayPin } from "@/server/ai/provider";
import type { PracticeErrorCode } from "@/server/domain/create-practice-task";
import type { TransferDirection } from "@/server/domain/transfer-target";
import type { TransferScenarioOutput } from "@/server/ai/prompts/transfer-scenario.v1";
import type { TargetFunction, TargetSetting } from "@/server/ai/prompts/learning-intent-constants";

export type ReviewContext = {
  userId: string; reviewTaskId: string; userExpressionId: string; sourceId: string;
  status: "pending" | "completed" | "cancelled"; dueAt: string; masteryState: MasteryState;
  targetExpression: string; card: LearningCardFields | null; prepared: DueTransfer | null;
  history: string[]; lastTransferType: TransferDirection | null;
};
export type ReviewPreparationClaim =
  | { kind: "claimed"; requestId: string; token: string; expectedVersion: number; leaseExpiresAt: string }
  | { kind: "pending"; requestId: string }
  | { kind: "ready"; prepared: DueTransfer }
  | { kind: "failed"; requestId: string; code: PracticeErrorCode };
export type ReviewJobFence = { jobId: string; attemptCount: number; leaseExpiresAt: string };
export type ReviewPreparationOptions = { identity?: ReviewMutationInput; job?: ReviewJobFence };
export type ReviewGeneratedScenario = {
  scenario: TransferScenarioOutput; targetFunction: TargetFunction; targetSetting: TargetSetting;
  transferType: TransferDirection; promptVersion: string; model: string; pin: ModelGatewayPin | null;
};
export interface ReviewPracticeRepository {
  read(userId: string, reviewTaskId: string): Promise<ReviewContext | null>;
  resolveActiveGatewayPin(userId: string): Promise<ModelGatewayPin | null>;
  lookupPreparation(userId: string, reviewTaskId: string, kind: "prepare" | "regenerate", requestId: string | null, options: ReviewPreparationOptions, now: string): Promise<Exclude<ReviewPreparationClaim,{kind:"claimed"}> | null>;
  claim(userId: string, reviewTaskId: string, kind: "prepare" | "regenerate", requestId: string | null, options: ReviewPreparationOptions, now: string): Promise<ReviewPreparationClaim>;
  publish(userId: string, reviewTaskId: string, claim: Extract<ReviewPreparationClaim, {kind:"claimed"}>, generated: ReviewGeneratedScenario, now: string): Promise<DueTransfer>;
  fail(userId: string, reviewTaskId: string, claim: Extract<ReviewPreparationClaim, {kind:"claimed"}>, code: PracticeErrorCode, now: string): Promise<boolean>;
  mark(userId: string, reviewTaskId: string, kind: "reveal" | "examples", input: ReviewMutationInput, now: string): Promise<ReviewMarkerResponse>;
  lookupRevision(userId: string, reviewTaskId: string, input: ReviewRevisionInput): Promise<{kind:"ready";response:ReviewRevisionResponse}|{kind:"pending"}|{kind:"failed";code:PracticeErrorCode}|null>;
  claimRevision(userId: string, reviewTaskId: string, input: ReviewRevisionInput, now: string): Promise<{kind:"claimed";token:string}|{kind:"ready";response:ReviewRevisionResponse}|{kind:"pending"}>;
  publishRevision(userId: string, reviewTaskId: string, input: ReviewRevisionInput, token: string, result: {evaluation:EvaluationResult;coaching:PracticeCoaching|null;model:string;pin:ModelGatewayPin|null;promptVersion:string}, now: string): Promise<ReviewRevisionResponse>;
  failRevision(userId: string, reviewTaskId: string, requestId: string, token: string, code: PracticeErrorCode, now: string): Promise<boolean>;
}
