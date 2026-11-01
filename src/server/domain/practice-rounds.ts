import { createHash } from "node:crypto";
import { z } from "zod";
import { TargetChineseTextSchema } from "@/contracts/source";
import { PracticeRoundStateSchema, type PracticeRoundState } from "@/contracts/practice";
import type { CandidateSelection } from "./create-practice-task";

export function practiceCandidateKey(selection:CandidateSelection,candidate:{readonly highlightKey?:string}):string {
  return candidate.highlightKey
    ? `h:${selection.savedItemId}:${createHash("sha256").update(candidate.highlightKey,"utf8").digest("hex")}`
    : `l:${selection.savedItemId}:${selection.candidateArtifactId}:${selection.candidateIndex}`;
}
export function practiceSituationFingerprint(text:string):string {
  return createHash("sha256").update(text.normalize("NFKC").replace(/[\p{P}\p{Z}\s]+/gu,"").toLowerCase(),"utf8").digest("hex");
}
const originalInput=z.strictObject({taskId:z.string().uuid(),responseChinese:TargetChineseTextSchema.max(10_000)});
export function parseOriginalRoundInput(value:unknown):z.infer<typeof originalInput> {
  if(typeof value!=="object"||value===null||Array.isArray(value))return originalInput.parse(value);
  const {assistanceLevel:ignored,...rest}=value as Record<string,unknown>;
  void ignored;
  return originalInput.parse(rest);
}

/** RPC-only access retains private receipt ACLs and keeps multirow writes atomic. */
export interface PracticeRoundRpcClient {
  rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>;
}
export function createPracticeRoundStore(client:PracticeRoundRpcClient) {
  async function rpc(name:string,args:Record<string,unknown>):Promise<unknown>{
    const result=await client.rpc(name,args);if(result.error)throw result.error;return result.data;
  }
  return {
    async state(userId:string,taskId:string):Promise<PracticeRoundState|null>{
      const value=await rpc("get_practice_round_state",{p_user_id:userId,p_task_id:taskId});
      return value===null?null:PracticeRoundStateSchema.parse(value);
    },
    async candidate(userId:string,candidateKey:string){
      return await rpc("get_practice_candidate_state",{p_user_id:userId,p_candidate_key:candidateKey}) as {
        draft:Record<string,unknown>|null;promotion:{userExpressionId:string}|null;situations:string[];
      };
    },
    create(userId:string,draft:Record<string,unknown>,requestId:string|null){
      return rpc("create_practice_round",{p_user_id:userId,p_draft:draft,p_request_id:requestId});
    },
    request(userId:string,candidateKey:string,requestId:string){
      return rpc("get_practice_round_request",{p_user_id:userId,p_candidate_key:candidateKey,p_request_id:requestId});
    },
    record(userId:string,attempt:Record<string,unknown>){
      return rpc("record_practice_round_attempt",{p_user_id:userId,p_attempt:attempt});
    },
    change(userId:string,taskId:string,action:"remove"|"restore"|"examples"){
      return rpc("change_practice_round",{p_user_id:userId,p_task_id:taskId,p_action:action});
    },
    dueExamples(userId:string,reviewTaskId:string){
      return rpc("open_due_practice_examples",{p_user_id:userId,p_review_task_id:reviewTaskId});
    },
    completeDue(userId:string,input:Record<string,unknown>){
      return rpc("complete_due_practice_with_examples",{p_user_id:userId,p_input:input});
    },
    async dueAssistance(userId:string,reviewTaskId:string):Promise<"none"|"model_answer">{
      return await rpc("get_due_practice_assistance",{p_user_id:userId,p_review_task_id:reviewTaskId}) as "none"|"model_answer";
    },
  };
}
