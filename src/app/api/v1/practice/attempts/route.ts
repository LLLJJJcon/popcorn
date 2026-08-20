import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import {
  createPracticeAttemptHttpHandlers,
  createPracticeServerServices,
} from "@/server/repositories/attempt-repository";
import type { Database } from "@/types/database.generated";

function runtimeHandlers() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const services = createPracticeServerServices(client, process.env.CI === "true");
  return createPracticeAttemptHttpHandlers({
    authenticate: createWebSessionAuthenticator({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secureCookies: new URL(environment.APP_URL).protocol === "https:",
      cookieAdapter: async () => createNextCookieAdapter(await cookies()),
    }),
    submitOriginal: services.attemptService.submitOriginal,
    submitRevision: services.attemptService.submitRevision,
    appUrl: environment.APP_URL,
    requestId: randomUUID,
  });
}

export async function POST(request: Request): Promise<Response> {
  return runtimeHandlers().original(request);
}
