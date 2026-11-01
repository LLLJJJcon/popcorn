import {expect,test} from "vitest";
import * as today from "@/contracts/today-practice";
import { CandidateExpressionSchema } from "@/contracts/knowledge";
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

// Kept alongside the same real SQL cases in today_practice.sql: the database
// must select only versions the shared Saved/Practice schema can read.
const card={expression:"太离谱了",englishMeaning:"Outrageous.",englishExplanation:"React to something extreme.",tone:"Casual.",communicativeFunction:"React",register:"Casual",evidenceText:"太离谱了，说白了。",segmentIds:["today-seg"],startSeconds:1,endSeconds:2,meaningHere:"Outrageous.",useItWhen:"React to something extreme.",comparedWith:"很奇怪 is neutral.",howItFits:"Use this phrase in a clause.",toneAndWho:"Casual with friends.",watchOut:null,examples:null,functionCategories:["react"],usageSettings:["casual_chat"],suitability:"expression"};
test.each([
 ["compatibility prose bound",{englishMeaning:"a".repeat(2001)},false],
 ["optional confidence",{confidence:"bad"},false],
 ["highlight UUID",{highlightId:"bad"},false],
 ["highlight key length",{highlightKey:"a".repeat(30001)},false],
 ["null setting",{usageSettings:[null]},false],
 ["null function",{functionCategories:[null]},false],
 ["segment whitespace",{segmentIds:[" today-seg "]},false],
 ["optional reason",{notExpressionReasonEn:123},false],
 ["strict object",{unexpected:true},false],
 ["schema examples",{examples:[{zh:"你好。",en:"Hello."},{zh:"再见。",en:"Goodbye."}]},true],
 ["literal v",{meaningHere:"v"},true],
])("candidate projection validity follows shared schema: %s",(_name,patch,valid)=>{
 expect(CandidateExpressionSchema.safeParse({...card,...patch}).success).toBe(valid);
});
