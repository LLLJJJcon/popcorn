import { expect, test, vi } from "vitest";
import { createExpressionDeletionHandlers } from "./delete-expression";
const USER="11111111-1111-4111-8111-111111111111", ITEM="22222222-2222-4222-8222-222222222222", ARTIFACT="33333333-3333-4333-8333-333333333333";
function fixture() {
  const repository={removeSaved:vi.fn(async()=>"legacy:高得要命"), removeVault:vi.fn(async()=>true)};
  const authenticate=vi.fn(async()=>({ok:true as const,userId:USER}));
  return {repository,authenticate,handlers:createExpressionDeletionHandlers({repository,authenticate,appUrl:"http://localhost:3000",requestId:()=>"r"})};
}
const request=(origin="http://localhost:3000")=>new Request("http://localhost:3000/api",{method:"DELETE",headers:{origin}});
test("removes only the owned selected Saved expression and returns its stable key",async()=>{
 const f=fixture();const result=await f.handlers.saved(request(),ITEM,ARTIFACT,"1");
 expect(result.status).toBe(200);expect(f.repository.removeSaved).toHaveBeenCalledExactlyOnceWith(USER,ITEM,ARTIFACT,1);
 expect(await result.json()).toMatchObject({ok:true,data:{deleted:true,key:"legacy:高得要命"}});
});
test("rejects cross-origin and invalid indices before touching storage",async()=>{
 const f=fixture();expect((await f.handlers.saved(request("https://evil.example"),ITEM,ARTIFACT,"1")).status).toBe(403);
 expect((await f.handlers.saved(request(),ITEM,ARTIFACT,"-1")).status).toBe(400);
 expect((await f.handlers.saved(request(),ITEM,ARTIFACT,"1e0")).status).toBe(400);
 expect(f.repository.removeSaved).not.toHaveBeenCalled();
});
test("requires authentication and returns 404 for another owner's Vault entry",async()=>{
 const f=fixture();f.authenticate.mockResolvedValueOnce({ok:false,reason:"missing"} as never);
 expect((await f.handlers.vault(request(),ITEM)).status).toBe(401);expect(f.repository.removeVault).not.toHaveBeenCalled();
 f.repository.removeVault.mockResolvedValueOnce(false);
 expect((await f.handlers.vault(request(),ITEM)).status).toBe(404);
});
test("deletion failures are retryable without exposing database errors",async()=>{
 const f=fixture();f.repository.removeVault.mockRejectedValueOnce(new Error("private secret"));
 const result=await f.handlers.vault(request(),ITEM);expect(result.status).toBe(500);
 const body=await result.text();expect(body).not.toContain("private secret");expect(JSON.parse(body).error.retryable).toBe(true);
});
