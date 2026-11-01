import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CandidateExpressionListSchema, type CandidateExpression } from "@/contracts/knowledge";
import { PracticeTaskSchema, PracticeAttemptResponseSchema, PracticeSituationSchema, type PracticeSituation, type PracticeTask, type PracticeActivationResponse, type PracticeRoundState, type PracticeAttemptResponse } from "@/contracts/practice";
import { TargetChineseTextSchema } from "@/contracts/source";
import { ACTIVATE_PRACTICE_PROMPT_VERSION, buildActivatePracticePrompt, createActivationWireNormalizer, validateActivationOutput, ACTIVATION_MAX_TOKENS, ACTIVATION_TIMEOUT_MS } from "@/server/ai/prompts/activate.v2";
import * as evaluationV5 from "@/server/ai/prompts/evaluate.v2";
import * as evaluationV4 from "@/server/ai/prompts/evaluate.v1";
import { getTargetFunction, getTargetSetting } from "@/server/ai/prompts/learning-intent-constants";
import { completeWithFormatRetries, type StructuredJsonGateway, type StructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { CandidateSelectionSchema, PracticeError, practiceErrorFromUnknown, resolvePracticeEgress, type PracticeRepository, type CandidateSelection } from "./create-practice-task";
import { createPracticeRoundStore, parseOriginalRoundInput, practiceCandidateKey } from "./practice-rounds";
import type { Database } from "@/types/database.generated";

type RawDraft=Record<string,unknown> & {id:string;user_id:string;candidate_key:string;saved_item_id:string;candidate_artifact_id:string;candidate_index:number;future_user_expression_id:string;target_expression:string;prompt_chinese:string;round_number:number};
type RawAttempt=Record<string,unknown> & {id:string;user_id:string;practice_draft_id:string;future_user_expression_id:string;response_chinese:string;submitted_at:string;created_at:string};

function situation(d:Record<string,unknown>):PracticeSituation|null {
  const parsed=PracticeSituationSchema.safeParse({situationZh:d.prompt_chinese,situationEn:d.situation_en,interlocutor:d.interlocutor,taskEn:d.task_en,targetFunction:d.target_function,targetSetting:d.target_setting});
  return parsed.success?parsed.data:null;
}
function taskView(d:RawDraft):PracticeTask {
  return PracticeTaskSchema.parse({id:d.id,userId:d.user_id,userExpressionId:d.future_user_expression_id,kind:"use_it_now",nativeLanguage:"en",targetLanguage:"zh-CN",targetExpression:d.target_expression,promptChinese:d.prompt_chinese,instructionsEnglish:d.instructions_english,goalEnglish:d.goal_english,dueAt:null,createdAt:d.created_at,situation:situation(d)});
}
function resultView(a:RawAttempt,state:PracticeRoundState):PracticeAttemptResponse {
  return PracticeAttemptResponseSchema.parse({attempt:{id:a.id,userId:a.user_id,practiceTaskId:a.practice_draft_id,userExpressionId:a.future_user_expression_id,responseChinese:a.response_chinese,submittedAt:a.submitted_at,createdAt:a.created_at,evaluation:{passed:a.passed,independentUse:a.independent_use,assistanceLevel:a.assistance_level,accuracy:{score:a.accuracy_score,englishFeedback:a.accuracy_feedback_english},naturalness:{score:a.naturalness_score,englishFeedback:a.naturalness_feedback_english},contextualFit:{score:a.contextual_fit_score,englishFeedback:a.contextual_fit_feedback_english}}},coaching:a.natural_version?{naturalRevisionChinese:a.natural_version}:null,roundState:state});
}
function deterministicUuid(scope:string):string {
  const b=Buffer.from(createHash("sha256").update(scope).digest().subarray(0,16));b[6]=(b[6]!&15)|80;b[8]=(b[8]!&63)|128;const h=b.toString("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Model calls happen outside the transaction; every publication rechecks SQL fences. */
export function createRoundPracticeServices(deps:{client:SupabaseClient<Database>;repository:PracticeRepository;ci:boolean;gatewayResolver:StructuredJsonGatewayResolver;activationFixture:StructuredJsonGateway;evaluationFixture:StructuredJsonGateway;now:()=>string;uuid:()=>string}) {
  const store=createPracticeRoundStore(deps.client as unknown as Parameters<typeof createPracticeRoundStore>[0]);
  async function rawDraft(userId:string,taskId:string):Promise<RawDraft>{
    if(!z.string().uuid().safeParse(userId).success||!z.string().uuid().safeParse(taskId).success)throw new PracticeError("VALIDATION_FAILED");
    const result=await deps.client.from("practice_drafts").select("*").eq("user_id",userId).eq("id",taskId).maybeSingle();
    if(result.error)throw new PracticeError("INTERNAL_ERROR",true);if(!result.data)throw new PracticeError("NOT_FOUND");return result.data as unknown as RawDraft;
  }
  async function candidate(userId:string,selection:CandidateSelection):Promise<{card:CandidateExpression;videoSourceId:string}>{
    const artifact=await deps.repository.findCandidate(userId,selection);
    if(!artifact||artifact.userId!==userId)throw new PracticeError("NOT_FOUND");
    const content=z.object({candidates:CandidateExpressionListSchema}).safeParse(artifact.content);
    const card=content.success?content.data.candidates[selection.candidateIndex]:null;
    if(!card)throw new PracticeError("NOT_FOUND");return {card,videoSourceId:artifact.videoSourceId};
  }
  async function activate(userId:string,selectionValue:CandidateSelection,requestId:string|null=null):Promise<PracticeActivationResponse>{
    const selection=CandidateSelectionSchema.parse(selectionValue);const {card,videoSourceId}=await candidate(userId,selection);
    const key=practiceCandidateKey(selection,card);const state=await store.candidate(userId,key);
    if(state.promotion)return {redirect:`/vault/${state.promotion.userExpressionId}`};
    if(requestId){
      const replay=await store.request(userId,key,requestId);
      if(replay)return taskView(replay as RawDraft);
    }
    if(state.draft?.status==="open"){
      if(requestId)await store.create(userId,state.draft,requestId);
      return taskView(state.draft as RawDraft);
    }
    const targetFunction=getTargetFunction(card.functionCategories?.[0]??"other");
    const targetSetting=getTargetSetting(card.usageSettings?.[0]??"casual_chat");
    const resolved=await resolvePracticeEgress(userId,{...deps,fixtureGateway:deps.activationFixture});
    let output:ReturnType<typeof validateActivationOutput>;
    try {
      const input={card:{expression:card.expression,meaningHere:card.meaningHere??card.englishMeaning,useItWhen:card.useItWhen??card.englishExplanation,toneAndWho:card.toneAndWho??card.tone},targetFunction,targetSetting,sourceLine:card.evidenceText,avoidSituations:state.situations};
      const prompt=buildActivatePracticePrompt(input);const context={targetExpression:card.expression,avoidSituations:state.situations};
      output=await completeWithFormatRetries(()=>resolved.gateway.complete(ACTIVATE_PRACTICE_PROMPT_VERSION,prompt.userPrompt,{systemPrompt:prompt.systemPrompt,maxTokens:ACTIVATION_MAX_TOKENS,timeoutMs:ACTIVATION_TIMEOUT_MS,normalize:createActivationWireNormalizer(context)}),value=>validateActivationOutput(value,context));
    }catch(error){throw practiceErrorFromUnknown(error);}
    const now=deps.now();
    const draft={id:state.draft?deps.uuid():deterministicUuid(`practice-round-v1:${userId}:${key}`),user_id:userId,video_source_id:videoSourceId,saved_item_id:selection.savedItemId,candidate_artifact_id:selection.candidateArtifactId,candidate_index:selection.candidateIndex,future_user_expression_id:deps.uuid(),native_language:"en",target_language:"zh-CN",target_expression:card.expression,prompt_chinese:output.situationZh,instructions_english:output.taskEn,goal_english:"Use the target expression naturally in this new situation.",created_at:now,updated_at:now,candidate_key:key,situation_en:output.situationEn,interlocutor:output.interlocutor,task_en:output.taskEn,target_function:targetFunction.value,target_setting:targetSetting.value,scenario_source:"model",activation_prompt_version:resolved.pin?ACTIVATE_PRACTICE_PROMPT_VERSION:null,activation_model:resolved.pin?resolved.gateway.model:null,activation_gateway_config_id:resolved.pin?.configId??null,activation_gateway_revision:resolved.pin?.revision??null,activation_gateway_fingerprint:resolved.pin?.fingerprint??null};
    const publication=await store.create(userId,draft,requestId) as {draft?:RawDraft;promoted?:string};
    if(publication.promoted)return {redirect:`/vault/${publication.promoted}`};
    if(!publication.draft)throw new PracticeError("INTERNAL_ERROR",true);return taskView(publication.draft);
  }
  async function stateOrThrow(userId:string,taskId:string){const state=await store.state(userId,taskId);if(!state)throw new PracticeError("NOT_FOUND");return state;}
  async function evaluate(userId:string,d:RawDraft,text:string,revision:number):Promise<PracticeAttemptResponse>{
    const state=await stateOrThrow(userId,d.id);const assisted=state.examplesOpened?"model_answer":"none";
    const resolved=await resolvePracticeEgress(userId,{...deps,fixtureGateway:deps.evaluationFixture});
    const scenario=situation(d);
    let parsed:ReturnType<typeof evaluationV4.parsePracticeEvaluationOutput>;let version:string;
    try{
      if(scenario){
        const {card}=await candidate(userId,{savedItemId:d.saved_item_id,candidateArtifactId:d.candidate_artifact_id,candidateIndex:d.candidate_index});
        const prompt=evaluationV5.buildEvaluatePracticePrompt({targetExpression:d.target_expression,targetMeaning:card.meaningHere??card.englishMeaning,situationZh:scenario.situationZh,interlocutor:scenario.interlocutor,targetSetting:getTargetSetting(scenario.targetSetting),targetFunction:getTargetFunction(scenario.targetFunction),taskEn:scenario.taskEn,toneAndWho:card.toneAndWho??card.tone,watchOut:card.watchOut??null,learnerResponse:text});
        version=evaluationV5.EVALUATE_PRACTICE_PROMPT_VERSION;
        const output=await completeWithFormatRetries(()=>resolved.gateway.complete(version,prompt.userPrompt,{systemPrompt:prompt.systemPrompt,maxTokens:700,timeoutMs:30_000,normalize:evaluationV5.normalizePracticeEvaluationWire}));
        parsed=evaluationV5.parsePracticeEvaluationOutput(output,d.target_expression,assisted);
      }else{
        const prompt=evaluationV4.buildEvaluatePracticePrompt({targetExpression:d.target_expression,promptChinese:d.prompt_chinese,learnerResponse:text});version=evaluationV4.EVALUATE_PRACTICE_PROMPT_VERSION;
        const output=await completeWithFormatRetries(()=>resolved.gateway.complete(version,prompt.userPrompt,{systemPrompt:prompt.systemPrompt,maxTokens:700,timeoutMs:30_000,normalize:evaluationV4.normalizePracticeEvaluationWire}));
        parsed=evaluationV4.parsePracticeEvaluationOutput(output,d.target_expression,assisted);
      }
    }catch(error){throw practiceErrorFromUnknown(error);}
    const now=deps.now();const e=parsed.evaluation;
    const answer={id:deps.uuid(),user_id:userId,practice_draft_id:d.id,future_user_expression_id:d.future_user_expression_id,revision,response_chinese:text,passed:e.passed,accuracy_score:e.accuracy.score,accuracy_feedback_english:e.accuracy.englishFeedback,naturalness_score:e.naturalness.score,naturalness_feedback_english:e.naturalness.englishFeedback,contextual_fit_score:e.contextualFit.score,contextual_fit_feedback_english:e.contextualFit.englishFeedback,independent_use:e.independentUse,assistance_level:assisted,submitted_at:now,created_at:now,natural_version:parsed.coaching?.naturalRevisionChinese??null,evaluation_prompt_version:resolved.pin?version:null,evaluation_model:resolved.pin?resolved.gateway.model:null,evaluation_gateway_config_id:resolved.pin?.configId??null,evaluation_gateway_revision:resolved.pin?.revision??null,evaluation_gateway_fingerprint:resolved.pin?.fingerprint??null};
    const persisted=await store.record(userId,answer) as {attempt:RawAttempt;conflict:boolean};
    const updated=await stateOrThrow(userId,d.id);
    if(persisted.conflict)throw new PracticeError("FIRST_ANSWER_EXISTS",false,{roundState:updated});
    return resultView(persisted.attempt,updated);
  }
  return {
    taskService:{activate},
    attemptService:{
      async submitOriginal(userId:string,inputValue:unknown){
        let input:ReturnType<typeof parseOriginalRoundInput>;try{input=parseOriginalRoundInput(inputValue);}catch{throw new PracticeError("VALIDATION_FAILED");}
        const d=await rawDraft(userId,input.taskId);const state=await stateOrThrow(userId,d.id);
        if(state.firstAnswer){
          if(state.firstAnswer.text!==input.responseChinese)throw new PracticeError("FIRST_ANSWER_EXISTS",false,{roundState:state});
          const result=await deps.client.from("practice_draft_attempts").select("*").eq("user_id",userId).eq("id",state.firstAnswer.attemptId).single();
          if(result.error||!result.data)throw new PracticeError("INTERNAL_ERROR",true);return resultView(result.data as unknown as RawAttempt,state);
        }
        if(state.status!=="open")throw new PracticeError("REVISION_CONFLICT");return evaluate(userId,d,input.responseChinese,1);
      },
      async submitRevision(userId:string,attemptId:string,text:string){
        if(!z.string().uuid().safeParse(attemptId).success||!TargetChineseTextSchema.max(10_000).safeParse(text).success)throw new PracticeError("VALIDATION_FAILED");
        const result=await deps.client.from("practice_draft_attempts").select("practice_draft_id").eq("user_id",userId).eq("id",attemptId).maybeSingle();
        if(result.error||!result.data)throw new PracticeError("NOT_FOUND");const d=await rawDraft(userId,result.data.practice_draft_id);
        const state=await stateOrThrow(userId,d.id);if(!state.firstAnswer||!["open","retry_scheduled","promoted"].includes(state.status))throw new PracticeError("REVISION_CONFLICT");
        return evaluate(userId,d,text,2);
      },
    },
    async startRound(userId:string,taskId:string,requestId:string){
      if(!z.string().uuid().safeParse(requestId).success)throw new PracticeError("VALIDATION_FAILED");
      const d=await rawDraft(userId,taskId);const before=await store.candidate(userId,d.candidate_key);
      if(before.promotion)throw new PracticeError("ALREADY_PROMOTED",false,{userExpressionId:before.promotion.userExpressionId});
      const replay=await store.request(userId,d.candidate_key,requestId) as RawDraft|null;
      if(replay)return {taskId:replay.id,roundNumber:replay.round_number,created:false};
      const result=await activate(userId,{savedItemId:d.saved_item_id,candidateArtifactId:d.candidate_artifact_id,candidateIndex:d.candidate_index},requestId);
      if("redirect" in result)throw new PracticeError("ALREADY_PROMOTED",false,{userExpressionId:result.redirect.split("/").at(-1)});
      const round=await stateOrThrow(userId,result.id);return {taskId:result.id,roundNumber:round.roundNumber,created:result.id!==before.draft?.id};
    },
    async change(userId:string,taskId:string,action:"remove"|"restore"|"examples"){
      if(!z.string().uuid().safeParse(taskId).success)throw new PracticeError("VALIDATION_FAILED");
      try{const result=await store.change(userId,taskId,action);if(!result)throw new PracticeError("NOT_FOUND");return result;}catch(error){if(error instanceof PracticeError)throw error;throw new PracticeError("REVISION_CONFLICT");}
    },
    async dueExamples(userId:string,reviewTaskId:string){
      if(!z.string().uuid().safeParse(reviewTaskId).success)throw new PracticeError("VALIDATION_FAILED");const result=await store.dueExamples(userId,reviewTaskId);if(!result)throw new PracticeError("NOT_FOUND");return result;
    },
  };
}
