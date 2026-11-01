import { expect,test,vi } from "vitest";
import { createProcessorHandlers,createSupabaseDurableJobStore } from "@/server/jobs/process-jobs";
import { KnowledgeJobSchema } from "@/contracts/knowledge";
import { leaseJob,nextJobFailure } from "@/server/domain/lease-job";
import { POST } from "@/app/api/internal/jobs/process/route";
const now="2026-11-01T00:00:00.000Z";
const job=KnowledgeJobSchema.parse({id:"59600000-0000-4000-8000-000000000001",userId:"59600000-0000-4000-8000-000000000002",sourceId:"59600000-0000-4000-8000-000000000003",savedItemId:null,type:"prepare_transfer_task",dedupeKey:"a".repeat(64),status:"leased",attemptCount:1,nextAttemptAt:null,leaseExpiresAt:"2026-11-01T00:05:00.000Z",lastErrorCode:null,createdAt:now,updatedAt:now});
test("review preparation never gets a second durable model cycle",()=>{
 expect(nextJobFailure(job,"PROVIDER_OUTPUT_INVALID",now).status).toBe("terminal_failed");
 expect(leaseJob(KnowledgeJobSchema.parse({...job,leaseExpiresAt:now}),now).kind).toBe("exhausted");
});
test("registry wires the dedicated handler and its store uses the exact owner lease fence",async()=>{
 const rpc=vi.fn(async()=>({data:true,error:null}));const store=createSupabaseDurableJobStore({rpc} as never);
 const handlers=createProcessorHandlers({store,transcriptProvider:{} as never,learningProviderResolver:{} as never,analysisGatewayResolver:{} as never,reviewPracticeService:{prepareInBackground:vi.fn()} as never});
 expect(handlers.prepare_transfer_task).toBeTypeOf("function");
 await expect(store.finishReviewPreparationJob!(job.userId,job as never,{status:"terminal_failed",errorCode:"PROVIDER_OUTPUT_INVALID"},now)).resolves.toBe(true);
 expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_review_preparation_job",{p_user_id:job.userId,p_job_id:job.id,p_expected_attempt_count:1,p_expected_lease_expires_at:job.leaseExpiresAt,p_status:"terminal_failed",p_result:{errorCode:"PROVIDER_OUTPUT_INVALID"},p_now:now});
});
test("processor authentication remains available without the unrelated transcript provider key",async()=>{
 const original={...process.env};
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://supabase.example.test";process.env.SUPABASE_SERVICE_ROLE_KEY="inert-service-role";process.env.INTERNAL_JOB_SECRET="inert-job-secret";delete process.env.SUPADATA_API_KEY;
  expect((await POST(new Request("https://popcorn.test",{method:"POST"}))).status).toBe(401);
 }finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
});
