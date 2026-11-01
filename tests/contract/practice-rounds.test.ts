import { describe, expect, test } from "vitest";
import * as practice from "@/contracts/practice";
import * as knowledge from "@/contracts/knowledge";
import { PracticeMaterialViewSchema } from "@/features/practice/material-schema";

const id = "10000000-0000-4000-8000-000000000001";
const at = "2026-11-01T12:00:00.000Z";
const evaluation = { passed: true, independentUse: true, assistanceLevel: "none", accuracy: {score:4,englishFeedback:"Correct meaning."},naturalness:{score:4,englishFeedback:"Natural Chinese."},contextualFit:{score:4,englishFeedback:"Fits the situation."} };
const answer = { attemptId:id,revision:1,text:"这也太离谱了。",evaluation,naturalVersion:null };
const round = {roundNumber:2,status:"retry_scheduled",firstAnswer:answer,latestRevision:null,examplesOpened:false,promotion:null,retryDueAt:at};

describe("group 2 public contracts", () => {
  test("round refresh preserves first answer, latest revision and nullable natural version", () => {
    expect(practice.PracticeRoundStateSchema.parse(round)).toEqual(round);
    expect(practice.PracticeRoundStateSchema.parse({...round,latestRevision:{...answer,revision:2,naturalVersion:"这件事太离谱了。"}}).firstAnswer).toEqual(answer);
    expect(practice.PracticeRoundStateSchema.safeParse({...round,roundNumber:0}).success).toBe(false);
  });
  test("activation can redirect only to the promoted Vault detail", () => {
    expect(practice.PracticeActivationResponseSchema.parse({redirect:`/vault/${id}`})).toEqual({redirect:`/vault/${id}`});
    expect(practice.PracticeActivationResponseSchema.safeParse({redirect:"https://evil.example"}).success).toBe(false);
  });
  test("structured situations retain intent and setting without inventing legacy fields", () => {
    const situation={situationZh:"朋友说一杯咖啡要六十元。你怎么看？",situationEn:"Your friend says a coffee costs sixty yuan. What do you think?",interlocutor:"朋友",taskEn:"Tell your friend how you feel about the price.",targetFunction:"complain",targetSetting:"casual_chat"};
    expect(practice.PracticeSituationSchema.parse(situation)).toEqual(situation);
    expect(practice.PracticeSituationSchema.safeParse({...situation,targetSetting:"unknown"}).success).toBe(false);
  });
  test("conflicts contain a typed existing answer and full round state", () => {
    const conflict={ok:false,error:{code:"FIRST_ANSWER_EXISTS",message:"Already answered.",retryable:false,details:{roundState:round}},requestId:"request-1"};
    expect(practice.PracticeConflictResponseSchema.parse(conflict)).toEqual(conflict);
    expect(practice.PracticeConflictResponseSchema.safeParse({...conflict,error:{...conflict.error,details:{}}}).success).toBe(false);
  });
  test("Saved card state distinguishes queue removal from promotion", () => {
    expect(knowledge.SavedPracticeStateSchema.parse({status:"removed",taskId:id,roundNumber:2})).toEqual({status:"removed",taskId:id,roundNumber:2});
    expect(knowledge.SavedPracticeStateSchema.safeParse({status:"promoted",taskId:id}).success).toBe(false);
  });
  test("pre-Vault material can accurately have no mastery", () => {
    expect(PracticeMaterialViewSchema.shape.masteryState.safeParse(null).success).toBe(true);
  });
});
