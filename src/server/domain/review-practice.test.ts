import { expect, test, vi } from "vitest";
import { createReviewPracticeService } from "./review-practice";
import { createTransferScenarioFixtureGateway } from "@/server/ai/prompts/transfer-scenario.v1";
import { ModelGatewayError } from "@/server/ai/provider";
import type { DueTransfer } from "@/contracts/review-practice";

const owner="41000000-0000-4000-8000-000000000001", review="41000000-0000-4000-8000-000000000002",task="41000000-0000-4000-8000-000000000003",request="41000000-0000-4000-8000-000000000004";
const at="2026-11-01T12:00:00.000Z";
const card={meaningHere:"Outrageous.",useItWhen:"React to something extreme.",comparedWith:"很奇怪 is neutral.",howItFits:"Use this phrase in a clause.",toneAndWho:"Casual with friends.",watchOut:null,examples:null,functionCategories:["react"],usageSettings:["casual_chat"],suitability:"expression"};
function harness(){
 const prepared={status:"ready",id:task,reviewTaskId:review,scenarioVersion:1,scenarioFingerprint:"a".repeat(64),reviewState:{identity:{taskId:task,scenarioVersion:1,scenarioFingerprint:"a".repeat(64)},firstAnswer:null,regenerated:false}} as DueTransfer;
 const context={userId:owner,reviewTaskId:review,userExpressionId:task,sourceId:task,status:"pending",dueAt:"2026-10-31T00:00:00.000Z",masteryState:"tried",targetExpression:"太离谱了",card,prepared:null as DueTransfer|null,history:["朋友问昨天的午餐怎么那么贵？"],lastTransferType:null};
 const repository={read:vi.fn(async()=>context),lookupPreparation:vi.fn(async()=>null),resolveActiveGatewayPin:vi.fn(async()=>({configId:owner,revision:1,fingerprint:"b".repeat(64)})),claim:vi.fn(async()=>({kind:"claimed",requestId:request,token:task,expectedVersion:0,leaseExpiresAt:"2026-11-01T12:05:00.000Z"})),publish:vi.fn(async()=>prepared),fail:vi.fn(async()=>true)};
 const fixture=createTransferScenarioFixtureGateway();const complete=vi.fn(fixture.complete.bind(fixture));const gateway={...fixture,complete:complete as typeof fixture.complete};
 const gatewayResolver={resolve:vi.fn(async()=>gateway)};
 const service=createReviewPracticeService({repository:repository as never,gatewayResolver,fixtureGateway:gateway,ci:false,now:()=>at,id:()=>request});
 return {repository,context,prepared,gateway,complete,gatewayResolver,service};
}
test("prepared GET returns before gateway lookup or generation claim",async()=>{
 const h=harness();h.context.prepared=h.prepared;h.repository.resolveActiveGatewayPin.mockResolvedValue(null as never);
 expect(await h.service.ensure(owner,review,{})).toBe(h.prepared);
 expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled();expect(h.repository.claim).not.toHaveBeenCalled();expect(h.complete).not.toHaveBeenCalled();
});
test("setup then return can prepare without a new retry UUID because missing gateway never cached a failed cycle",async()=>{
 const h=harness();h.repository.resolveActiveGatewayPin.mockResolvedValueOnce(null as never);
 await expect(h.service.ensure(owner,review,{})).rejects.toMatchObject({code:"GATEWAY_REQUIRED"});
 expect(h.repository.claim).not.toHaveBeenCalled();expect(h.repository.fail).not.toHaveBeenCalled();
 expect(await h.service.ensure(owner,review,{})).toBe(h.prepared);
 expect(h.complete).toHaveBeenCalledTimes(1);
 expect(h.complete.mock.calls[0][2]).toMatchObject({maxTokens:400,timeoutMs:20000});
});
test("one persisted generation cycle has at most four format attempts and publishes nothing on exhaustion",async()=>{
 const h=harness();h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_OUTPUT_INVALID","wire_schema"));
 await expect(h.service.ensure(owner,review,{retryRequestId:request})).rejects.toMatchObject({code:"PROVIDER_OUTPUT_INVALID",details:{operation:{requestId:request,state:"failed",kind:"prepare"}}});
 expect(h.complete).toHaveBeenCalledTimes(4);expect(h.repository.fail).toHaveBeenCalledTimes(1);expect(h.repository.publish).not.toHaveBeenCalled();
});
test("active preparation polling joins the same request and never calls the model",async()=>{
 const h=harness();h.repository.claim.mockResolvedValue({kind:"pending",requestId:request} as never);
 expect(await h.service.ensure(owner,review,{retryRequestId:request})).toEqual({status:"preparing",reviewTaskId:review,requestId:request,retryAfterMs:1000});
 expect(h.complete).not.toHaveBeenCalled();
});
test("failed regeneration keeps the old prepared question and never consumes allowance in a separate write",async()=>{
 const h=harness();h.context.prepared=h.prepared;h.repository.claim.mockResolvedValue({kind:"claimed",requestId:request,token:task,expectedVersion:1,leaseExpiresAt:"2026-11-01T12:05:00.000Z"} as never);
 h.complete.mockRejectedValue(new ModelGatewayError("PROVIDER_UNAVAILABLE","transport"));
 await expect(h.service.regenerate(owner,review,{...h.prepared.reviewState.identity,requestId:request})).rejects.toMatchObject({code:"PROVIDER_UNAVAILABLE"});
 expect(h.context.prepared).toBe(h.prepared);expect(h.repository.publish).not.toHaveBeenCalled();expect(h.complete).toHaveBeenCalledTimes(1);
});
test("plain reload replays a failed cycle without model calls, and only a fresh explicit retry starts another",async()=>{
 const h=harness();h.repository.lookupPreparation.mockResolvedValueOnce({kind:"failed",requestId:request,code:"PROVIDER_OUTPUT_INVALID"} as never);
 await expect(h.service.ensure(owner,review,{})).rejects.toMatchObject({code:"PROVIDER_OUTPUT_INVALID"});
 expect(h.repository.claim).not.toHaveBeenCalled();expect(h.complete).not.toHaveBeenCalled();expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled();
 expect(await h.service.ensure(owner,review,{retryRequestId:owner})).toBe(h.prepared);
 expect(h.repository.claim).toHaveBeenCalledTimes(1);expect(h.complete).toHaveBeenCalledTimes(1);
});
test("a late background job observes a foreground failed cycle without opening a fifth format attempt",async()=>{
 const h=harness(),job={jobId:owner,attemptCount:1,leaseExpiresAt:"2026-11-01T12:05:00.000Z"};
 h.repository.lookupPreparation.mockResolvedValue({kind:"failed",requestId:request,code:"PROVIDER_OUTPUT_INVALID"} as never);
 await expect(h.service.prepareInBackground(owner,review,job)).rejects.toMatchObject({code:"PROVIDER_OUTPUT_INVALID",details:{operation:{kind:"prepare",requestId:job.jobId,state:"failed"}}});
 expect(h.repository.lookupPreparation).toHaveBeenCalledWith(owner,review,"prepare",null,{job},at);
 expect(h.repository.claim).not.toHaveBeenCalled();expect(h.complete).not.toHaveBeenCalled();expect(h.gatewayResolver.resolve).not.toHaveBeenCalled();
});
test.each(["prepare","regenerate"])("%s commit with a lost publication response replays the stored winner",async kind=>{
 const h=harness();if(kind==="regenerate")h.context.prepared=h.prepared;
 const committed={...h.prepared,scenarioVersion:2,reviewState:{...h.prepared.reviewState,identity:{...h.prepared.reviewState.identity,scenarioVersion:2}}};
 h.repository.publish.mockRejectedValue(new Error("publication response lost"));h.repository.fail.mockResolvedValue(false);
 h.repository.lookupPreparation.mockResolvedValueOnce(null).mockResolvedValueOnce({kind:"ready",prepared:committed} as never);
 const result=kind==="prepare"?await h.service.ensure(owner,review,{}):await h.service.regenerate(owner,review,{...h.prepared.reviewState.identity,requestId:request});
 expect(result).toBe(committed);expect(h.complete).toHaveBeenCalledTimes(1);
});
test.each([false,true])("unknown publication/failure acknowledgement never authorizes a fresh cycle (failure throws=%s)",async throws=>{
 const h=harness();h.repository.publish.mockRejectedValue(new Error("unknown commit outcome"));
 if(throws)h.repository.fail.mockRejectedValue(new Error("failure acknowledgement lost"));else h.repository.fail.mockResolvedValue(false);
 await expect(h.service.ensure(owner,review,{})).rejects.toMatchObject({code:"INTERNAL_ERROR",details:undefined});
 expect(h.complete).toHaveBeenCalledTimes(1);
});
test("successful regenerate same-ID replay accepts its original identity before rejecting a stale new operation",async()=>{
 const h=harness();const original={...h.prepared.reviewState.identity,requestId:request};
 const winner={...h.prepared,scenarioVersion:2,reviewState:{...h.prepared.reviewState,regenerated:true,identity:{...h.prepared.reviewState.identity,scenarioVersion:2}}};
 h.context.prepared=winner;h.repository.lookupPreparation.mockResolvedValue({kind:"ready",prepared:winner} as never);
 expect(await h.service.regenerate(owner,review,original)).toBe(winner);expect(h.complete).not.toHaveBeenCalled();expect(h.repository.resolveActiveGatewayPin).not.toHaveBeenCalled();
});
