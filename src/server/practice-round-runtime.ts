import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createNextCookieAdapter,createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createPracticeServerServices } from "@/server/repositories/attempt-repository";
import { createPracticeRoundHttpHandler,type PracticeRoundAction } from "@/server/domain/practice-round-http";
import { practiceErrorResponse } from "@/server/domain/create-practice-task";
import type { Database } from "@/types/database.generated";

export async function handlePracticeRoundMutation(request:Request,id:string,action:PracticeRoundAction){
  try{
    const e=getModelGatewaySettingsEnv();const client=createClient<Database>(e.NEXT_PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const services=createPracticeServerServices(client,process.env.CI==="true");
    return createPracticeRoundHttpHandler({authenticate:createWebSessionAuthenticator({supabaseUrl:e.NEXT_PUBLIC_SUPABASE_URL,anonKey:e.NEXT_PUBLIC_SUPABASE_ANON_KEY,secureCookies:new URL(e.APP_URL).protocol==="https:",cookieAdapter:async()=>createNextCookieAdapter(await cookies())}),appUrl:e.APP_URL,requestId:randomUUID,startRound:services.startRound,change:services.change,dueExamples:services.dueExamples})(request,id,action);
  }catch(error){return practiceErrorResponse(error,randomUUID());}
}
