import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { createPracticeTaskHttpHandler } from "@/server/domain/create-practice-task";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createPracticeServerServices } from "@/server/repositories/attempt-repository";
import type { Database } from "@/types/database.generated";

function runtimeHandler() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const services = createPracticeServerServices(client, process.env.CI === "true");
  return createPracticeTaskHttpHandler({
    authenticate: createWebSessionAuthenticator({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secureCookies: new URL(environment.APP_URL).protocol === "https:",
      cookieAdapter: async () => createNextCookieAdapter(await cookies()),
    }),
    activate: services.taskService.activate,
    appUrl: environment.APP_URL,
    requestId: randomUUID,
  });
}

export async function POST(request: Request): Promise<Response> {
  return runtimeHandler()(request);
}
