import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createCandidateHttpHandlers, createCandidateService } from "@/server/domain/confirm-candidate";
import { createSupabaseExpressionRepository } from "@/server/repositories/expression-repository";
import { createSupabaseSavedItemAnalysisRegistrar } from "@/server/jobs/process-jobs";
import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

async function runtime() {
  const environment = getModelGatewaySettingsEnv();
  const cookieStore = await cookies();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(cookieStore),
  });
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return createCandidateHttpHandlers({
    authenticate,
    service: createCandidateService(
      createSupabaseExpressionRepository(client),
      createSupabaseSavedItemAnalysisRegistrar(client),
      () => new Date().toISOString(),
    ),
    appUrl: environment.APP_URL,
    requestId: () => crypto.randomUUID(),
  });
}

export async function GET(
  request: Request,
  context: { readonly params: Promise<{ readonly savedItemId: string }> },
) {
  const [handlers, { savedItemId }] = await Promise.all([runtime(), context.params]);
  return handlers.get(request, savedItemId);
}

export async function POST(
  request: Request,
  context: { readonly params: Promise<{ readonly savedItemId: string }> },
) {
  const [handlers, { savedItemId }] = await Promise.all([runtime(), context.params]);
  return handlers.post(request, savedItemId);
}
