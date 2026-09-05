import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import { createJobStatusRoute, type PublicJobStatus } from "@/server/jobs/process-jobs";
import { createStatusReader } from "@/server/jobs/public-job-status";
import type { Database } from "@/types/database.generated";

type AuthenticatedUser = { readonly userId: string };
type RouteContext = { readonly params: Promise<{ jobId: string }> };

type JobStatusRouteDependencies = {
  readonly authenticate: (request: Request) => Promise<AuthenticatedUser | null>;
  readonly readPublicStatus: (
    expectedUserId: string,
    jobId: string,
  ) => Promise<PublicJobStatus | null>;
  readonly requestId: () => string;
};

function createServiceClient(): SupabaseClient<Database> {
  const environment = getServerEnv();
  return createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function createAuthenticator(): JobStatusRouteDependencies["authenticate"] {
  const environment = getServerEnv();
  return async (request) => {
    const token = /^Bearer ([^\s]+)$/.exec(
      request.headers.get("authorization") ?? "",
    )?.[1];
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

function runtimeRoute() {
  return createJobStatusRoute({
    authenticate: createAuthenticator(),
    readPublicStatus: createStatusReader(createServiceClient()),
    requestId: randomUUID,
  });
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return runtimeRoute()(request, context);
}
