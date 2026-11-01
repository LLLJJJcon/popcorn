import { expect,test,vi } from "vitest";
import { createLegacyLearningCardUpgradeRepository } from "@/server/repositories/legacy-learning-card-upgrade-repository";
const owner="59900000-0000-4000-8000-000000000001",sense="59900000-0000-4000-8000-000000000002",hash="a".repeat(64);
const context={ownerId:owner,senseId:sense,userExpressionId:sense,expression:"高得要命",originalSavedItemId:null,beforeHash:hash,canonicalCard:null,modernFieldsEmpty:true,sourceState:"deleted",existingCard:null,sources:[],nextSourceOffset:null};
const request={requestId:owner,senseId:sense,expectedBeforeHash:hash,expectedEvidenceHash:hash,source:{kind:"source_occurrence" as const,sourceId:sense,snapshotId:sense,occurrenceId:sense}};
test("repository accepts a null deleted display source without inventing a source/card",async()=>{
 const rpc=vi.fn(async()=>({data:context,error:null}));const repo=createLegacyLearningCardUpgradeRepository({rpc} as never);
 expect(await repo.readContext(owner,sense)).toEqual({...context,nextSourceOffset:undefined});
 expect(rpc).toHaveBeenCalledExactlyOnceWith("read_legacy_learning_card_upgrade_context",{p_user_id:owner,p_sense_id:sense,p_source_offset:0,p_source_limit:200});
});
test("RPC projection cannot switch the requested owner or sense",async()=>{
 const rpc=vi.fn(async()=>({data:{...context,ownerId:sense},error:null}));const repo=createLegacyLearningCardUpgradeRepository({rpc} as never);
 await expect(repo.readContext(owner,sense)).rejects.toMatchObject({code:"NOT_FOUND"});
});
test("receipt replay is source-free and uses the exact opaque request payload",async()=>{
 const outcome={status:"failed",requestId:request.requestId,senseId:sense,code:"PROVIDER_OUTPUT_INVALID"};
 const rpc=vi.fn(async()=>({data:outcome,error:null}));const repo=createLegacyLearningCardUpgradeRepository({rpc} as never);
 expect(await repo.lookup(owner,request,"2026-11-01T00:00:00.000Z")).toEqual(outcome);
 expect(rpc).toHaveBeenCalledExactlyOnceWith("lookup_legacy_learning_card_upgrade",{p_user_id:owner,p_input:request,p_now:"2026-11-01T00:00:00.000Z"});
});
test("source projection reads beyond200 with opaque hashes and bounded pages",async()=>{
 const source=(n:number)=>({sourceId:owner,snapshotId:sense,occurrenceId:`59910000-0000-4000-8000-${String(n).padStart(12,"0")}`,savedItemId:null,transcriptHash:hash,evidenceHash:hash,evidenceText:"这里高得要命。",segmentIds:["original"],startSeconds:1,endSeconds:2,createdAt:"2026-11-01T00:00:00+00:00",segments:[{stableId:"original",position:0,text:"这里高得要命。",startSeconds:1,endSeconds:2,target:true}]});
 const rpc=vi.fn(async(_name:string,args:Record<string,unknown>)=>({data:{...context,sources:args.p_source_offset===0?Array.from({length:200},(_,i)=>source(i)): [source(200)],nextSourceOffset:args.p_source_offset===0?200:null},error:null}));
 const repo=createLegacyLearningCardUpgradeRepository({rpc} as never);
 expect((await repo.readContext(owner,sense))?.sources).toHaveLength(201);expect(rpc).toHaveBeenCalledTimes(2);
 expect(rpc.mock.calls.map(call=>call[1].p_source_limit)).toEqual([200,200]);
});
test("planning bounds context read concurrency while retaining every sense",async()=>{
 let active=0,peak=0;
 const ids=Array.from({length:9},(_,n)=>`59920000-0000-4000-8000-${String(n).padStart(12,"0")}`);
 const rpc=vi.fn(async(name:string,args:Record<string,unknown>)=>{
  if(name==="page_legacy_learning_card_upgrade_contexts")return {data:{senseIds:ids,nextCursor:null},error:null};
  active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
  return {data:{...context,senseId:args.p_sense_id},error:null};
 });
 const result=await createLegacyLearningCardUpgradeRepository({rpc} as never).pageContexts(owner,{limit:200});
 expect(result.items.map(item=>item.senseId)).toEqual(ids);expect(peak).toBe(4);
});
