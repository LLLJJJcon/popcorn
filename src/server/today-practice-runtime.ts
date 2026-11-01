import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createTodayPracticeService } from "@/server/domain/build-today-queue";
import { createTodayPracticeRepository } from "@/server/repositories/today-practice-repository";
import { createPracticeMaterialRepository } from "@/server/repositories/practice-material-repository";
import type { Database } from "@/types/database.generated";

export async function createTodayPracticeRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    appUrl: environment.APP_URL,
    authenticate: createWebSessionAuthenticator({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secureCookies: new URL(environment.APP_URL).protocol === "https:",
      cookieAdapter: async () => createNextCookieAdapter(await cookies()),
    }),
    service: createTodayPracticeService(createTodayPracticeRepository(client)),
    material: createPracticeMaterialRepository(client).findImmediateMaterial,
  };
}
