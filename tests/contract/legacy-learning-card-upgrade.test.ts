import { expect,test } from "vitest";
import {
 LEGACY_LEARNING_CARD_UPGRADE_VERSION, LegacyUpgradeRequestSchema,
 LegacyUpgradePageInputSchema, LegacyUpgradeOutcomeSchema, LegacyUpgradeSourceCandidateSchema,
} from "@/server/contracts/legacy-learning-card-upgrade";
const id="59800000-0000-4000-8000-000000000001",hash="a".repeat(64);
const request={requestId:id,senseId:id,expectedBeforeHash:hash,expectedEvidenceHash:hash,source:{kind:"source_occurrence",sourceId:id,occurrenceId:id,snapshotId:id}};
const card={meaningHere:"The price is excessively high.",useItWhen:"When complaining about prices.",comparedWith:"很高 is neutral.",howItFits:"After an adjective.",toneAndWho:"Casual with friends.",watchOut:null,examples:null,functionCategories:["complain"],usageSettings:[],suitability:"expression"};
test("upgrade workflow version differs from the unchanged Analyze prompt version",()=>{expect(LEGACY_LEARNING_CARD_UPGRADE_VERSION).toBe("learning-card-upgrade-v1");});
test("one request binds one sense and opaque database hashes, without an owner override",()=>{
 expect(LegacyUpgradeRequestSchema.parse(request)).toEqual(request);
 expect(LegacyUpgradeRequestSchema.safeParse({...request,ownerId:id}).success).toBe(false);
 expect(LegacyUpgradeRequestSchema.safeParse({...request,senseIds:[id]}).success).toBe(false);
 expect(LegacyUpgradeRequestSchema.safeParse({...request,expectedBeforeHash:"raw source text"}).success).toBe(false);
});
test("reuse identity cannot be confused with a generated source occurrence",()=>{
 const reuse={...request,source:{kind:"existing_card",candidateKey:"l:owned-save:original-artifact:0",artifactId:id,candidateIndex:0}};
 expect(LegacyUpgradeRequestSchema.parse(reuse)).toEqual(reuse);
 expect(LegacyUpgradeRequestSchema.safeParse({...reuse,source:{...reuse.source,sourceId:id}}).success).toBe(false);
});
test("page bounds protect each query without imposing a run total cap",()=>{
 expect(LegacyUpgradePageInputSchema.parse({afterSenseId:id,limit:200})).toEqual({afterSenseId:id,limit:200});
 expect(LegacyUpgradePageInputSchema.safeParse({limit:201}).success).toBe(false);
});
test("only an expression card can be an applied outcome",()=>{
 expect(LegacyUpgradeOutcomeSchema.parse({status:"applied",requestId:id,senseId:id,origin:"model",card})).toMatchObject({status:"applied",card});
 expect(LegacyUpgradeOutcomeSchema.safeParse({status:"applied",requestId:id,senseId:id,origin:"model",card:{...card,suitability:"not_expression",notExpressionReasonEn:"A proper name."}}).success).toBe(false);
});
test("not_expression outcome retains the full card without declaring a canonical update",()=>{
 const full={...card,suitability:"not_expression",notExpressionReasonEn:"A proper name."};
 expect(LegacyUpgradeOutcomeSchema.parse({status:"needs_review",requestId:id,senseId:id,reason:"NOT_EXPRESSION",card:full})).toMatchObject({status:"needs_review",card:full});
 expect(LegacyUpgradeOutcomeSchema.safeParse({status:"needs_review",requestId:id,senseId:id,reason:"NOT_EXPRESSION"}).success).toBe(false);
});
test("source projection carries real occurrence identity and explicit ordered TARGET membership",()=>{
 const source={sourceId:id,snapshotId:id,occurrenceId:id,savedItemId:null,transcriptHash:hash,evidenceHash:hash,evidenceText:"价格高得要命。",segmentIds:["original-1"],startSeconds:1,endSeconds:2,createdAt:"2026-11-01T00:00:00.000Z",segments:[{stableId:"original-1",position:0,text:"价格高得要命。",startSeconds:1,endSeconds:2,target:true}]};
 expect(LegacyUpgradeSourceCandidateSchema.parse(source)).toEqual(source);
 expect(LegacyUpgradeSourceCandidateSchema.safeParse({...source,occurrenceId:"guessed"}).success).toBe(false);
});
