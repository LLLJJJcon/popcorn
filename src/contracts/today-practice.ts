import {z} from "zod";
import {MasteryStateSchema} from "./memory";
import {SavedItemStatusSchema} from "./source";

const uuid=z.string().uuid(), instant=z.string().datetime({offset:true}), count=z.number().int().nonnegative();
export const TodayPracticeKindSchema=z.enum(["review","second_try","new"]);
export const TODAY_PRACTICE_GROUPS=[
 {kind:"review",id:"reviews",label:"Reviews",description:"Due for review — use a Vault expression again in a new situation."},
 {kind:"second_try",id:"second-tries",label:"Second tries",description:"Not in your Vault yet — one more try with a fresh question."},
 {kind:"new",id:"new-expressions",label:"New expressions",description:"Analyzed from your saves — practice it for the first time."},
] as const;
export const TodayPracticeSummarySchema=z.strictObject({
 reviewCount:count,secondTryCount:count,newCount:count,estimatedMinutes:count,
 needsAnalysisCount:count,processingCount:count,nextPracticeAt:instant.nullable(),
});
const common={id:uuid,expression:z.string().min(1),meaningHere:z.string().min(1),overdueDays:count,sourceVideoTitle:z.string().nullable(),sourceId:uuid.nullable()};
const selection=z.strictObject({savedItemId:uuid,candidateArtifactId:uuid,candidateIndex:count});
export const TodayReviewItemSchema=z.strictObject({...common,kind:z.literal("review"),reviewTaskId:uuid,userExpressionId:uuid,mastery:MasteryStateSchema,dueAt:instant,roundNumber:z.null()});
export const TodayCandidateItemSchema=z.strictObject({...common,kind:z.enum(["second_try","new"]),mastery:z.null(),dueAt:instant.nullable(),roundNumber:z.number().int().positive().nullable(),selection,currentTaskId:uuid.nullable(),roundStatus:z.enum(["open","retry_scheduled"]).nullable()});
export const TodayPracticeItemSchema=z.union([TodayReviewItemSchema,TodayCandidateItemSchema]);
export const TodayPracticeResponseSchema=z.strictObject({summary:TodayPracticeSummarySchema,items:z.array(TodayPracticeItemSchema)});
export const TodayPracticeNextResponseSchema=z.strictObject({summary:TodayPracticeSummarySchema,item:TodayPracticeItemSchema.nullable(),remainingCount:count,resumed:z.boolean()});
export const TodayPracticeRecentVideoSchema=z.strictObject({sourceId:uuid,youtubeVideoId:z.string().min(1),canonicalUrl:z.string().url(),title:z.string(),channel:z.string(),thumbnailUrl:z.string(),savedCount:count,latestSavedAt:instant,processingState:SavedItemStatusSchema,practiceCount:count,needsAnalysisCount:count});
export const TodayPracticeHomeDataSchema=z.strictObject({summary:TodayPracticeSummarySchema,recentVideos:z.array(TodayPracticeRecentVideoSchema)});
export const TodaySessionResultSchema=z.strictObject({id:uuid,kind:TodayPracticeKindSchema,expression:z.string().min(1),outcome:z.enum(["added","moved_up","practice_again_tomorrow","maintained","removed"]),priorMastery:MasteryStateSchema.nullable(),newMastery:MasteryStateSchema.nullable(),nextPracticeAt:instant.nullable()});
export const TodayNextInputSchema=z.strictObject({exclude:z.array(uuid).optional(),currentItemId:uuid.optional(),currentTaskId:uuid.optional()});
export type TodayPracticeKind=z.infer<typeof TodayPracticeKindSchema>;
export type TodayPracticeSummary=z.infer<typeof TodayPracticeSummarySchema>;
export type TodayReviewItem=z.infer<typeof TodayReviewItemSchema>;
export type TodayCandidateItem=z.infer<typeof TodayCandidateItemSchema>;
export type TodayPracticeItem=z.infer<typeof TodayPracticeItemSchema>;
export type TodayPracticeResponse=z.infer<typeof TodayPracticeResponseSchema>;
export type TodayPracticeNextResponse=z.infer<typeof TodayPracticeNextResponseSchema>;
export type TodayPracticeRecentVideo=z.infer<typeof TodayPracticeRecentVideoSchema>;
export type TodayPracticeHomeData=z.infer<typeof TodayPracticeHomeDataSchema>;
export type TodaySessionResult=z.infer<typeof TodaySessionResultSchema>;
export type TodayNextInput=z.infer<typeof TodayNextInputSchema>;
