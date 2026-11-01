import { z } from "zod";
import { LearningCardFieldsSchema,type LearningCardFields } from "@/contracts/knowledge";
import type { ModelGatewayPin } from "@/server/ai/provider";
import type { StructuredJsonGateway,StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";

export const LEGACY_LEARNING_CARD_UPGRADE_VERSION="learning-card-upgrade-v1" as const;
const Id=z.string().uuid(),Hash=z.string().regex(/^[a-f0-9]{64}$/),Instant=z.string().datetime({offset:true});
export const LegacyUpgradeSourceRefSchema=z.discriminatedUnion("kind",[
 z.strictObject({kind:z.literal("existing_card"),candidateKey:z.string().min(1).max(400),artifactId:Id,candidateIndex:z.number().int().nonnegative()}),
 z.strictObject({kind:z.literal("source_occurrence"),sourceId:Id,occurrenceId:Id,snapshotId:Id}),
]);
export const LegacyUpgradeTargetSchema=z.strictObject({senseId:Id,expectedBeforeHash:Hash,expectedEvidenceHash:Hash,source:LegacyUpgradeSourceRefSchema});
export const LegacyUpgradeRequestSchema=LegacyUpgradeTargetSchema.extend({requestId:Id});
export const LegacyUpgradePageInputSchema=z.strictObject({afterSenseId:Id.optional(),limit:z.number().int().min(1).max(200).default(200)});
export const LegacyUpgradeManifestSchema=z.strictObject({version:z.literal(LEGACY_LEARNING_CARD_UPGRADE_VERSION),ownerId:Id,createdAt:Instant,requests:z.array(LegacyUpgradeRequestSchema)})
 .refine(value=>new Set(value.requests.map(item=>item.senseId)).size===value.requests.length,{message:"One operation per sense"})
 .refine(value=>new Set(value.requests.map(item=>item.requestId)).size===value.requests.length,{message:"Request IDs must be unique"});
export const LegacyUpgradeReasonSchema=z.enum(["PARTIAL_METADATA","CARD_CONFLICT","SOURCE_UNAVAILABLE","SOURCE_AMBIGUOUS","EVIDENCE_MISMATCH","NOT_EXPRESSION"]);
export const LegacyUpgradeErrorCodeSchema=z.enum(["VALIDATION_FAILED","NOT_FOUND","IDEMPOTENCY_CONFLICT","REQUEST_IN_PROGRESS","STALE_PLAN","GATEWAY_REQUIRED","GATEWAY_CHANGED","LEASE_EXPIRED","PROVIDER_OUTPUT_INVALID","PROVIDER_UNAVAILABLE","PROVIDER_RATE_LIMITED","INTERNAL_ERROR"]);
export type LegacyUpgradeErrorCode=z.infer<typeof LegacyUpgradeErrorCodeSchema>;
export class LegacyUpgradeError extends Error {
 constructor(readonly code:LegacyUpgradeErrorCode,readonly retryable=false){super(code);this.name="LegacyUpgradeError";}
}
const outcomeIdentity={requestId:Id,senseId:Id};
const ExpressionCard=LearningCardFieldsSchema.refine(card=>card.suitability==="expression",{message:"Only expression cards may update canonical metadata"});
export const LegacyUpgradeOutcomeSchema=z.discriminatedUnion("status",[
 z.strictObject({...outcomeIdentity,status:z.literal("applied"),origin:z.enum(["existing_card","model"]),card:ExpressionCard}),
 z.strictObject({...outcomeIdentity,status:z.literal("already_modern")}),
 z.strictObject({...outcomeIdentity,status:z.literal("needs_review"),reason:LegacyUpgradeReasonSchema,card:LearningCardFieldsSchema.optional()}),
 z.strictObject({...outcomeIdentity,status:z.literal("blocked"),reason:LegacyUpgradeReasonSchema}),
 z.strictObject({...outcomeIdentity,status:z.literal("failed"),code:LegacyUpgradeErrorCodeSchema}),
 z.strictObject({...outcomeIdentity,status:z.literal("in_progress"),retryAfterMs:z.number().int().positive()}),
]).refine(outcome=>outcome.status!=="needs_review"||outcome.reason!=="NOT_EXPRESSION"||outcome.card?.suitability==="not_expression",{message:"Retain the full not_expression card in its private outcome"});
export const LegacyUpgradeSourceCandidateSchema=z.strictObject({
 sourceId:Id,snapshotId:Id,occurrenceId:Id,savedItemId:Id.nullable(),transcriptHash:Hash,evidenceHash:Hash,
 evidenceText:z.string().min(1),segmentIds:z.array(z.string().min(1)).min(1),startSeconds:z.number().nonnegative(),endSeconds:z.number().nonnegative(),createdAt:Instant,
 segments:z.array(z.strictObject({stableId:z.string().min(1),position:z.number().int().nonnegative(),text:z.string().min(1),startSeconds:z.number().nonnegative(),endSeconds:z.number().nonnegative(),target:z.boolean()})),
});
export type LegacyUpgradeRequest=z.infer<typeof LegacyUpgradeRequestSchema>;
export type LegacyUpgradeTarget=z.infer<typeof LegacyUpgradeTargetSchema>;
export type LegacyUpgradePageInput=z.infer<typeof LegacyUpgradePageInputSchema>;
export type LegacyUpgradeManifest=z.infer<typeof LegacyUpgradeManifestSchema>;
export type LegacyUpgradeOutcome=z.infer<typeof LegacyUpgradeOutcomeSchema>;
export type LegacyUpgradeReason=z.infer<typeof LegacyUpgradeReasonSchema>;
export type LegacyUpgradeSourceCandidate=z.infer<typeof LegacyUpgradeSourceCandidateSchema>;
/** Hashes below are opaque values produced by PostgreSQL, never JS JSON hashes. */
export type LegacyUpgradeContext={
 ownerId:string;senseId:string;userExpressionId:string;expression:string;originalSavedItemId:string|null;
 beforeHash:string;canonicalCard:LearningCardFields|null;modernFieldsEmpty:boolean;
 sourceState:"retained"|"deleted"|"missing";
 existingCard:{card:LearningCardFields;candidateKey:string;artifactId:string;candidateIndex:number;evidenceHash:string}|null;
 sources:LegacyUpgradeSourceCandidate[];
};
export type LegacyUpgradePlanRow=
 |{status:"already_modern";senseId:string}
 |{status:"eligible";senseId:string;target:LegacyUpgradeTarget}
 |{status:"blocked";senseId:string;reason:LegacyUpgradeReason};
export type LegacyUpgradePlanPage={items:LegacyUpgradePlanRow[];nextCursor:string|null};
export type LegacyUpgradePublication=
 |{origin:"existing_card";card:LearningCardFields}
 |{origin:"model";card:LearningCardFields;promptVersion:"analyze-saved-item-v3";model:string;pin:ModelGatewayPin|null};
export type LegacyUpgradeClaim=
 |{kind:"claimed";token:string;leaseExpiresAt:string}
 |{kind:"outcome";outcome:LegacyUpgradeOutcome};
export interface LegacyLearningCardUpgradeRepository {
 pageContexts(ownerId:string,input:LegacyUpgradePageInput):Promise<{items:LegacyUpgradeContext[];nextCursor:string|null}>;
 readContext(ownerId:string,senseId:string):Promise<LegacyUpgradeContext|null>;
 resolveActiveGatewayPin(ownerId:string):Promise<ModelGatewayPin|null>;
 lookup(ownerId:string,input:LegacyUpgradeRequest,now:string):Promise<LegacyUpgradeOutcome|null>;
 claim(ownerId:string,input:LegacyUpgradeRequest,pin:ModelGatewayPin|null,now:string):Promise<LegacyUpgradeClaim>;
 publish(ownerId:string,input:LegacyUpgradeRequest,token:string,result:LegacyUpgradePublication,now:string):Promise<LegacyUpgradeOutcome>;
 fail(ownerId:string,input:LegacyUpgradeRequest,token:string,code:LegacyUpgradeErrorCode,now:string):Promise<boolean>;
}
export type LegacyLearningCardUpgradeDependencies={repository:LegacyLearningCardUpgradeRepository;gatewayResolver:StructuredJsonGatewayResolver;fixtureGateway:StructuredJsonGateway;ci:boolean;now:()=>string};
