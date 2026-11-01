import { describe,expect,test,vi } from "vitest";
import { createRoundPracticeServices } from "./round-practice-service";
import type { PracticeRoundState } from "@/contracts/practice";
import { MODEL_OUTPUT_TOKENS } from "@/server/ai/output-budgets";

const user="10000000-0000-4000-8000-000000000001",task="10000000-0000-4000-8000-000000000002",save="10000000-0000-4000-8000-000000000003",artifact="10000000-0000-4000-8000-000000000004",future="10000000-0000-4000-8000-000000000005",attempt="10000000-0000-4000-8000-000000000006";
const now="2026-11-01T12:00:00.000Z";
const dimensions={accuracy:{score:4,englishFeedback:"Correct target meaning."},naturalness:{score:4,englishFeedback:"Natural Chinese."},contextualFit:{score:4,englishFeedback:"Fits the conversation."}};
const card={expression:"太离谱了",englishMeaning:"Outrageous.",englishExplanation:"Use it to react.",tone:"Casual.",communicativeFunction:"React.",register:"Casual.",evidenceText:"这也太离谱了。",segmentIds:["seg"],startSeconds:1,endSeconds:2,confidence:1};
function harness(){
  const d={id:task,user_id:user,saved_item_id:save,candidate_artifact_id:artifact,candidate_index:0,candidate_key:`l:${save}:${artifact}:0`,future_user_expression_id:future,target_expression:card.expression,prompt_chinese:"朋友说咖啡要六十元，你怎么看？",instructions_english:"Tell your friend how you feel.",goal_english:"Use the expression.",status:"open",round_number:1,created_at:now,situation_en:"Your friend says a coffee costs sixty yuan. What do you think?",interlocutor:"朋友",task_en:"Tell your friend how you feel.",target_function:"react",target_setting:"casual_chat"};
  let state:PracticeRoundState={roundNumber:1,status:"open",firstAnswer:null,latestRevision:null,examplesOpened:false,promotion:null,retryDueAt:null};
  let persisted:Record<string,unknown>|null=null;
  const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
    if(name==="get_practice_candidate_state")return {data:{draft:d,promotion:state.promotion,situations:[d.prompt_chinese]},error:null};
    if(name==="get_practice_round_state")return {data:state,error:null};
    if(name==="record_practice_round_attempt"){
      const a=args.p_attempt as Record<string,unknown>;persisted={...a,assistance_level:state.examplesOpened?"model_answer":"none",independent_use:!state.examplesOpened};
      state={...state,status:"retry_scheduled",retryDueAt:"2026-11-02T12:00:00.000Z",firstAnswer:{attemptId:attempt,revision:1,text:a.response_chinese as string,evaluation:{...dimensions,passed:true,assistanceLevel:state.examplesOpened?"model_answer":"none",independentUse:!state.examplesOpened},naturalVersion:a.natural_version as string|null}};
      return {data:{attempt:persisted,conflict:false},error:null};
    }
    throw new Error(`Unexpected RPC ${name}`);
  });
  const client={rpc,from(table:string){const filters=new Map<string,unknown>();return {select(){return this;},eq(k:string,v:unknown){filters.set(k,v);return this;},async maybeSingle(){return {data:table==="practice_drafts"?d:table==="practice_draft_attempts"?persisted:null,error:null};},async single(){return this.maybeSingle();}};}};
  const complete=vi.fn(async(_version:string,_input:string,options:{maxTokens:number;normalize:(v:unknown)=>{success:boolean;data?:unknown}})=>{const decoded=options.normalize({...dimensions,naturalRevisionChinese:"这件事也太离谱了。"});if(!decoded.success)throw new Error("invalid fixture");return decoded.data;});
  const gateway={model:"fixture/test",complete};
  let removed=false;
  const services=createRoundPracticeServices({client:client as never,repository:{findCandidate:async()=>({id:artifact,userId:user,videoSourceId:future,savedItemId:save,artifactType:"saved_item_analysis",removedExpressionKeys:removed?[`legacy:${card.expression}`]:[],content:{candidates:[card]}})} as never,ci:true,gatewayResolver:{} as never,activationFixture:gateway as never,evaluationFixture:gateway as never,now:()=>now,uuid:()=>attempt});
  return {services,complete,rpc,removeCard(){removed=true;},setState(value:PracticeRoundState){state=value;},setDraftStatus(value:string){d.status=value;},setLegacy(){d.situation_en="";},getState:()=>state,getPersisted:()=>persisted};
}

