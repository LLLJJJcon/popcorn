import type { LearningCardFields } from "@/contracts/knowledge";
import type { MasteryState } from "@/contracts/memory";
import type { DueTransfer, DueReviewState, Completion, ReviewCompletionInput, ReviewMutationInput, ReviewRevisionInput, ReviewMarkerResponse, ReviewRevisionResponse } from "@/contracts/review-practice";
import type { PracticeCoaching, EvaluationResult } from "@/contracts/practice";
import type { ModelGatewayPin } from "@/server/ai/provider";
import type { PracticeErrorCode } from "@/server/domain/create-practice-task";
import type { TransferDirection } from "@/server/domain/transfer-target";
import type { TransferScenarioOutput } from "@/server/ai/prompts/transfer-scenario.v1";
import type { TargetFunction, TargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import { EvaluationResultSchema,PracticeCoachingSchema } from "@/contracts/practice";
import { DueCompletionReceiptSchema,DueReviewStateSchema,DueTransferSchema,ReviewRevisionSchema } from "@/contracts/review-practice";
import { createPracticeMaterialRepository,type PracticeMaterialRepository } from "./practice-material-repository";
import { practiceSituationFingerprint } from "@/server/domain/practice-rounds";
import { PracticeError } from "@/server/domain/create-practice-task";
import type { Database } from "@/types/database.generated";
import { readableEvaluationProvenance,legalHistoricalTransition,validateRpcResult } from "@/server/domain/complete-due-practice";

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
export type OfficialReviewCompletion = Completion & {reviewState:DueReviewState};
export type ReviewScoredOutput = {evaluation:EvaluationResult;coaching:PracticeCoaching|null;model:string;pin:ModelGatewayPin|null;promptVersion:string};
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
  completionState(userId:string,reviewTaskId:string):Promise<DueReviewState|null>;
  lookupCompletion(userId:string,reviewTaskId:string,input:ReviewCompletionInput):Promise<{kind:"ready";response:OfficialReviewCompletion}|{kind:"pending"}|{kind:"failed";code:PracticeErrorCode}|null>;
  claimCompletion(userId:string,reviewTaskId:string,input:ReviewCompletionInput,now:string):Promise<{kind:"claimed";token:string}|{kind:"ready";response:OfficialReviewCompletion}|{kind:"pending"}>;
  publishCompletion(userId:string,reviewTaskId:string,input:ReviewCompletionInput,token:string,result:ReviewScoredOutput & {submittedAt:string},now:string):Promise<OfficialReviewCompletion>;
  failCompletion(userId:string,reviewTaskId:string,requestId:string,token:string,code:PracticeErrorCode,now:string):Promise<boolean>;
}

