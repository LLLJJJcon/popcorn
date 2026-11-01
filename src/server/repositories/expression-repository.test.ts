import { expect, test, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { createSupabaseExpressionRepository } from "./expression-repository";

const userId="10000000-0000-4000-8000-000000000001",savedId="10000000-0000-4000-8000-000000000002",artifactId="10000000-0000-4000-8000-000000000003",expressionId="10000000-0000-4000-8000-000000000004";
test("candidate recovery includes current archived Vault state without rewriting artifacts",async()=>{
 const card={expression:"太离谱了",englishMeaning:"Outrageous.",englishExplanation:"React to something unreasonable.",tone:"Casual",communicativeFunction:"React",register:"Casual",evidenceText:"这太离谱了。",segmentIds:["seg"],startSeconds:1,endSeconds:2,confidence:1};
 const content={candidates:[card]};
 const rows:Record<string,unknown>={saved_items:{id:savedId,user_id:userId,video_source_id:userId,snapshot_id:userId,youtube_video_id:"dQw4w9WgXcQ"},video_sources:{canonical_url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ"},video_snapshots:{transcript_hash:"a".repeat(64)},generated_artifacts:{id:artifactId,user_id:userId,video_source_id:userId,saved_item_id:savedId,artifact_type:"saved_item_analysis",prompt_version:"analyze-saved-item-v1",content},saved_item_highlights:[],knowledge_jobs:null,user_model_gateway_configs:null};
 const rpc=vi.fn(async()=>({data:[{candidate_key:`l:${savedId}:${artifactId}:0`,task_id:null,round_number:null,status:"vault_removed",user_expression_id:expressionId}],error:null}));
 const client={rpc,from:(table:string)=>{const result={data:rows[table],error:null};const query={select:()=>query,eq:()=>query,in:()=>query,order:()=>query,limit:()=>query,maybeSingle:async()=>result,then:(resolve:(value:typeof result)=>unknown)=>Promise.resolve(result).then(resolve)};return query;}};
 const source=await createSupabaseExpressionRepository(client as unknown as SupabaseClient<Database>).read(userId,savedId);
 expect(source?.artifact?.content).toMatchObject({candidates:[{practiceState:{status:"promoted",userExpressionId:expressionId,removedFromVault:true}}]});
 expect(content).toEqual({candidates:[card]});
 expect(rpc).toHaveBeenCalledWith("get_practice_candidate_projection",{p_user_id:userId,p_candidate_keys:[`l:${savedId}:${artifactId}:0`]});
});
