import { z } from "zod";
import { ReviewMutationInputSchema, type ReviewMutationInput } from "@/contracts/review-practice";
import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import { completeWithFormatRetries, type StructuredJsonGateway, type StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { TRANSFER_SCENARIO_PROMPT_VERSION, TRANSFER_SCENARIO_MAX_TOKENS, TRANSFER_SCENARIO_TIMEOUT_MS, buildTransferScenarioPrompt, createTransferScenarioWireNormalizer } from "@/server/ai/prompts/transfer-scenario.v1";
import { getTargetFunction, getTargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import * as evaluate from "@/server/ai/prompts/evaluate.v2";
import { createReviewRevisionService } from "./review-revisions";
import { selectTransferTarget } from "./transfer-target";
import { PracticeError, practiceErrorFromUnknown, resolvePracticeEgress } from "./create-practice-task";
import type { ReviewContext, ReviewJobFence, ReviewPracticeRepository } from "@/server/repositories/review-practice-repository";

type Dependencies = {repository:ReviewPracticeRepository;gatewayResolver:StructuredJsonGatewayResolver;fixtureGateway:StructuredJsonGateway;ci:boolean;now:()=>string;id:()=>string};
const uuid=z.string().uuid();
function identityMatches(context:ReviewContext,input:ReviewMutationInput){const current=context.prepared;return Boolean(current&&current.id===input.taskId&&current.scenarioVersion===input.scenarioVersion&&current.scenarioFingerprint===input.scenarioFingerprint);}
function operation(kind:string,requestId:string,state:"failed"|"in_progress"){return {operation:{kind,requestId,state}};}

export function createReviewPracticeService(dependencies:Dependencies){
 const {repository}=dependencies;
 const revisions=createReviewRevisionService({...dependencies,fixtureGateway:evaluate.createEvaluationFixtureGateway()});
 async function read(userId:string,reviewTaskId:string,allowFuture=false){
  if(!uuid.safeParse(userId).success||!uuid.safeParse(reviewTaskId).success)throw new PracticeError("VALIDATION_FAILED");
  const context=await repository.read(userId,reviewTaskId);
  if(!context||context.userId!==userId||context.reviewTaskId!==reviewTaskId||context.status==="cancelled"||(!allowFuture&&context.status==="pending"&&Date.parse(context.dueAt)>Date.parse(dependencies.now())))throw new PracticeError("NOT_FOUND");
  return context;
 }
 async function prepare(userId:string,reviewTaskId:string,kind:"prepare"|"regenerate",requestId:string|null,input?:ReviewMutationInput,job?:ReviewJobFence){
  const context=await read(userId,reviewTaskId,Boolean(job));
  if(kind==="prepare"&&context.prepared)return context.prepared;
  // A durable job observes the existing preparation cycle; its ID is not an
  // explicit user retry and cannot reopen a foreground terminal failure.
  const previous=await repository.lookupPreparation(userId,reviewTaskId,kind,job?null:requestId,{...(input?{identity:input}:{}),...(job?{job}:{})},dependencies.now());
  if(previous?.kind==="ready")return previous.prepared;
  if(kind==="regenerate"&&(context.status==="completed"||context.prepared?.reviewState.firstAnswer))throw new PracticeError("ALREADY_SUBMITTED",false,{current:context.prepared});
  if(previous?.kind==="failed")throw new PracticeError(previous.code,true,operation(kind,job?.jobId??previous.requestId,"failed"));
  if(previous?.kind==="pending"){
   if(kind==="prepare")return {status:"preparing" as const,reviewTaskId,requestId:previous.requestId,retryAfterMs:1000};
   throw new PracticeError("REQUEST_IN_PROGRESS",true,operation(kind,previous.requestId,"in_progress"));
  }
  if(kind==="regenerate"&&(!input||!identityMatches(context,input)))throw new PracticeError("SCENARIO_CHANGED",false,{current:context.prepared});
  if(kind==="regenerate"&&context.prepared?.reviewState.regenerated)throw new PracticeError("REGENERATE_USED",false,{current:context.prepared});
  if(context.status!=="pending")throw new PracticeError("NOT_FOUND");
  const parsedCard=LearningCardFieldsSchema.safeParse(context.card);
  if(!parsedCard.success)throw new PracticeError("LEGACY_METADATA_REQUIRED");
  const card=parsedCard.data;
  const selected=selectTransferTarget({masteryState:context.masteryState,functionCategories:card.functionCategories,usageSettings:card.usageSettings,lastTransferType:context.lastTransferType});
  const current=context.prepared;
  const target=kind==="regenerate"&&current?.transferType&&current.targetFunction&&current.targetSetting
   ?{transferType:current.transferType,targetFunction:getTargetFunction(current.targetFunction),targetSetting:getTargetSetting(current.targetSetting)}:selected;
  // Zero-model preconditions must not persist a failed generation cycle:
  // after gateway setup, plain GET must still be able to prepare the first one.
  const egress=await resolvePracticeEgress(userId,dependencies);
  const claim=await repository.claim(userId,reviewTaskId,kind,requestId,{...(input?{identity:input}:{}),...(job?{job}:{})},dependencies.now());
  if(claim.kind==="ready")return claim.prepared;
  if(claim.kind==="pending"){
   if(kind==="prepare")return {status:"preparing" as const,reviewTaskId,requestId:claim.requestId,retryAfterMs:1000};
   throw new PracticeError("REQUEST_IN_PROGRESS",true,operation(kind,claim.requestId,"in_progress"));
  }
  if(claim.kind==="failed")throw new PracticeError(claim.code,true,operation(kind,job?.jobId??claim.requestId,"failed"));
  try{
   const previousSituations=[...context.history];
   if(current?.promptChinese&&!previousSituations.includes(current.promptChinese))previousSituations.push(current.promptChinese);
   const prompt=buildTransferScenarioPrompt({card:{expression:context.targetExpression,meaningHere:card.meaningHere,useItWhen:card.useItWhen,toneAndWho:card.toneAndWho},...target,previousSituations});
   const scenario=await completeWithFormatRetries(()=>egress.gateway.complete(TRANSFER_SCENARIO_PROMPT_VERSION,prompt.userPrompt,{systemPrompt:prompt.systemPrompt,maxTokens:TRANSFER_SCENARIO_MAX_TOKENS,timeoutMs:TRANSFER_SCENARIO_TIMEOUT_MS,normalize:createTransferScenarioWireNormalizer({targetExpression:context.targetExpression,previousSituations})}));
   return await repository.publish(userId,reviewTaskId,claim,{scenario,...target,promptVersion:TRANSFER_SCENARIO_PROMPT_VERSION,model:egress.gateway.model,pin:egress.pin},dependencies.now());
  }catch(error){
   const safe=practiceErrorFromUnknown(error);
   let failed=false;
   try{failed=await repository.fail(userId,reviewTaskId,claim,safe.code,dependencies.now());}catch{/* The publication may already have committed. */}
   if(failed)throw new PracticeError(safe.code,safe.retryable,{...safe.details,...operation(kind,claim.requestId,"failed")});
   try{
    const replay=await repository.lookupPreparation(userId,reviewTaskId,kind,claim.requestId,{...(input?{identity:input}:{}),...(job?{job}:{})},dependencies.now());
    if(replay?.kind==="ready")return replay.prepared;
    if(replay?.kind==="pending"){
     if(kind==="prepare")return {status:"preparing" as const,reviewTaskId,requestId:claim.requestId,retryAfterMs:1000};
     throw new PracticeError("REQUEST_IN_PROGRESS",true,operation(kind,claim.requestId,"in_progress"));
    }
    if(replay?.kind==="failed")throw new PracticeError(replay.code,true,operation(kind,claim.requestId,"failed"));
   }catch(replayError){if(replayError instanceof PracticeError&&replayError.details?.operation)throw replayError;}
   // No confirmed terminal state: preserve the request ID, never tell the UI
   // that an uncertain commit authorizes a fresh model cycle.
   throw new PracticeError(safe.code,safe.retryable,safe.details);
  }
 }
 return {
  async current(userId:string,reviewTaskId:string){const context=await read(userId,reviewTaskId);if(!context.prepared)throw new PracticeError("NOT_FOUND");return context.prepared;},
  ensure(userId:string,reviewTaskId:string,options:{retryRequestId?:string}={}){if(options.retryRequestId&&!uuid.safeParse(options.retryRequestId).success)throw new PracticeError("VALIDATION_FAILED");return prepare(userId,reviewTaskId,"prepare",options.retryRequestId??null);},
  prepareInBackground(userId:string,reviewTaskId:string,job:ReviewJobFence){return prepare(userId,reviewTaskId,"prepare",job.jobId,undefined,job);},
  regenerate(userId:string,reviewTaskId:string,input:ReviewMutationInput){return prepare(userId,reviewTaskId,"regenerate",input.requestId,ReviewMutationInputSchema.parse(input));},
  async reveal(userId:string,reviewTaskId:string,input:ReviewMutationInput){await read(userId,reviewTaskId);return repository.mark(userId,reviewTaskId,"reveal",ReviewMutationInputSchema.parse(input),dependencies.now());},
  async examples(userId:string,reviewTaskId:string,input:ReviewMutationInput){await read(userId,reviewTaskId);return repository.mark(userId,reviewTaskId,"examples",ReviewMutationInputSchema.parse(input),dependencies.now());},
  revise:revisions.revise,
 };
}
