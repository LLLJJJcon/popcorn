import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.generated";
import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createExpressionDeletionHandlers, type ExpressionRemovalRepository } from "@/server/domain/delete-expression";

export function createExpressionRemovalRepository(client: Pick<SupabaseClient<Database>,"rpc">): ExpressionRemovalRepository {
  return {
    async removeSaved(userId,savedItemId,artifactId,candidateIndex) {
      const result=await client.rpc("remove_saved_expression",{p_user_id:userId,p_saved_item_id:savedItemId,p_artifact_id:artifactId,p_candidate_index:candidateIndex});
      if(result.error)throw new Error("expression removal failed");
      return typeof result.data==="string" ? result.data:null;
    },
    async removeVault(userId,userExpressionId) {
      const result=await client.rpc("remove_vault_expression",{p_user_id:userId,p_user_expression_id:userExpressionId});
      if(result.error)throw new Error("expression removal failed");
      return result.data===true;
    },
  };
}
export async function createExpressionDeletionRuntime() {
  const env=getModelGatewaySettingsEnv();
  const authenticate=createWebSessionAuthenticator({supabaseUrl:env.NEXT_PUBLIC_SUPABASE_URL,anonKey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secureCookies:new URL(env.APP_URL).protocol==="https:",cookieAdapter:async()=>createNextCookieAdapter(await cookies())});
  const client=createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  return createExpressionDeletionHandlers({authenticate,repository:createExpressionRemovalRepository(client),appUrl:env.APP_URL,requestId:()=>crypto.randomUUID()});
}
