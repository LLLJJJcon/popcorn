import { z } from "zod";
import { failure, success } from "@/server/api/respond";
import type { WebSessionResult } from "@/server/auth/web-session";

export interface ExpressionRemovalRepository {
  removeSaved(userId: string, savedItemId: string, artifactId: string, candidateIndex: number): Promise<string | null>;
  removeVault(userId: string, userExpressionId: string): Promise<boolean>;
}
export function createExpressionDeletionHandlers(dependencies: {
  readonly repository: ExpressionRemovalRepository;
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly appUrl: string;
  readonly requestId: () => string;
}) {
  async function remove(request: Request, ids: readonly string[], index?: string) {
    const requestId=dependencies.requestId();
    const reply=(body: unknown,status: number)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
    const error=(code: "AUTH_REQUIRED"|"SESSION_EXPIRED"|"FORBIDDEN"|"VALIDATION_FAILED"|"INTERNAL_ERROR",message: string,status: number)=>reply(failure({code,message,retryable:status===500},requestId),status);
    const session=await dependencies.authenticate(request);
    if(!session.ok) return error(session.reason==="missing"?"AUTH_REQUIRED":"SESSION_EXPIRED","Sign in to manage your expressions.",401);
    if(request.headers.get("origin")!==new URL(dependencies.appUrl).origin) return error("FORBIDDEN","Request origin is not allowed.",403);
    if(ids.some(id=>!z.string().uuid().safeParse(id).success)|| (index!==undefined&&(!/^(0|[1-9]\d{0,5})$/.test(index)||Number(index)>100000))) return error("VALIDATION_FAILED","Invalid expression.",400);
    try {
      if(index!==undefined) {
        const key=await dependencies.repository.removeSaved(session.userId,ids[0]!,ids[1]!,Number(index));
        return key ? reply(success({deleted:true,key},requestId),200):error("FORBIDDEN","Expression is unavailable.",404);
      }
      return await dependencies.repository.removeVault(session.userId,ids[0]!) ? reply(success({deleted:true},requestId),200):error("FORBIDDEN","Expression is unavailable.",404);
    } catch { return error("INTERNAL_ERROR","Could not delete this expression. Please try again.",500); }
  }
  return {
    saved:(request:Request,savedItemId:string,artifactId:string,index:string)=>remove(request,[savedItemId,artifactId],index),
    vault:(request:Request,id:string)=>remove(request,[id]),
  };
}
