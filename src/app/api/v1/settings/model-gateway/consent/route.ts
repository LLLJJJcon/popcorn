import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import {
  createModelGatewayHttpHandlers,
  createModelGatewaySettingsService,
} from "@/server/model-gateway/settings-service";
import { createVaultSecretStore } from "@/server/model-gateway/vault-secret-store";
import { createModelGatewaySettingsRepository } from "@/server/repositories/model-gateway-settings-repository";
import type { Database } from "@/types/database.generated";

function runtimeHandler() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return createModelGatewayHttpHandlers({
    authenticate: createWebSessionAuthenticator({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secureCookies: new URL(environment.APP_URL).protocol === "https:",
      cookieAdapter: async () => createNextCookieAdapter(await cookies()),
    }),
    service: createModelGatewaySettingsService({
      repository: createModelGatewaySettingsRepository(client),
      vault: createVaultSecretStore(client),
      now: () => new Date().toISOString(),
      configId: randomUUID,
    }),
    appUrl: environment.APP_URL,
    requestId: randomUUID,
  }).consent;
}

export async function POST(request: Request): Promise<Response> {
  return runtimeHandler()(request);
}
