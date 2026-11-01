import { expect,test,vi } from "vitest";
import { createReviewPracticeHttpHandlers } from "./review-practice-http";
const owner="41000000-0000-4000-8000-000000000001",review="41000000-0000-4000-8000-000000000002",request="41000000-0000-4000-8000-000000000003";
function harness(){const service={ensure:vi.fn(async()=>({status:"preparing",reviewTaskId:review,requestId:request,retryAfterMs:1000})),regenerate:vi.fn(),reveal:vi.fn(),examples:vi.fn(),revise:vi.fn()};const complete=vi.fn();return {service,complete,http:createReviewPracticeHttpHandlers({authenticate:async()=>({ok:true,userId:owner}),appUrl:"http://localhost:3103",service:service as never,complete,requestId:()=>request})};}
function get(headers:Record<string,string|undefined>,query=true){return new Request(`http://localhost:3103/api/v1/practice/due/${review}${query?`?retryRequestId=${request}`:""}`,{headers:Object.fromEntries(Object.entries(headers).filter((entry):entry is [string,string]=>typeof entry[1]==="string"))});}
test("plain GET stays compatible and active preparation uses202",async()=>{const h=harness();const response=await h.http.get(get({},false),review);expect(response.status).toBe(202);expect(response.headers.get("cache-control")).toBe("no-store");expect(h.service.ensure).toHaveBeenCalledWith(owner,review,{});});
test.each([
 {"X-Popcorn-Review-Retry":"1",Origin:"http://localhost:3103"},
 {"X-Popcorn-Review-Retry":"1",Referer:"http://localhost:3103/practice/session"},
 {"X-Popcorn-Review-Retry":"1","Sec-Fetch-Site":"same-origin"},
])("same-origin explicit retry includes no-referrer browser recovery: %j",async headers=>{const h=harness();expect((await h.http.get(get(headers),review)).status).toBe(202);expect(h.service.ensure).toHaveBeenCalledWith(owner,review,{retryRequestId:request});});
test.each([
 {},{Origin:"http://localhost:3103"},
 {"X-Popcorn-Review-Retry":"1"},
 {"X-Popcorn-Review-Retry":"1",Origin:"null","Sec-Fetch-Site":"same-origin"},
 {"X-Popcorn-Review-Retry":"1",Origin:"https://evil.example","Sec-Fetch-Site":"same-origin"},
 {"X-Popcorn-Review-Retry":"1",Origin:"http://localhost:3103","Sec-Fetch-Site":"cross-site"},
 {"X-Popcorn-Review-Retry":"1",Referer:"https://evil.example/"},
 {"X-Popcorn-Review-Retry":"1",Origin:"http://localhost:3103",Referer:"https://evil.example/"},
 {"X-Popcorn-Review-Retry":"1",Origin:"http://localhost:3103",Referer:"not a url"},
])("URL retry token without trusted same-origin proof never reaches service: %j",async headers=>{const h=harness();expect((await h.http.get(get(headers),review)).status).toBe(403);expect(h.service.ensure).not.toHaveBeenCalled();});
test("official submit requires the displayed scenario identity and no client assistance override",async()=>{const h=harness();const response=await h.http.complete(new Request(`http://localhost:3103/api/v1/practice/due/${review}`,{method:"POST",headers:{Origin:"http://localhost:3103","Content-Type":"application/json"},body:JSON.stringify({responseChinese:"这也太离谱了。"})}),review);expect(response.status).toBe(400);expect(h.complete).not.toHaveBeenCalled();});
