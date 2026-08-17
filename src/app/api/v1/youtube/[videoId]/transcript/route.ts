import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import { createSupabaseTranscriptStore } from "@/server/jobs/process-jobs";
import { createTranscriptRoute } from "@/server/transcript/provider";
import { createSupadataTranscriptProvider } from "@/server/transcript/supadata-provider";
import type { Database } from "@/types/database.generated";

type AuthenticatedUser = { readonly userId: string };
type RouteContext = { readonly params: Promise<{ videoId: string }> };

function bearerToken(request: Request): string | null {
  const match = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "");
  return match?.[1] ?? null;
}

function createAuthenticator(): (request: Request) => Promise<AuthenticatedUser | null> {
  const environment = getServerEnv();
  return async (request) => {
    const token = bearerToken(request);
    if (!token) return null;
    const client = createClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    const { data, error } = await client.auth.getUser(token);
    return error || !data.user ? null : { userId: data.user.id };
  };
}

function createServiceClient(): SupabaseClient<Database> {
  const environment = getServerEnv();
  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function runtimeRoute() {
  const environment = getServerEnv();
  return createTranscriptRoute({
    authenticate: createAuthenticator(),
    provider: createSupadataTranscriptProvider({ apiKey: environment.SUPADATA_API_KEY }),
    store: createSupabaseTranscriptStore(createServiceClient()),
    requestId: randomUUID,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return runtimeRoute()(request, context);
}