describe("round service persistence boundary",()=>{
  test("deleted Saved cards cannot activate a new round or call the model",async()=>{
    const h=harness();h.removeCard();
    await expect(h.services.taskService.activate(user,{savedItemId:save,candidateArtifactId:artifact,candidateIndex:0})).rejects.toMatchObject({code:"NOT_FOUND"});
    expect(h.complete).not.toHaveBeenCalled();
  });
  test("archived Vault promotions do not redirect to unavailable entries",async()=>{
    const h=harness();h.setState({...h.getState(),promotion:{userExpressionId:future,nextDueAt:now,removedFromVault:true}});
    await expect(h.services.taskService.activate(user,{savedItemId:save,candidateArtifactId:artifact,candidateIndex:0})).rejects.toMatchObject({code:"NOT_FOUND"});
    expect(h.complete).not.toHaveBeenCalled();
  });
  test("a new-situation attempt uses the shared activation budget before a generation failure",async()=>{
    const h=harness();h.setDraftStatus("retry_scheduled");h.complete.mockRejectedValueOnce(new Error("Synthetic generation stop"));
    await expect(h.services.taskService.activate(user,{savedItemId:save,candidateArtifactId:artifact,candidateIndex:0})).rejects.toThrow();
    expect(h.complete).toHaveBeenCalledTimes(1);expect(h.complete.mock.calls[0]?.[2].maxTokens).toBe(MODEL_OUTPUT_TOKENS.activatePractice);
    expect(h.rpc.mock.calls.some(([name])=>name==="create_practice_round")).toBe(false);
  });
  test("legacy task evaluation keeps its v4 prompt with the shared current scoring budget",async()=>{
    const h=harness();h.setLegacy();await h.services.attemptService.submitOriginal(user,{taskId:task,responseChinese:"这也太离谱了。"});
    expect(h.complete).toHaveBeenCalledTimes(1);expect(h.complete.mock.calls[0]?.[0]).toBe("evaluate-practice-v4");
    expect(h.complete.mock.calls[0]?.[2].maxTokens).toBe(MODEL_OUTPUT_TOKENS.evaluatePractice);
  });
  test("an unanswered first round resumes with no model call",async()=>{
    const h=harness();const result=await h.services.taskService.activate(user,{savedItemId:save,candidateArtifactId:artifact,candidateIndex:0});
    expect(result).toMatchObject({id:task,situation:{targetFunction:"react",targetSetting:"casual_chat"}});expect(h.complete).not.toHaveBeenCalled();
  });
  test("new evaluations use explicit meaning and task metadata without client assistance",async()=>{
    const h=harness();const result=await h.services.attemptService.submitOriginal(user,{taskId:task,responseChinese:"这也太离谱了。",assistanceLevel:"spoof"});
    expect(h.complete.mock.calls[0]?.[0]).toBe("evaluate-practice-v5");const data=JSON.parse(h.complete.mock.calls[0]![1].split("\n")[0]);expect(data).toMatchObject({targetMeaning:card.englishMeaning,interlocutor:"朋友",targetFunction:{value:"react"}});
    expect(h.complete.mock.calls[0]?.[2].maxTokens).toBe(MODEL_OUTPUT_TOKENS.evaluatePractice);
    expect(result.coaching).toEqual({naturalRevisionChinese:"这件事也太离谱了。"});expect(result.roundState?.firstAnswer?.naturalVersion).toBe("这件事也太离谱了。");
  });
  test("same first text replays persisted natural coaching without grading again",async()=>{
    const h=harness();const input={taskId:task,responseChinese:"这也太离谱了。"};await h.services.attemptService.submitOriginal(user,input);const replay=await h.services.attemptService.submitOriginal(user,input);
    expect(h.complete).toHaveBeenCalledTimes(1);expect(replay.coaching?.naturalRevisionChinese).toBe("这件事也太离谱了。");
  });
  test("different first text returns authoritative conflict feedback before a model call",async()=>{
    const h=harness();await h.services.attemptService.submitOriginal(user,{taskId:task,responseChinese:"这也太离谱了。"});await expect(h.services.attemptService.submitOriginal(user,{taskId:task,responseChinese:"那个安排太离谱了。"})).rejects.toMatchObject({code:"FIRST_ANSWER_EXISTS",details:{roundState:{firstAnswer:{text:"这也太离谱了。"}}}});expect(h.complete).toHaveBeenCalledTimes(1);
  });
  test("opening examples while a model is running uses the transaction's final assistance",async()=>{
    const h=harness();h.complete.mockImplementationOnce(async()=>{h.setState({...h.getState(),examplesOpened:true});return {...dimensions};});const result=await h.services.attemptService.submitOriginal(user,{taskId:task,responseChinese:"这也太离谱了。"});expect(result.attempt.evaluation).toMatchObject({independentUse:false,assistanceLevel:"model_answer"});
  });
});
