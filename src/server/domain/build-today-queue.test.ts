import {expect,test,vi} from "vitest";
import * as queue from "./build-today-queue";
const user="10000000-0000-4000-8000-000000000001",at="2026-11-01T00:00:00Z";
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const item=(n:number)=>({id:id(n),kind:"new",expression:"太离谱了",meaningHere:"Outrageous.",mastery:null,dueAt:null,overdueDays:0,roundNumber:null,sourceVideoTitle:"Video",sourceId:user,selection:{savedItemId:user,candidateArtifactId:id(n),candidateIndex:0},currentTaskId:null,roundStatus:null});
test("today exhausts all200-sized pages rather than truncating New at200",async()=>{
 const items=Array.from({length:501},(_,n)=>item(n+1));const summary={reviewCount:0,secondTryCount:0,newCount:501,estimatedMinutes:1002,needsAnalysisCount:0,processingCount:0,nextPracticeAt:null};
 const itemsPage=vi.fn(async(_u:string,_at:string,offset:number,limit:number)=>items.slice(offset,offset+limit));
 const service=queue.createTodayPracticeService({summary:async()=>summary,itemsPage} as never);
 expect((await service.today(user,at)).items).toHaveLength(501);
 expect(itemsPage.mock.calls.map(c=>[c[2],c[3]])).toEqual([[0,200],[200,200],[400,200]]);
});
test("next accepts more than200 excluded stable IDs and passes owner/time without a model dependency",async()=>{
 const exclude=Array.from({length:301},(_,n)=>id(n+1));const next=vi.fn(async()=>({summary:{reviewCount:0,secondTryCount:0,newCount:0,estimatedMinutes:0,needsAnalysisCount:0,processingCount:0,nextPracticeAt:null},item:null,remainingCount:0,resumed:false}));
 await queue.createTodayPracticeService({next} as never).next(user,at,{exclude});
 expect(next).toHaveBeenCalledWith(user,at,{exclude});
});
test("candidate item identity is stable across rounds and differs between owners",()=>{
 expect(queue.todayCandidateItemId(user,"h:save:mark")).toBe("8818ffca-a153-503a-a9c6-2cea4f075bad");
 expect(queue.todayCandidateItemId(user,"h:save:mark")).not.toBe(queue.todayCandidateItemId(id(2),"h:save:mark"));
});
test("needs-analysis filtering exhausts every page in order with bounded serial reads",async()=>{
 const pages=Array.from({length:501},(_,n)=>({sourceId:id(n+1)}));let active=0,peak=0;
 const needsAnalysisVideosPage=vi.fn(async(_u:string,_at:string,offset:number,limit:number)=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;return pages.slice(offset,offset+limit);});
 const videos=await queue.createTodayPracticeService({needsAnalysisVideosPage} as never).needsAnalysisVideos(user,at);
 expect(videos).toEqual(pages);
 expect(needsAnalysisVideosPage.mock.calls.map(c=>[c[2],c[3]])).toEqual([[0,200],[200,200],[400,200]]);
 expect(peak).toBe(1);
});
