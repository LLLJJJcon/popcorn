import { expect, test } from "vitest";
import { ApiErrorCodeSchema } from "@/contracts/api";
import {
  DueScenarioIdentitySchema, ReviewCompletionInputSchema, ReviewRevisionInputSchema,
  DuePreparationPendingSchema, ReviewOperationFailureDetailsSchema,
} from "@/contracts/review-practice";

const id="41000000-0000-4000-8000-000000000001";
const identity={taskId:id,scenarioVersion:1,scenarioFingerprint:"a".repeat(64)};
test("official submissions bind the exact scenario that was answered",()=>{
 expect(ReviewCompletionInputSchema.parse({...identity,requestId:id,responseChinese:"这也太离谱了。"})).toMatchObject(identity);
 expect(ReviewCompletionInputSchema.safeParse({requestId:id,responseChinese:"这也太离谱了。"}).success).toBe(false);
 expect(DueScenarioIdentitySchema.safeParse({...identity,scenarioVersion:0}).success).toBe(false);
});
test("review revisions bind the official attempt and a request id rather than replacing evidence",()=>{
 const value={...identity,requestId:id,attemptId:id,responseChinese:"这也太离谱了。"};
 expect(ReviewRevisionInputSchema.parse(value)).toEqual(value);
 expect(ReviewRevisionInputSchema.safeParse({...value,mastery:"owned"}).success).toBe(false);
});
test("pending preparation differs explicitly from a known failed generation cycle",()=>{
 expect(DuePreparationPendingSchema.parse({status:"preparing",reviewTaskId:id,requestId:id,retryAfterMs:1000}).status).toBe("preparing");
 expect(ReviewOperationFailureDetailsSchema.parse({operation:{kind:"prepare",requestId:id,state:"failed"}}).operation?.state).toBe("failed");
 expect(ReviewOperationFailureDetailsSchema.parse({operation:{kind:"regenerate",requestId:id,state:"in_progress"}}).operation?.state).toBe("in_progress");
});
test("Review conflicts remain typed API failures for current-question recovery",()=>{
 for(const code of ["REGENERATE_USED","ALREADY_SUBMITTED","SCENARIO_CHANGED","LEGACY_METADATA_REQUIRED","REQUEST_IN_PROGRESS"]){
  expect(ApiErrorCodeSchema.safeParse(code).success).toBe(true);
 }
});
