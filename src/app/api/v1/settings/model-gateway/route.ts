import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createWebSessionAuthenticator, type WebCookieAdapter } from "@/server/auth/web-session";
import { getServerEnv } from "@/server/env";
import {
  createModelGatewayHttpHandlers,
  createModelGatewaySettingsService,
} from "@/server/model-gateway/settings-service";
import { createVaultSecretStore } from "@/server/model-gateway/vault-secret-store";
import { createModelGatewaySettingsRepository } from "@/server/repositories/model-gateway-settings-repository";
import type { Database } from "@/types/database.generated";

async function nextCookieAdapter(): Promise<WebCookieAdapter> {
  const store = await cookies();
  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (values) => {
      for (const { name, value, options } of values) {
        store.set({ name, value, ...(options ?? {}) });
      }
    },
  };
}

function runtimeHandlers() {
  const environment = getServerEnv();
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const service = createModelGatewaySettingsService({
    repository: createModelGatewaySettingsRepository(client),
    vault: createVaultSecretStore(client),
    now: () => new Date().toISOString(),
    configId: randomUUID,
  });
  return createModelGatewayHttpHandlers({
    authenticate: createWebSessionAuthenticator({
      supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      secureCookies: new URL(environment.APP_URL).protocol === "https:",
      cookieAdapter: async () => nextCookieAdapter(),
    }),
    service,
    appUrl: environment.APP_URL,
    requestId: randomUUID,
  });
}

export async function GET(request: Request): Promise<Response> {
  return runtimeHandlers().get(request);
}

export async function PUT(request: Request): Promise<Response> {
  return runtimeHandlers().put(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return runtimeHandlers().delete(request);
}
