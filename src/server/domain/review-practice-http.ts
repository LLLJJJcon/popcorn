import { z } from "zod";
import { ReviewMutationInputSchema,ReviewCompletionInputSchema,ReviewRevisionInputSchema,type ReviewCompletionInput } from "@/contracts/review-practice";
import { failure,success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";
import { PracticeError,practiceErrorResponse,readPracticeMutation } from "./create-practice-task";
import type { createReviewPracticeService } from "./review-practice";

type Dependencies={authenticate:(request:Request)=>Promise<WebSessionResult>;appUrl:string;service:ReturnType<typeof createReviewPracticeService>;complete:(userId:string,reviewTaskId:string,input:ReviewCompletionInput)=>Promise<unknown>;requestId:()=>string};
const uuid=z.string().uuid();
const headers={"Cache-Control":"no-store"};

/** A URL nonce is not evidence of an explicit same-origin costly retry. */
export function hasReviewRetryProof(request:Request,appUrl:string):boolean{
 if(request.headers.get("X-Popcorn-Review-Retry")!=="1")return false;
 const expected=new URL(appUrl).origin;
 const site=request.headers.get("Sec-Fetch-Site");
 if(site!==null&&site!=="same-origin")return false;
 const origin=request.headers.get("Origin");
 if(origin!==null&&origin!==expected)return false;
 const referer=request.headers.get("Referer");
 if(referer!==null){try{if(new URL(referer).origin!==expected)return false;}catch{return false;}}
 return origin===expected||referer!==null||site==="same-origin";
}

export function createReviewPracticeHttpHandlers(deps:Dependencies){
 const reply=(data:unknown,id:string,status=200)=>Response.json(success(data,id),{status,headers});
 async function errorResponse(error:unknown,id:string,userId?:string,reviewTaskId?:string){
  if(error instanceof PracticeError&&["SCENARIO_CHANGED","REGENERATE_USED","ALREADY_SUBMITTED"].includes(error.code)&&userId&&reviewTaskId&&!error.details?.current){
   try{return practiceErrorResponse(new PracticeError(error.code,error.retryable,{...error.details,current:await deps.service.current(userId,reviewTaskId)}),id);}catch{/* Preserve the safe error if the current view is temporarily unavailable. */}
  }
  return practiceErrorResponse(error,id);
 }
 async function mutation<T>(request:Request,reviewTaskId:string,schema:z.ZodType<T>,invoke:(userId:string,reviewId:string,input:T)=>Promise<unknown>,status=200){
  const id=deps.requestId();
  let userId:string|undefined;
  try{
   const authenticated=await readPracticeMutation(request,{authenticate:deps.authenticate,appUrl:deps.appUrl,requestId:id});
   if(!authenticated.ok)return authenticated.response;
   userId=authenticated.userId;
   const input=schema.safeParse(authenticated.body);
   if(!uuid.safeParse(reviewTaskId).success||!input.success)throw new PracticeError("VALIDATION_FAILED");
   return reply(await invoke(authenticated.userId,reviewTaskId,input.data),id,status);
  }catch(error){return errorResponse(error,id,userId,reviewTaskId);}
 }
 return {
  async get(request:Request,reviewTaskId:string){
   const id=deps.requestId();
   try{
    const authenticated=await deps.authenticate(request);
    if(!authenticated.ok)return Response.json(failure({code:authenticated.reason==="missing"?"AUTH_REQUIRED":"SESSION_EXPIRED",message:"Sign in to practice.",retryable:false},id),{status:401,headers});
    const query=new URL(request.url).searchParams;
    if(!uuid.safeParse(reviewTaskId).success||[...query.keys()].some(key=>key!=="retryRequestId"||query.getAll(key).length!==1))throw new PracticeError("VALIDATION_FAILED");
    const retryRequestId=query.get("retryRequestId");
    if(retryRequestId!==null&&!uuid.safeParse(retryRequestId).success)throw new PracticeError("VALIDATION_FAILED");
    if(retryRequestId!==null&&!hasReviewRetryProof(request,deps.appUrl))return Response.json(failure({code:"FORBIDDEN",message:"Request origin is not allowed",retryable:false},id),{status:403,headers});
    const result=await deps.service.ensure(authenticated.userId,reviewTaskId,retryRequestId?{retryRequestId}:{});
    return reply(result,id,result.status==="preparing"?202:200);
   }catch(error){return practiceErrorResponse(error,id);}
  },
  complete:(request:Request,id:string)=>mutation(request,id,ReviewCompletionInputSchema,deps.complete,201),
  regenerate:(request:Request,id:string)=>mutation(request,id,ReviewMutationInputSchema,deps.service.regenerate),
  reveal:(request:Request,id:string)=>mutation(request,id,ReviewMutationInputSchema,deps.service.reveal),
  examples:(request:Request,id:string)=>mutation(request,id,ReviewMutationInputSchema,deps.service.examples),
  revisions:(request:Request,id:string)=>mutation(request,id,ReviewRevisionInputSchema,deps.service.revise),
 };
}
