import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createSupabaseDuePracticeRepository,type DuePracticeCompletionRepository } from "@/server/domain/complete-due-practice";
import { PracticeError } from "@/server/domain/create-practice-task";
import type { ReviewPracticeRepository } from "./review-practice-repository";

/** Preserve the accepted official completion graph and add snapshot fencing. */
export function createReviewCompletionRepository(client:SupabaseClient<Database>,reviews:ReviewPracticeRepository,base:DuePracticeCompletionRepository=createSupabaseDuePracticeRepository(client)):DuePracticeCompletionRepository{
 return {
  ...base,requireScenarioIdentity:true,
  async findCurrentReview(userId,reviewTaskId){return (await reviews.read(userId,reviewTaskId))?.prepared??null;},
  findCurrentReviewState:(userId,reviewTaskId)=>reviews.completionState(userId,reviewTaskId),
  async findCompletionState(userId,reviewTaskId){
   const state=await base.findCompletionState(userId,reviewTaskId);if(!state)return null;
   if(state.status==="completed"){
    const official=await reviews.completionState(userId,reviewTaskId);
    if(!official?.firstAnswer||official.identity.taskId!==state.task.id||official.firstAnswer.attemptId!==official.firstAnswer.result.attemptId)return null;
    return {...state,task:{...state.task,scenarioVersion:official.identity.scenarioVersion,scenarioFingerprint:official.identity.scenarioFingerprint},attempt:state.attempt?{...state.attempt,coaching:official.firstAnswer.coaching}:null};
   }
   const context=await reviews.read(userId,reviewTaskId),prepared=context?.prepared;
   if(!prepared||prepared.id!==state.task.id||!context)return null;
   return {...state,task:{...state.task,targetExpression:prepared.targetExpression,promptChinese:prepared.promptChinese,instructionsEnglish:prepared.instructionsEnglish,goalEnglish:prepared.goalEnglish,scenarioVersion:prepared.scenarioVersion,scenarioFingerprint:prepared.scenarioFingerprint,metadataMode:prepared.metadataMode,...(prepared.material.task.situation?{situation:prepared.material.task.situation}:{}),...(context.card?{learningCard:context.card}:{})},attempt:state.attempt?{...state.attempt,coaching:prepared.reviewState.firstAnswer?.coaching??null}:null};
  },
  async completeDuePractice(input){
   const db=client as unknown as {rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown;error:unknown}>};
   const result=await db.rpc("complete_due_review_with_snapshot",{p_user_id:input.userId,p_input:input});
   if(result.error){
    const message=typeof result.error==="object"&&result.error!==null&&"message"in result.error?String(result.error.message):"";
    if(message.includes("SCENARIO_CHANGED"))throw new PracticeError("SCENARIO_CHANGED",false,{current:(await reviews.read(input.userId,input.reviewTaskId))?.prepared});
    if(message.includes("conflicts with receipt")||message.includes("stale or not due"))throw new PracticeError("REVISION_CONFLICT");
    throw new PracticeError("INTERNAL_ERROR",true);
   }
   const value=result.data as {completion:Database["public"]["Functions"]["complete_due_practice"]["Returns"][number];assistanceLevel:"none"|"hint"|"model_answer"};
   const row=value.completion;if(!row)throw new PracticeError("INTERNAL_ERROR",true);
   return {reviewTaskId:row.review_task_id,practiceTaskId:row.practice_task_id,attemptId:row.attempt_id,masteryEventId:row.mastery_event_id,nextReviewTaskId:row.next_review_task_id,priorState:row.prior_state as "tried"|"reused"|"owned",newState:row.new_state as "tried"|"reused"|"owned",nextDueAt:row.next_due_at,intervalDays:row.interval_days,created:row.created,assistanceLevel:value.assistanceLevel};
  },
 };
}
