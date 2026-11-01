import { expect,test,vi } from "vitest";
import { createReviewPracticeRepository } from "@/server/repositories/review-practice-repository";
import { createReviewCompletionRepository } from "@/server/repositories/review-completion-repository";
const user="59300000-0000-4000-8000-000000000001",review="59300000-0000-4000-8000-000000000002",task="59300000-0000-4000-8000-000000000003",expression="59300000-0000-4000-8000-000000000004",source="59300000-0000-4000-8000-000000000005",sense="59300000-0000-4000-8000-000000000006";
const at="2026-11-01T00:00:00.000Z";
const card={meaningHere:"Outrageous.",useItWhen:"React to something extreme.",comparedWith:"很奇怪 is neutral.",howItFits:"Use this phrase in a clause.",toneAndWho:"Casual with friends.",watchOut:null,examples:null,functionCategories:["react"],usageSettings:["casual_chat"],suitability:"expression"};
function harness(){
 const situation={situationZh:"同事说普通午餐一份两百元，问你怎么看？",situationEn:"A colleague says lunch costs two hundred yuan and asks what you think.",interlocutor:"同事",taskEn:"React to the high lunch price.",targetFunction:"react",targetSetting:"work_school"};
 const material={task:{id:task,userExpressionId:expression,kind:"due_practice",nativeLanguage:"en",targetLanguage:"zh-CN",targetExpression:"太离谱了",promptChinese:situation.situationZh,instructionsEnglish:situation.taskEn,goalEnglish:"React naturally.",createdAt:at,dueAt:at,situation},masteryState:"tried",learningCard:card,examplesOpened:false,source:{videoTitle:"Fixture",youtubeUrl:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",evidenceText:"太离谱了。",startSeconds:1},expression:{englishMeaning:"Outrageous.",englishExplanation:"React to something extreme.",tone:"Casual.",communicativeFunction:"react",register:"casual_chat"}};
 const raw={review:{id:review,user_id:user,user_expression_id:expression,mastery_state:"tried",status:"pending",due_at:at,expression_revealed_at:null,examples_opened_at:null,completed_attempt_id:null,completed_at:null},expression:{id:expression,user_id:user,expression_sense_id:sense,mastery_state:"tried"},sense:{id:sense,user_id:user,video_source_id:source,expression_text:"太离谱了"},task:{id:task,user_id:user,user_expression_id:expression,review_task_id:review,kind:"due_practice",target_expression:"太离谱了",prompt_chinese:situation.situationZh,instructions_english:situation.taskEn,goal_english:"React naturally.",created_at:at,due_at:at,situation_en:situation.situationEn,interlocutor:situation.interlocutor,task_en:situation.taskEn,target_function:"react",target_setting:"work_school",transfer_type:"near",scenario_metadata_mode:"modern",scenario_source:"model",scenario_version:1,scenario_fingerprint:"a".repeat(64),regenerated:false},canonicalCard:card as unknown,linkedCard:{...card,expression:"太离谱了",meaningHere:"Linked older meaning."} as unknown,history:["朋友问你昨晚的价格怎么看？"],lastTransferType:null,officialAttempt:null as unknown,receipt:null as unknown,latestRevision:null,masteryEvents:[] as unknown};
 const rpc=vi.fn(async()=>({data:raw,error:null}));const materials={findDueMaterial:vi.fn(async()=>material)};
 return {raw,rpc,materials,repository:createReviewPracticeRepository({rpc} as never,materials as never)};
}
test("valid canonical modern metadata wins over linked historical card",async()=>{const h=harness();const ctx=await h.repository.read(user,review);expect(ctx?.card?.meaningHere).toBe("Outrageous.");expect(ctx?.prepared?.material.learningCard?.meaningHere).toBe("Outrageous.");expect(h.rpc).toHaveBeenCalledExactlyOnceWith("read_review_practice_context",{p_user_id:user,p_review_task_id:review});});
test("missing canonical metadata recovers only the exact SQL-linked owned modern card",async()=>{const h=harness();h.raw.canonicalCard=null;const ctx=await h.repository.read(user,review);expect(ctx?.card?.meaningHere).toBe("Linked older meaning.");});
test("ready legacy text survives absent modern metadata without invented labels",async()=>{const h=harness();h.raw.canonicalCard=null;h.raw.linkedCard=null;h.raw.task.scenario_metadata_mode=null as never;h.raw.task.target_function=null as never;h.raw.task.target_setting=null as never;h.raw.task.transfer_type=null as never;const ctx=await h.repository.read(user,review);expect(ctx?.card).toBeNull();expect(ctx?.prepared).toMatchObject({promptChinese:h.raw.task.prompt_chinese,metadataMode:"legacy",targetFunction:null,targetSetting:null,transferType:null});});
test("even a service RPC projection cannot cross the requested owner graph",async()=>{const h=harness();h.raw.sense.user_id=source;expect(await h.repository.read(user,review)).toBeNull();expect(h.materials.findDueMaterial).not.toHaveBeenCalled();});
test("private Review context retains the authoritative Vault removal flag for new-operation gates",async()=>{
 const h=harness();Object.assign(h.raw.expression,{removed_from_vault_at:at});
 expect(await h.repository.read(user,review)).toMatchObject({removedFromVault:true});
});
test("completion adopts the same complete question snapshot as the version identity when regeneration wins between reads",async()=>{
 const h=harness();h.raw.task.scenario_version=2;h.raw.task.scenario_metadata_mode=null as never;
 const oldTask={id:task,userId:user,reviewTaskId:review,userExpressionId:expression,targetExpression:"太离谱了",promptChinese:"旧题：朋友问旧价格。",instructionsEnglish:"Old instruction.",goalEnglish:"Old goal.",contextFingerprint:"f".repeat(64),dueAt:at,masteryState:"tried"};
 const base={findCompletionState:vi.fn(async()=>({status:"pending",task:oldTask,attempt:null}))};
 const repository=createReviewCompletionRepository({} as never,h.repository,base as never);
 const state=await repository.findCompletionState(user,review);
 expect(state?.task.scenarioVersion).toBe(2);
 expect(state?.task.promptChinese).toBe(h.raw.task.prompt_chinese);
 expect(state?.task.instructionsEnglish).toBe(h.raw.task.instructions_english);
 expect(state?.task.goalEnglish).toBe(h.raw.task.goal_english);
});
function completedHarness(){
 const h=harness(),attempt="59300000-0000-4000-8000-000000000007";
 h.raw.review.status="completed";h.raw.review.completed_attempt_id=attempt as never;h.raw.review.completed_at=at as never;h.raw.expression.mastery_state="reused";h.raw.sense.video_source_id=null as never;
 h.raw.officialAttempt={id:attempt,user_id:user,user_expression_id:expression,practice_task_id:task,response_chinese:"这也太离谱了。",passed:true,independent_use:true,assistance_level:"none",accuracy_score:4,accuracy_feedback_english:"Accurate.",naturalness_score:4,naturalness_feedback_english:"Natural.",contextual_fit_score:4,contextual_fit_feedback_english:"Fits.",submitted_at:at,evaluation_prompt_version:null,evaluation_model:null,evaluation_gateway_config_id:null,evaluation_gateway_revision:null,evaluation_gateway_fingerprint:null,coaching:{naturalRevisionChinese:"这个价格也太离谱了。"}} as never;
 h.raw.receipt={user_id:user,user_expression_id:expression,review_task_id:review,practice_task_id:task,attempt_id:attempt,mastery_event_id:"59300000-0000-4000-8000-000000000008",next_review_task_id:"59300000-0000-4000-8000-000000000009",prior_state:"tried",new_state:"reused",next_due_at:"2026-11-08T00:00:00.000Z",interval_days:7} as never;
 h.raw.masteryEvents=[{id:"59300000-0000-4000-8000-000000000008",user_id:user,user_expression_id:expression,attempt_id:attempt,prior_state:"tried",new_state:"reused",occurred_at:at}];
 return h;
}
test("source-deleted completed receipts restore from their official graph without display material",async()=>{
 const h=completedHarness(),attempt="59300000-0000-4000-8000-000000000007";
 const state=await h.repository.completionState(user,review);
 expect(state?.firstAnswer).toMatchObject({attemptId:attempt,submittedAt:at,coaching:{naturalRevisionChinese:"这个价格也太离谱了。"},result:{newState:"reused",intervalDays:7}});
 expect(h.materials.findDueMaterial).not.toHaveBeenCalled();
 expect(await h.repository.read(user,review)).toBeNull();
});
test("official receipt replay accepts PostgreSQL offset timestamps without changing its seven-day schedule",async()=>{
 const h=completedHarness(),submittedAt="2026-11-01T11:54:39.195+00:00";
 const attempt=h.raw.officialAttempt as Record<string,unknown>,receipt=h.raw.receipt as Record<string,unknown>;
 attempt.submitted_at=submittedAt;h.raw.review.completed_at=submittedAt as never;
 (h.raw.masteryEvents as Record<string,unknown>[])[0].occurred_at=submittedAt;
 receipt.next_due_at="2026-11-08T11:54:39.195+00:00";
 const state=await h.repository.completionState(user,review);
 expect(state?.firstAnswer?.result).toMatchObject({newState:"reused",intervalDays:7,nextDueAt:receipt.next_due_at});
 expect(Date.parse(state!.firstAnswer!.submittedAt)).toBe(Date.parse(submittedAt));
 expect(h.materials.findDueMaterial).not.toHaveBeenCalled();
});
test.each(["unsupported_provenance","missing_provenance","illegal_transition","backward_mastery","missing_event","duplicate_event","wrong_event_time"])("source-free replay preserves the old official graph rejection: %s",async kind=>{
 const h=completedHarness(),attempt=h.raw.officialAttempt as Record<string,unknown>,receipt=h.raw.receipt as Record<string,unknown>,events=h.raw.masteryEvents as Record<string,unknown>[];
 if(kind==="unsupported_provenance"){attempt.evaluation_prompt_version="unsupported-test-version";attempt.evaluation_model="";}
 if(kind==="missing_provenance")delete attempt.evaluation_prompt_version;
 if(kind==="illegal_transition"){receipt.new_state="owned";events[0].new_state="owned";h.raw.expression.mastery_state="owned";}
 if(kind==="backward_mastery")h.raw.expression.mastery_state="tried";
 if(kind==="missing_event")h.raw.masteryEvents=[];
 if(kind==="duplicate_event")h.raw.masteryEvents=[events[0],{...events[0],id:source}];
 if(kind==="wrong_event_time")events[0].occurred_at="2026-10-31T00:00:00.000Z";
 await expect(h.repository.completionState(user,review)).rejects.toMatchObject({code:"NOT_FOUND"});
 expect(h.materials.findDueMaterial).not.toHaveBeenCalled();
});
