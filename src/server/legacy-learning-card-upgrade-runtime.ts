import { createClient } from "@supabase/supabase-js";
import { ServerEnvSchema } from "@/server/env";
import { createLegacyLearningCardUpgradeRepository } from "@/server/repositories/legacy-learning-card-upgrade-repository";
import { createLegacyLearningCardUpgradeService } from "@/server/domain/legacy-learning-card-upgrade";
import { createAnalyzeMarkedExpressionsFixtureGateway } from "@/server/ai/prompts/analyze-saved-item.v3";
import { createStructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { createSupabaseModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";
import type { Database } from "@/types/database.generated";

/** Explicit CLI/runtime only: never registered as a worker or invoked by Review. */
export function createLegacyLearningCardUpgradeRuntime({ci=false}:{ci?:boolean}={}){
 const environment=ServerEnvSchema.pick({NEXT_PUBLIC_SUPABASE_URL:true,SUPABASE_SERVICE_ROLE_KEY:true}).parse({NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY});
 const client=createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL,environment.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const fixtureGateway=createAnalyzeMarkedExpressionsFixtureGateway();
 return createLegacyLearningCardUpgradeService({repository:createLegacyLearningCardUpgradeRepository(client),fixtureGateway,ci,now:()=>new Date().toISOString(),gatewayResolver:createStructuredJsonGatewayResolver({ci,fixture:fixtureGateway,createRuntimeResolver:()=>createSupabaseModelGatewayRuntimeResolver(client)})});
}
