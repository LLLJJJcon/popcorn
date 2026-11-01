import {expect,test} from "vitest";
import * as today from "@/contracts/today-practice";
const id="10000000-0000-4000-8000-000000000001";
const summary={reviewCount:2,secondTryCount:1,newCount:3,estimatedMinutes:12,needsAnalysisCount:0,processingCount:0,nextPracticeAt:null};
test("today summary admits uncapped counts and no fabricated next date",()=>{
 expect(today.TodayPracticeSummarySchema.parse(summary)).toEqual(summary);
 expect(today.TodayPracticeSummarySchema.safeParse({...summary,newCount:201,reviewCount:101,estimatedMinutes:606}).success).toBe(true);
 expect(today.TodayPracticeSummarySchema.safeParse({...summary,newCount:-1}).success).toBe(false);
});
test("one client safe constant defines group labels, anchors and exact descriptions",()=>{
 expect(today.TODAY_PRACTICE_GROUPS.map(g=>[g.kind,g.id,g.label])).toEqual([["review","reviews","Reviews"],["second_try","second-tries","Second tries"],["new","new-expressions","New expressions"]]);
 expect(today.TODAY_PRACTICE_GROUPS[1].description).toBe("Not in your Vault yet — one more try with a fresh question.");
});
test("new open round1 has its stable candidate identity and exact existing task entry",()=>{
 const item={id,kind:"new",expression:"太离谱了",meaningHere:"Outrageous.",mastery:null,dueAt:null,overdueDays:0,roundNumber:1,sourceVideoTitle:"Video",sourceId:id,selection:{savedItemId:id,candidateArtifactId:id,candidateIndex:0},currentTaskId:id,roundStatus:"open"};
 expect(today.TodayPracticeItemSchema.parse(item)).toEqual(item);
 expect(today.TodayPracticeNextResponseSchema.parse({summary,item,remainingCount:500,resumed:true}).remainingCount).toBe(500);
});
test("session maintenance outcome does not manufacture a tomorrow schedule or moved-up state",()=>{
 expect(today.TodaySessionResultSchema.parse({id,kind:"review",expression:"太离谱了",outcome:"maintained",priorMastery:"owned",newMastery:"owned",nextPracticeAt:"2026-12-01T00:00:00Z"}).outcome).toBe("maintained");
});
