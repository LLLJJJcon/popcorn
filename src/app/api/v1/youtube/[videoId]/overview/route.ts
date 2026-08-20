import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import { createLearningArtifactRoute, createSupabaseLearningArtifactRouteStore } from "@/server/ai/provider";
import { YOUTUBE_OVERVIEW_PROMPT_VERSION } from "@/server/ai/prompts/youtube-overview.v1";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

type Context = { readonly params: Promise<{ readonly videoId: string }> };

function runtimeRoute() {
  const environment = getModelGatewaySettingsEnv();
  const service = createClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return createLearningArtifactRoute({
    jobType: "generate_overview",
    promptVersion: YOUTUBE_OVERVIEW_PROMPT_VERSION,
    requestId: randomUUID,
    store: createSupabaseLearningArtifactRouteStore(service),
    authenticate: async (request) => {
      const token = /^Bearer ([^\s]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
      if (!token) return null;
      const auth = createClient(environment.NEXT_PUBLIC_SUPABASE_URL, environment.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
      const result = await auth.auth.getUser(token);
      return result.error || !result.data.user ? null : { userId: result.data.user.id };
    },
  });
}

export async function POST(request: Request, context: Context): Promise<Response> {
  return runtimeRoute()(request, context);
}