type Row=Record<string,unknown>;
const record=(value:unknown):Row|null=>typeof value==="object"&&value!==null&&!Array.isArray(value)?value as Row:null;
const string=(row:Row,key:string)=>z.string().parse(row[key]);
const nullableString=(row:Row,key:string)=>row[key]==null?null:z.string().parse(row[key]);
function cardFields(value:unknown):LearningCardFields|null{
 const row=record(value);if(!row)return null;
 const fields=Object.fromEntries(["meaningHere","useItWhen","comparedWith","howItFits","toneAndWho","watchOut","examples","functionCategories","usageSettings","suitability","notExpressionReasonEn"].filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
 const parsed=LearningCardFieldsSchema.safeParse(fields);return parsed.success?parsed.data:null;
}
function revisionView(row:Row){return ReviewRevisionSchema.parse({id:row.id,requestId:row.request_id,attemptId:row.attempt_id,taskId:row.practice_task_id,scenarioVersion:row.scenario_version,scenarioFingerprint:row.scenario_fingerprint,responseChinese:row.response_chinese,evaluation:row.evaluation,coaching:row.coaching??null,naturalVersion:record(row.coaching)?.naturalRevisionChinese??null,createdAt:row.created_at});}
function officialAnswer(review:Row,task:Row,attempt:Row|null,receipt:Row|null,userId:string,expressionId:string,events:unknown,currentMastery:unknown){
 if(review.status!=="completed")return null;
 if(!attempt||!receipt||attempt.user_id!==userId||receipt.user_id!==userId||attempt.user_expression_id!==expressionId||receipt.user_expression_id!==expressionId||receipt.review_task_id!==review.id||attempt.practice_task_id!==task.id||receipt.practice_task_id!==task.id||attempt.id!==review.completed_attempt_id||receipt.attempt_id!==attempt.id||receipt.prior_state!==review.mastery_state||Date.parse(string(attempt,"submitted_at"))!==Date.parse(string(review,"completed_at")))throw new PracticeError("NOT_FOUND");
 if(attempt.review_scenario_version!=null&&(attempt.review_scenario_version!==task.scenario_version||attempt.review_scenario_fingerprint!==task.scenario_fingerprint))throw new PracticeError("NOT_FOUND");
 try{
  if(!["evaluation_prompt_version","evaluation_model","evaluation_gateway_config_id","evaluation_gateway_revision","evaluation_gateway_fingerprint"].every(key=>Object.hasOwn(attempt,key)))throw new Error("Missing recorded provenance");
  const provenance={evaluationPromptVersion:nullableString(attempt,"evaluation_prompt_version"),evaluationModel:nullableString(attempt,"evaluation_model"),evaluationGatewayConfigId:attempt.evaluation_gateway_config_id==null?null:z.string().uuid().parse(attempt.evaluation_gateway_config_id),evaluationGatewayRevision:attempt.evaluation_gateway_revision==null?null:z.number().int().parse(attempt.evaluation_gateway_revision),evaluationGatewayFingerprint:attempt.evaluation_gateway_fingerprint==null?null:z.string().regex(/^[a-f0-9]{64}$/).parse(attempt.evaluation_gateway_fingerprint)};
  if(!readableEvaluationProvenance(provenance))throw new Error("Unreadable recorded provenance");
 }catch{throw new PracticeError("NOT_FOUND");}
 const passed=[attempt.accuracy_score,attempt.naturalness_score,attempt.contextual_fit_score].every(score=>typeof score==="number"&&score>=3);
 if(attempt.passed!==passed||attempt.independent_use!==(passed&&attempt.assistance_level==="none"))throw new PracticeError("NOT_FOUND");
 const evaluation=EvaluationResultSchema.parse({passed,accuracy:{score:attempt.accuracy_score,englishFeedback:attempt.accuracy_feedback_english},naturalness:{score:attempt.naturalness_score,englishFeedback:attempt.naturalness_feedback_english},contextualFit:{score:attempt.contextual_fit_score,englishFeedback:attempt.contextual_fit_feedback_english},assistanceLevel:attempt.assistance_level,independentUse:attempt.independent_use});
 const coaching=PracticeCoachingSchema.nullable().parse(attempt.coaching??null);
 const result=DueCompletionReceiptSchema.parse({reviewTaskId:receipt.review_task_id,practiceTaskId:receipt.practice_task_id,attemptId:receipt.attempt_id,masteryEventId:receipt.mastery_event_id,nextReviewTaskId:receipt.next_review_task_id,priorState:receipt.prior_state,newState:receipt.new_state,nextDueAt:receipt.next_due_at,intervalDays:receipt.interval_days,created:false,transition:receipt.prior_state===receipt.new_state?null:{from:receipt.prior_state,to:receipt.new_state}});
 const event=Array.isArray(events)&&events.length===1?record(events[0]):null;
 const ranks:Record<string,number>={tried:0,reused:1,owned:2};
 if(!event||event.id!==result.masteryEventId||event.user_id!==userId||event.user_expression_id!==expressionId||event.attempt_id!==attempt.id||event.prior_state!==result.priorState||event.new_state!==result.newState||Date.parse(string(event,"occurred_at"))!==Date.parse(string(attempt,"submitted_at"))||!legalHistoricalTransition(result.priorState,result.newState,evaluation.independentUse)||typeof currentMastery!=="string"||ranks[currentMastery]===undefined||ranks[currentMastery]<ranks[result.newState])throw new PracticeError("NOT_FOUND");
 try{validateRpcResult(result,{id:string(task,"id"),reviewTaskId:string(review,"id"),masteryState:result.priorState},evaluation.independentUse,new Date(string(attempt,"submitted_at")).toISOString());}catch{throw new PracticeError("NOT_FOUND");}
 return {attemptId:string(attempt,"id"),responseChinese:string(attempt,"response_chinese"),evaluation,coaching,naturalVersion:coaching?.naturalRevisionChinese??null,submittedAt:string(attempt,"submitted_at"),result};
}
function completedState(raw:Row|null,userId:string,reviewTaskId:string):DueReviewState|null{
 if(!raw)return null;
 const r=record(raw.review),e=record(raw.expression),s=record(raw.sense),t=record(raw.task);
 if(!r||!e||!s||!t||r.user_id!==userId||r.id!==reviewTaskId||r.status!=="completed"||e.user_id!==userId||e.id!==r.user_expression_id||s.user_id!==userId||s.id!==e.expression_sense_id||t.user_id!==userId||t.user_expression_id!==e.id||t.review_task_id!==r.id||t.kind!=="due_practice"||t.target_expression!==s.expression_text)return null;
 const identity={taskId:string(t,"id"),scenarioVersion:t.scenario_version??1,scenarioFingerprint:t.scenario_fingerprint??practiceSituationFingerprint(string(t,"prompt_chinese"))};
 const firstAnswer=officialAnswer(r,t,record(raw.officialAttempt),record(raw.receipt),userId,string(e,"id"),raw.masteryEvents,e.mastery_state);if(!firstAnswer)return null;
 const latest=record(raw.latestRevision);
 if(latest&&(latest.user_id!==userId||latest.review_task_id!==reviewTaskId||latest.attempt_id!==firstAnswer.attemptId||latest.practice_task_id!==t.id||latest.scenario_version!==identity.scenarioVersion||latest.scenario_fingerprint!==identity.scenarioFingerprint))throw new PracticeError("NOT_FOUND");
 return DueReviewStateSchema.parse({reviewTaskId,identity,regenerated:t.regenerated??false,canRegenerate:false,expressionRevealedAt:r.expression_revealed_at??r.examples_opened_at??null,examplesOpenedAt:r.examples_opened_at??null,firstAnswer,latestRevision:latest?revisionView(latest):null});
}

type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
/** Raw SQL context is service-only; each visible view is validated again here. */
export function createReviewPracticeRepository(client:SupabaseClient<Database>,materials:Pick<PracticeMaterialRepository,"findDueMaterial">=createPracticeMaterialRepository(client)):ReviewPracticeRepository{
 const db=client as unknown as RpcClient;
 function mapError(error:unknown):never{
  const message=record(error)?.message;
  for(const code of ["SCENARIO_CHANGED","ALREADY_SUBMITTED","REGENERATE_USED","IDEMPOTENCY_CONFLICT","GATEWAY_REQUIRED","LEGACY_METADATA_REQUIRED"] as const)if(typeof message==="string"&&message.includes(code))throw new PracticeError(code);
  if(typeof message==="string"&&message.includes("SCENARIO_DUPLICATE"))throw new PracticeError("PROVIDER_OUTPUT_INVALID");
  if(typeof message==="string"&&message.includes("JOB_LEASE_CONFLICT"))throw new PracticeError("REQUEST_IN_PROGRESS",true);
  if(record(error)?.code==="22023")throw new PracticeError("NOT_FOUND");
  throw new PracticeError("INTERNAL_ERROR",true);
 }
 async function rpc(name:string,args:Record<string,unknown>){const result=await db.rpc(name,args);if(result.error)mapError(result.error);return result.data;}
 const args=(userId:string,reviewTaskId:string)=>({p_user_id:userId,p_review_task_id:reviewTaskId});
 async function read(userId:string,reviewTaskId:string,retry=0):Promise<ReviewContext|null>{
  const raw=record(await rpc("read_review_practice_context",args(userId,reviewTaskId)));if(!raw)return null;
  const review=record(raw.review),expression=record(raw.expression),sense=record(raw.sense),task=record(raw.task);
  if(!review||!expression||!sense||review.user_id!==userId||review.id!==reviewTaskId||expression.user_id!==userId||expression.id!==review.user_expression_id||sense.user_id!==userId||sense.id!==expression.expression_sense_id||!z.string().uuid().safeParse(sense.video_source_id).success)return null;
  if(!["pending","completed","cancelled"].includes(string(review,"status")))return null;
  const card=cardFields(raw.canonicalCard)??cardFields(raw.linkedCard);
  let prepared:DueTransfer|null=null;
  if(task){
   if(task.user_id!==userId||task.user_expression_id!==expression.id||task.review_task_id!==reviewTaskId||task.kind!=="due_practice"||task.target_expression!==sense.expression_text)return null;
   const material=await materials.findDueMaterial(userId,reviewTaskId);if(!material)return null;
   if(material.task.id!==task.id||material.task.promptChinese!==task.prompt_chinese||material.task.instructionsEnglish!==task.instructions_english){if(retry<1)return read(userId,reviewTaskId,retry+1);throw new PracticeError("SCENARIO_CHANGED");}
   const identity={taskId:string(task,"id"),scenarioVersion:task.scenario_version??1,scenarioFingerprint:task.scenario_fingerprint??practiceSituationFingerprint(string(task,"prompt_chinese"))};
   const firstAnswer=officialAnswer(review,task,record(raw.officialAttempt),record(raw.receipt),userId,string(expression,"id"),raw.masteryEvents,expression.mastery_state);
   const latest=record(raw.latestRevision);
   if(latest&&(latest.user_id!==userId||latest.review_task_id!==reviewTaskId||latest.attempt_id!==firstAnswer?.attemptId||latest.practice_task_id!==task.id||latest.scenario_version!==identity.scenarioVersion||latest.scenario_fingerprint!==identity.scenarioFingerprint))throw new PracticeError("NOT_FOUND");
   const state=DueReviewStateSchema.parse({reviewTaskId,identity,regenerated:task.regenerated??false,canRegenerate:review.status==="pending"&&!task.regenerated&&card!==null,expressionRevealedAt:review.expression_revealed_at??review.examples_opened_at??null,examplesOpenedAt:review.examples_opened_at??null,firstAnswer,latestRevision:latest?revisionView(latest):null});
   prepared=DueTransferSchema.parse({status:"ready",id:task.id,reviewTaskId,targetExpression:task.target_expression,promptChinese:task.prompt_chinese,instructionsEnglish:task.instructions_english,goalEnglish:task.goal_english,material:{...material,...(card?{learningCard:card}:{})},scenarioVersion:identity.scenarioVersion,scenarioFingerprint:identity.scenarioFingerprint,situationEn:task.situation_en??null,interlocutor:task.interlocutor??null,taskEn:task.task_en??task.instructions_english,targetFunction:task.target_function??null,targetSetting:task.target_setting??null,transferType:task.transfer_type??null,metadataMode:task.scenario_metadata_mode??"legacy",scenarioSource:task.scenario_metadata_mode==="modern"?"model":"legacy",canRegenerate:state.canRegenerate,expressionRevealed:state.expressionRevealedAt!==null,reviewState:state});
  }
  return {userId,reviewTaskId,userExpressionId:string(expression,"id"),sourceId:string(sense,"video_source_id"),status:review.status as ReviewContext["status"],dueAt:string(review,"due_at"),masteryState:review.mastery_state as ReviewContext["masteryState"],targetExpression:string(sense,"expression_text"),card,prepared,history:z.array(z.string()).parse(raw.history),lastTransferType:z.enum(["near","far"]).nullable().parse(raw.lastTransferType)};
 }
 async function ready(userId:string,reviewTaskId:string){const context=await read(userId,reviewTaskId);if(!context?.prepared)throw new PracticeError("NOT_FOUND");return context.prepared;}
 async function preparation(value:unknown,userId:string,reviewTaskId:string):Promise<ReviewPreparationClaim|null>{const row=record(value);if(!row)return null;if(row.kind==="ready")return {kind:"ready",prepared:await ready(userId,reviewTaskId)};return row as unknown as ReviewPreparationClaim;}
 async function revisionResponse(userId:string,reviewTaskId:string,value:unknown){const raw=record(value);if(!raw)throw new PracticeError("INTERNAL_ERROR",true);return {revision:revisionView(raw),reviewState:(await ready(userId,reviewTaskId)).reviewState};}
 async function completionState(userId:string,reviewTaskId:string){return completedState(record(await rpc("read_review_practice_context",args(userId,reviewTaskId))),userId,reviewTaskId);}
 async function completionResponse(userId:string,reviewTaskId:string,created=false):Promise<OfficialReviewCompletion>{const state=await completionState(userId,reviewTaskId);const first=state?.firstAnswer;if(!state||!first)throw new PracticeError("NOT_FOUND");return {...first.result,created,evaluation:first.evaluation,coaching:first.coaching,reviewState:state};}
 return {
  read,
  async resolveActiveGatewayPin(userId){const rows=await rpc("resolve_active_user_model_gateway_pin",{p_user_id:userId});const row=Array.isArray(rows)?record(rows[0]):null;return row?{configId:string(row,"config_id"),revision:z.number().int().positive().parse(row.revision),fingerprint:string(row,"config_fingerprint")}:null;},
  async lookupPreparation(userId,reviewTaskId,kind,requestId,options,now){return preparation(await rpc("lookup_review_preparation",{...args(userId,reviewTaskId),p_kind:kind,p_request_id:requestId,p_identity:options.identity??null,p_now:now}),userId,reviewTaskId) as Promise<Exclude<ReviewPreparationClaim,{kind:"claimed"}>|null>;},
  async claim(userId,reviewTaskId,kind,requestId,options,now){const value=await preparation(await rpc("claim_review_preparation",{...args(userId,reviewTaskId),p_kind:kind,p_request_id:requestId,p_identity:options.identity??null,p_job:options.job??null,p_now:now}),userId,reviewTaskId);if(!value)throw new PracticeError("INTERNAL_ERROR",true);return value;},
  async publish(userId,reviewTaskId,claim,generated,now){await rpc("publish_review_scenario",{...args(userId,reviewTaskId),p_request_id:claim.requestId,p_token:claim.token,p_generated:generated,p_now:now});return ready(userId,reviewTaskId);},
  async fail(userId,reviewTaskId,claim,code,now){return z.boolean().parse(await rpc("fail_review_operation",{...args(userId,reviewTaskId),p_request_id:claim.requestId,p_token:claim.token,p_code:code,p_now:now}));},
  async mark(userId,reviewTaskId,kind,input,now){await rpc("mark_review_disclosure",{...args(userId,reviewTaskId),p_kind:kind,p_input:input,p_now:now});return {reviewState:(await ready(userId,reviewTaskId)).reviewState};},
  async lookupRevision(userId,reviewTaskId,input){const value=record(await rpc("lookup_review_revision",{...args(userId,reviewTaskId),p_input:input}));if(!value)return null;if(value.kind==="ready")return {kind:"ready",response:await revisionResponse(userId,reviewTaskId,value.response)};return value as {kind:"pending"}|{kind:"failed";code:PracticeErrorCode};},
  async claimRevision(userId,reviewTaskId,input,now){const value=record(await rpc("claim_review_revision",{...args(userId,reviewTaskId),p_input:input,p_now:now}));if(!value)throw new PracticeError("INTERNAL_ERROR",true);if(value.kind==="ready")return {kind:"ready",response:await revisionResponse(userId,reviewTaskId,value.response)};return value as {kind:"claimed";token:string}|{kind:"pending"};},
  async publishRevision(userId,reviewTaskId,input,token,result,now){return revisionResponse(userId,reviewTaskId,await rpc("publish_review_revision",{...args(userId,reviewTaskId),p_input:input,p_token:token,p_result:result,p_now:now}));},
  async failRevision(userId,reviewTaskId,requestId,token,code,now){return z.boolean().parse(await rpc("fail_review_operation",{...args(userId,reviewTaskId),p_request_id:requestId,p_token:token,p_code:code,p_now:now}));},
  completionState,
  async lookupCompletion(userId,reviewTaskId,input){const value=record(await rpc("lookup_review_completion",{...args(userId,reviewTaskId),p_input:input}));if(!value)return null;if(value.kind==="ready")return {kind:"ready",response:await completionResponse(userId,reviewTaskId)};return value as {kind:"pending"}|{kind:"failed";code:PracticeErrorCode};},
  async claimCompletion(userId,reviewTaskId,input,now){const value=record(await rpc("claim_review_completion",{...args(userId,reviewTaskId),p_input:input,p_now:now}));if(!value)throw new PracticeError("INTERNAL_ERROR",true);if(value.kind==="ready")return {kind:"ready",response:await completionResponse(userId,reviewTaskId)};return value as {kind:"claimed";token:string}|{kind:"pending"};},
  async publishCompletion(userId,reviewTaskId,input,token,result,now){const value=record(await rpc("publish_review_completion",{...args(userId,reviewTaskId),p_input:input,p_token:token,p_result:result,p_now:now}));return completionResponse(userId,reviewTaskId,record(value?.completion)?.created===true);},
  async failCompletion(userId,reviewTaskId,requestId,token,code,now){return z.boolean().parse(await rpc("fail_review_operation",{...args(userId,reviewTaskId),p_request_id:requestId,p_token:token,p_code:code,p_now:now}));},
 };
}
