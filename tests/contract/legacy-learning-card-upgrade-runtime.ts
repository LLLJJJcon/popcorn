/** Real isolated59a repository/service/runtime integration, deterministic model only. */
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createLegacyLearningCardUpgradeRuntime } from "../../src/server/legacy-learning-card-upgrade-runtime";
import { createLegacyLearningCardUpgradeRepository } from "../../src/server/repositories/legacy-learning-card-upgrade-repository";
import { createLegacyLearningCardUpgradeService } from "../../src/server/domain/legacy-learning-card-upgrade";
import { createAnalyzeMarkedExpressionsFixtureGateway } from "../../src/server/ai/prompts/analyze-saved-item.v3";
import type { StructuredJsonGateway,StructuredJsonCompletionOptions } from "../../src/server/ai/structured-json-gateway";
import type { Database } from "../../src/types/database.generated";

const owner="59a00000-0000-4000-8000-000000000001";
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).port,"54331");
const client=createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const planned=await createLegacyLearningCardUpgradeRuntime({ci:true}).plan(owner,{limit:200});
const row=planned.items.find(item=>item.status==="eligible"&&item.target.source.kind==="source_occurrence");
assert.ok(row?.status==="eligible");
const request={...row.target,requestId:"59af0000-0000-4000-8000-000000000099"};
const ci=process.env.CI;
try{process.env.CI="true";await assert.rejects(createLegacyLearningCardUpgradeRuntime().upgrade(owner,request),{code:"GATEWAY_REQUIRED"});}
finally{if(ci===undefined)delete process.env.CI;else process.env.CI=ci;}
console.log("PASS actual default runtime ignores global CI and requires owner gateway before claim");
const repository=createLegacyLearningCardUpgradeRepository(client);
assert.equal(await repository.lookup(owner,request,new Date().toISOString()),null);
const tables=["attempts","mastery_events","user_expressions","review_tasks","practice_tasks","saved_items","saved_item_highlights","generated_artifacts","knowledge_jobs","video_sources","video_snapshots","transcript_segments","expression_occurrences"];
const snapshot=async(names=tables)=>Promise.all(names.map(async table=>{const result=await client.from(table as "attempts").select("*").eq("user_id",owner).order("id");if(result.error)throw result.error;return result.data;}));
const before=await snapshot();let calls=0,lookups=0;
const fixture=createAnalyzeMarkedExpressionsFixtureGateway();
const gateway:StructuredJsonGateway={model:fixture.model,async complete<T>(version:string,prompt:string,options:StructuredJsonCompletionOptions<T>):Promise<T>{calls++;return fixture.complete(version,prompt,options);}};
const service=createLegacyLearningCardUpgradeService({repository,ci:true,fixtureGateway:gateway,gatewayResolver:{resolve:async()=>{lookups++;throw new Error("fixture must not resolve a real gateway");}},now:()=>new Date().toISOString()});
const results=await Promise.all([service.upgrade(owner,request),service.upgrade(owner,request)]);
assert.ok(results.some(item=>item.status==="applied"));
const replay=await service.upgrade(owner,request);assert.equal(replay.status,"applied");assert.equal(calls,1);assert.equal(lookups,0);
assert.deepEqual(await snapshot(),before);
console.log("PASS actual concurrent coordinator uses one model cycle and changes no protected graph");
const official=await snapshot(tables.slice(0,5));
assert.equal(request.source.kind,"source_occurrence");
if(request.source.kind!=="source_occurrence")throw new Error("expected an original source occurrence");
const deleted=await client.rpc("delete_video_source",{p_user_id:owner,p_video_source_id:request.source.sourceId,p_mode:"remove_source_keep_evidence",p_now:new Date().toISOString()});if(deleted.error)throw deleted.error;
assert.deepEqual(await service.upgrade(owner,request),replay);assert.equal(calls,1);assert.deepEqual(await snapshot(tables.slice(0,5)),official);
console.log("PASS source-deleted upgrade receipt replays with zero extra model calls and unchanged official history");
