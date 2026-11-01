import { expect, test, vi } from "vitest";
import { createCandidateHttpHandlers, createCandidateService } from "./confirm-candidate";
import type { ExpressionRepository, CandidateSourceContext } from "@/server/repositories/expression-repository";
const uid="10000000-0000-4000-8000-000000000001", sid="20000000-0000-4000-8000-000000000001", aid="30000000-0000-4000-8000-000000000001", jid="40000000-0000-4000-8000-000000000001";
const highlight={id:"50000000-0000-4000-8000-000000000001",savedItemId:sid,startSegmentId:"s1",endSegmentId:"s1",startOffset:2,endOffset:6,text:"高得要命",status:"active" as const,origin:"user" as const,reasonEn:null};
function source(overrides:Partial<CandidateSourceContext>={}):CandidateSourceContext {return {userId:uid,sourceId:aid,savedItemId:sid,snapshotId:aid,transcriptHash:"a".repeat(64),youtubeVideoId:"dQw4w9WgXcQ",canonicalUrl:"https://www.youtube.com/watch?v=dQw4w9WgXcQ",artifact:null,highlights:[highlight],gatewayAvailable:true,...overrides};}
function setup(value:CandidateSourceContext){const repo:ExpressionRepository={read:vi.fn(async()=>value),readAnalysisJobStatus:vi.fn(async()=>({jobId:jid,status:"leased" as const,lastErrorCode:null}))};const registrar={register:vi.fn(async()=>({jobId:jid,status:"pending",created:true}))};return {repo,registrar,handlers:createCandidateHttpHandlers({authenticate:async()=>({ok:true,userId:uid}),service:createCandidateService(repo,registrar,()=>"2026-11-01T00:00:00Z"),appUrl:"https://popcorn.example",requestId:()=>"request"})};}
test("Analyze accepts no body and registers only selected unanalyzed highlight IDs",async()=>{const {handlers,registrar}=setup(source());const response=await handlers.post(new Request("https://popcorn.example/api",{method:"POST",headers:{Origin:"https://popcorn.example"}}),sid);expect(response.status).toBe(202);expect(registrar.register).toHaveBeenCalledWith(expect.objectContaining({promptVersion:"analyze-saved-item-v3",highlightIds:[highlight.id]}));});
test("no marks is a specific nothing-to-analyze conflict",async()=>{const {handlers,registrar}=setup(source({highlights:[]}));const response=await handlers.post(new Request("https://popcorn.example/api",{method:"POST",headers:{Origin:"https://popcorn.example"}}),sid);expect(response.status).toBe(409);expect((await response.json()).error.code).toBe("NOTHING_TO_ANALYZE");expect(registrar.register).not.toHaveBeenCalled();});
test("GET recovers an active analysis without the browser remembering its job ID",async()=>{const {handlers}=setup(source({latestJob:{jobId:jid,status:"leased" as const,lastErrorCode:null}}));const response=await handlers.get(new Request("https://popcorn.example/api"),sid);expect((await response.json()).data).toMatchObject({state:"processing",jobId:jid,highlightStates:[{highlightId:highlight.id,status:"pending"}]});});
test("ready-to-analyze is idle instead of asking to configure an active gateway",async()=>{const {handlers}=setup(source());const response=await handlers.get(new Request("https://popcorn.example/api"),sid);expect((await response.json()).data).toEqual({state:"idle",highlightStates:[]});});
test("a second Analyze while a job is active reuses it with created false", async () => {
  const { handlers, registrar } = setup(source({ latestJob: { jobId: jid, status: "leased", lastErrorCode: null } }));
  const response = await handlers.post(new Request("https://popcorn.example/api", { method: "POST", headers: { Origin: "https://popcorn.example" } }), sid);
  expect(response.status).toBe(202);
  expect((await response.json()).data).toMatchObject({ state: "processing", created: false, jobId: jid });
  expect(registrar.register).not.toHaveBeenCalled();
});
test("Analyze accepts a zero-byte readable stream from the Next route adapter", async () => {
  const { handlers, registrar } = setup(source());
  const emptyBody = new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } });
  const request = new Request("https://popcorn.example/api", {
    method: "POST", headers: { Origin: "https://popcorn.example", "Content-Type": "application/json" },
    body: emptyBody, duplex: "half",
  } as RequestInit & { duplex: "half" });
  expect(request.body).not.toBeNull();
  const response = await handlers.post(request, sid);
  expect(response.status).toBe(202);
  expect(registrar.register).toHaveBeenCalledOnce();
});

test("an empty stream still enforces media type and declared body bounds", async () => {
  for (const headers of [{ "Content-Type": "text/plain" }, { "Content-Type": "application/json", "Content-Length": "257" }]) {
    const { handlers, registrar } = setup(source());
    const response = await handlers.post(new Request("https://popcorn.example/api", {
      method: "POST", headers: { Origin: "https://popcorn.example", ...headers },
      body: new ReadableStream<Uint8Array>({ start(controller) { controller.close(); } }), duplex: "half",
    } as RequestInit & { duplex: "half" }), sid);
    expect(response.status).toBe(400);
    expect(registrar.register).not.toHaveBeenCalled();
  }
});
