import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { failure } from "@/server/api/respond";
import {
  createDuePracticeCompletionService,
  createDuePracticeHttpHandler,
  createDueTransferHttpHandler,
  createSupabaseDuePracticeRepository,
} from "@/server/domain/complete-due-practice";
import { createEvaluationFixtureGateway } from "@/server/ai/prompts/evaluate.v1";
import { createStructuredJsonGatewayResolver } from "@/server/ai/structured-json-gateway";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createSupabaseModelGatewayRuntimeResolver } from "@/server/model-gateway/runtime-resolver";
import { createPracticeMaterialRepository } from "@/server/repositories/practice-material-repository";
import type { Database } from "@/types/database.generated";

type Context = { readonly params: Promise<{ readonly reviewTaskId?: string }> };

async function runtimeHandlers() {
  const environment = getModelGatewaySettingsEnv();
  const client = createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL, anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:", cookieAdapter: async () => createNextCookieAdapter(await cookies()),
  });
  const repository = createSupabaseDuePracticeRepository(client);
  const materialRepository = createPracticeMaterialRepository(client);
  const ci = process.env.CI === "true";
  const fixtureGateway = createEvaluationFixtureGateway();
  const complete = createDuePracticeCompletionService({
    repository, ci, fixtureGateway,
    gatewayResolver: createStructuredJsonGatewayResolver({
      ci, fixture: fixtureGateway, createRuntimeResolver: () => createSupabaseModelGatewayRuntimeResolver(client),
    }), now: () => new Date().toISOString(),
  });
  return {
    transfer: createDueTransferHttpHandler({
      authenticate, repository, materialRepository, now: () => new Date().toISOString(), requestId: randomUUID,
    }),
    complete: createDuePracticeHttpHandler({ authenticate, complete: complete.complete, appUrl: environment.APP_URL, requestId: randomUUID }),
  };
}

export async function GET(request: Request, context: Context): Promise<Response> {
  const requestId = randomUUID();
  try {
    return await (await runtimeHandlers()).transfer(request, context);
  } catch {
    return Response.json(failure({
      code: "INTERNAL_ERROR", message: "Practice is temporarily unavailable", retryable: true,
    }, requestId), { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  const requestId = randomUUID();
  try {
    return await (await runtimeHandlers()).complete(request, context);
  } catch {
    return Response.json(failure({
      code: "INTERNAL_ERROR", message: "Practice is temporarily unavailable", retryable: true,
    }, requestId), { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
