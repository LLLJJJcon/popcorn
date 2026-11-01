import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LearningCardFieldsSchema } from "@/contracts/knowledge";
import { LegacyUpgradeError,LegacyUpgradeErrorCodeSchema,LegacyUpgradeOutcomeSchema,LegacyUpgradePageInputSchema,LegacyUpgradeRequestSchema,LegacyUpgradeSourceCandidateSchema,type LegacyLearningCardUpgradeRepository,type LegacyUpgradeContext,type LegacyUpgradeRequest } from "@/server/contracts/legacy-learning-card-upgrade";
import type { Database } from "@/types/database.generated";

const Id=z.string().uuid(),Hash=z.string().regex(/^[a-f0-9]{64}$/);
const Pin=z.strictObject({configId:Id,revision:z.number().int().positive(),fingerprint:Hash});
const Context=z.strictObject({ownerId:Id,senseId:Id,userExpressionId:Id,expression:z.string().min(1),originalSavedItemId:Id.nullable(),beforeHash:Hash,canonicalCard:LearningCardFieldsSchema.nullable(),modernFieldsEmpty:z.boolean(),sourceState:z.enum(["retained","deleted","missing"]),existingCard:z.strictObject({card:LearningCardFieldsSchema,candidateKey:z.string().min(1),artifactId:Id,candidateIndex:z.number().int().nonnegative(),evidenceHash:Hash}).nullable(),sources:z.array(LegacyUpgradeSourceCandidateSchema),nextSourceOffset:z.number().int().positive().nullable()});
type RpcClient={rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};
export function createLegacyLearningCardUpgradeRepository(client:SupabaseClient<Database>):LegacyLearningCardUpgradeRepository{
 const db=client as unknown as RpcClient;
 async function rpc(name:string,args:Record<string,unknown>){
  const result=await db.rpc(name,args);
  if(result.error){
   const error=result.error as {message?:unknown;code?:unknown};
   for(const code of LegacyUpgradeErrorCodeSchema.options)if(typeof error.message==="string"&&error.message===code)throw new LegacyUpgradeError(code);
   if(error.code==="22023"||error.code==="22P02")throw new LegacyUpgradeError(typeof error.message==="string"&&error.message.includes("owned sense")?"NOT_FOUND":"VALIDATION_FAILED");
   throw new LegacyUpgradeError("INTERNAL_ERROR",true);
  }
  return result.data;
 }
 const args=(owner:string,input:LegacyUpgradeRequest,now:string)=>({p_user_id:Id.parse(owner),p_input:LegacyUpgradeRequestSchema.parse(input),p_now:now});
 function outcome(raw:unknown,input:LegacyUpgradeRequest){const value=LegacyUpgradeOutcomeSchema.parse(raw);if(value.requestId!==input.requestId||value.senseId!==input.senseId)throw new LegacyUpgradeError("NOT_FOUND");return value;}
 async function readContext(owner:string,sense:string):Promise<LegacyUpgradeContext|null>{
  Id.parse(owner);Id.parse(sense);let offset=0;let accumulated:LegacyUpgradeContext|null=null;
  for(;;){
   const raw=await rpc("read_legacy_learning_card_upgrade_context",{p_user_id:owner,p_sense_id:sense,p_source_offset:offset,p_source_limit:200});
   if(raw===null){if(accumulated)throw new LegacyUpgradeError("STALE_PLAN");return null;}
   const parsed=Context.parse(raw),{nextSourceOffset,...value}=parsed;
   if(value.ownerId!==owner||value.senseId!==sense)throw new LegacyUpgradeError("NOT_FOUND");
   if(accumulated){if(accumulated.beforeHash!==value.beforeHash||accumulated.sources.some(source=>value.sources.some(next=>next.occurrenceId===source.occurrenceId)))throw new LegacyUpgradeError("STALE_PLAN");accumulated.sources.push(...value.sources);}
   else accumulated=value;
   if(nextSourceOffset===null)return accumulated;
   if(nextSourceOffset<=offset||value.sources.length!==200)throw new LegacyUpgradeError("INTERNAL_ERROR");
   offset=nextSourceOffset;
  }
 }
 return {
  readContext,
  async pageContexts(owner,input){
   const page=LegacyUpgradePageInputSchema.parse(input);Id.parse(owner);
   const value=z.strictObject({senseIds:z.array(Id).max(page.limit),nextCursor:Id.nullable()}).parse(await rpc("page_legacy_learning_card_upgrade_contexts",{p_user_id:owner,p_after_sense_id:page.afterSenseId??null,p_limit:page.limit}));
   if(new Set(value.senseIds).size!==value.senseIds.length||value.senseIds.some((id,index)=>id<=(index?value.senseIds[index-1]:page.afterSenseId??""))||(value.nextCursor!==null&&value.nextCursor!==value.senseIds.at(-1)))throw new LegacyUpgradeError("INTERNAL_ERROR");
   const items:LegacyUpgradeContext[]=[];
   for(let index=0;index<value.senseIds.length;index+=4){const batch=await Promise.all(value.senseIds.slice(index,index+4).map(id=>readContext(owner,id)));if(batch.some(item=>item===null))throw new LegacyUpgradeError("STALE_PLAN");items.push(...batch as LegacyUpgradeContext[]);}
   return {items,nextCursor:value.nextCursor};
  },
  async resolveActiveGatewayPin(owner){const rows=z.array(z.object({config_id:Id,revision:z.number().int().positive(),config_fingerprint:Hash})).parse(await rpc("resolve_active_user_model_gateway_pin",{p_user_id:Id.parse(owner)}));if(rows.length!==1)return null;return {configId:rows[0].config_id,revision:rows[0].revision,fingerprint:rows[0].config_fingerprint};},
  async lookup(owner,input,now){const value=await rpc("lookup_legacy_learning_card_upgrade",args(owner,input,now));return value===null?null:outcome(value,input);},
  async claim(owner,input,pin,now){
   const value=z.discriminatedUnion("kind",[z.strictObject({kind:z.literal("claimed"),token:Id,leaseExpiresAt:z.string().datetime({offset:true})}),z.strictObject({kind:z.literal("outcome"),outcome:LegacyUpgradeOutcomeSchema})]).parse(await rpc("claim_legacy_learning_card_upgrade",{...args(owner,input,now),p_gateway_pin:pin===null?null:Pin.parse(pin)}));
   return value.kind==="outcome"?{kind:"outcome",outcome:outcome(value.outcome,input)}:value;
  },
  async publish(owner,input,token,result,now){LearningCardFieldsSchema.parse(result.card);return outcome(await rpc("publish_legacy_learning_card_upgrade",{...args(owner,input,now),p_token:Id.parse(token),p_result:result}),input);},
  async fail(owner,input,token,code,now){return z.boolean().parse(await rpc("fail_legacy_learning_card_upgrade",{...args(owner,input,now),p_token:Id.parse(token),p_code:LegacyUpgradeErrorCodeSchema.parse(code)}));},
 };
}
