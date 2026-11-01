import { z } from "zod";
import { success } from "@/server/api/respond";
import { PracticeError, practiceErrorResponse, readPracticeMutation } from "./create-practice-task";
import type { WebSessionResult } from "@/server/auth/web-session";

export type PracticeRoundAction="rounds"|"remove"|"restore"|"examples"|"due-examples";
export function createPracticeRoundHttpHandler(deps:{authenticate:(r:Request)=>Promise<WebSessionResult>;appUrl:string;requestId:()=>string;startRound:(userId:string,taskId:string,requestId:string)=>Promise<{taskId:string;roundNumber:number;created:boolean}>;change:(userId:string,taskId:string,action:"remove"|"restore"|"examples")=>Promise<unknown>;dueExamples:(userId:string,reviewTaskId:string)=>Promise<unknown>}){
  return async(request:Request,id:string,action:PracticeRoundAction):Promise<Response>=>{
    const requestId=deps.requestId();const mutation=await readPracticeMutation(request,{...deps,requestId});if(!mutation.ok)return mutation.response;
    if(!z.string().uuid().safeParse(id).success)return practiceErrorResponse(new PracticeError("VALIDATION_FAILED"),requestId);
    try{
      let data:unknown;let status=200;
      if(action==="rounds"){
        const input=z.strictObject({requestId:z.string().uuid()}).safeParse(mutation.body);if(!input.success)throw new PracticeError("VALIDATION_FAILED");
        const result=await deps.startRound(mutation.userId,id,input.data.requestId);status=result.created?201:200;data={taskId:result.taskId,roundNumber:result.roundNumber};
      }else{
        if(!z.strictObject({}).safeParse(mutation.body).success)throw new PracticeError("VALIDATION_FAILED");
        data=action==="due-examples"?await deps.dueExamples(mutation.userId,id):await deps.change(mutation.userId,id,action);
      }
      return Response.json(success(data,requestId),{status,headers:{"Cache-Control":"no-store"}});
    }catch(error){return practiceErrorResponse(error,requestId);}
  };
}
