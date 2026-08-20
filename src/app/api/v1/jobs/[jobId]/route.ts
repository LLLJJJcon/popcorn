import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import {
  createJobStatusRoute,
  parsePublicLearningArtifactResult,
  parsePublicResolveSnapshotResult,
  type PublicJobStatus,
} from "@/server/jobs/process-jobs";
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

function createStatusReader(
  client: SupabaseClient<Database>,
): JobStatusRouteDependencies["readPublicStatus"] {
  return async (expectedUserId, jobId) => {
    const result = await client
      .from("knowledge_jobs")
      .select("id,user_id,status,job_type")
      .eq("user_id", expectedUserId)
      .eq("id", jobId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || result.data.user_id !== expectedUserId) return null;
    const status = result.data.status as PublicJobStatus["status"];
    let publicResult: PublicJobStatus["result"] = null;
    if (status === "succeeded") {
      const internal = await client
        .from("knowledge_job_internal")
        .select("result,user_id")
        .eq("user_id", expectedUserId)
        .eq("knowledge_job_id", jobId)
        .single();
      if (internal.error || internal.data.user_id !== expectedUserId) {
        throw internal.error ?? new Error("private job owner mismatch");
      }
      publicResult = result.data.job_type === "resolve_snapshot"
        ? parsePublicResolveSnapshotResult(internal.data.result)
        : parsePublicLearningArtifactResult(internal.data.result);
    }
    return {
      id: result.data.id,
      status,
      retryable: status === "pending" || status === "leased" || status === "retryable_failed",
      result: publicResult,
    };
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
