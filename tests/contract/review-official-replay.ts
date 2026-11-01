/** Actual source-deleted official replay, for the isolated597* harness only. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createReviewPracticeRepository } from "../../src/server/repositories/review-practice-repository";
import { createReviewCompletionService } from "../../src/server/domain/review-completion";
import type { StructuredJsonGateway } from "../../src/server/ai/structured-json-gateway";
import type { Database } from "../../src/types/database.generated";
const [owner,review]=process.argv.slice(2);
assert.match(owner??"",/^59700000-0000-4000-8000-00000000000[12]$/);
assert.match(review??"",/^[a-f0-9-]{36}$/);
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).port,"54331");
const client=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const repository=createReviewPracticeRepository(client,{findDueMaterial:async()=>{throw new Error("replay cannot read display material");}});
const state=await repository.completionState(owner,review);assert.ok(state?.firstAnswer);
const raw=await client.rpc("read_review_practice_context",{p_user_id:owner,p_review_task_id:review});
assert.equal((raw.data as {sense:{video_source_id:string|null}}).sense.video_source_id,null);
const snapshot=async()=>Promise.all(["attempts","mastery_events","user_expressions","review_tasks"].map(async table=>{
 const result=await client.from(table as "attempts").select("*").eq("user_id",owner).order("id");if(result.error)throw result.error;return result.data;
}));
const before=await snapshot();let lookups=0,calls=0;
repository.resolveActiveGatewayPin=async()=>{lookups++;throw new Error("replay cannot resolve gateway");};
const gateway:StructuredJsonGateway={model:"fixture/unreachable",async complete<T>():Promise<T>{calls++;throw new Error("replay cannot call model");}};
const service=createReviewCompletionService({repository,ci:false,fixtureGateway:gateway,gatewayResolver:{resolve:async()=>{lookups++;return gateway;}},now:()=>"2026-11-01T00:04:00.000Z"});
const result=await service.complete(owner,review,{...state.identity,requestId:"597f0000-0000-4000-8000-000000000003",responseChinese:state.firstAnswer.responseChinese});
assert.equal(result.attemptId,state.firstAnswer.attemptId);assert.deepEqual(result.evaluation,state.firstAnswer.evaluation);
assert.equal(lookups,0);assert.equal(calls,0);assert.deepEqual(await snapshot(),before);
console.log("PASS actual source-deleted official replay: zero gateway/model calls and unchanged official graph");
