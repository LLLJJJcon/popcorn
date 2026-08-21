import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import {
  ExpressionSearchQuerySchema,
  ExpressionSearchResultSchema,
  ExpressionSearchResultsSchema,
  expressionSearchQueryFromUrl,
  type ExpressionSearchQuery,
  type ExpressionSearchQueryInput,
  type ExpressionSearchResult,
} from "@/features/vault/search-schema";
import { failure, success } from "@/server/api/respond";
import {
  createNextCookieAdapter,
  createWebSessionAuthenticator,
  type WebSessionResult,
} from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

export interface ExpressionSearchRepository {
  searchExpressions(userId: string, query: ExpressionSearchQueryInput): Promise<readonly ExpressionSearchResult[]>;
}

export function createExpressionSearchRepository(
  client: Pick<SupabaseClient<Database>, "rpc">,
): ExpressionSearchRepository {
  return {
    async searchExpressions(userId, queryValue) {
      const query = ExpressionSearchQuerySchema.parse(queryValue);
      const result = await client.rpc("search_expressions", {
        p_user_id: userId,
        p_query: query.query,
        p_communicative_function: query.communicativeFunction,
        p_register: query.register,
        p_video_source_id: query.videoSourceId,
        p_mastery_state: query.masteryState,
        p_created_from: query.createdFrom,
        p_created_before: query.createdBefore,
        p_limit: query.limit,
      });
      if (result.error) throw new Error("expression search query failed");
      const rows = result.data.map((row) => ExpressionSearchResultSchema.parse({
        userExpressionId: row.user_expression_id,
        expressionSenseId: row.expression_sense_id,
        expressionText: row.expression_text,
        englishMeaning: row.english_meaning,
        communicativeFunction: row.communicative_function,
        register: row.register,
        masteryState: row.mastery_state,
        sourceCount: row.source_count,
        updatedAt: row.updated_at,
        matchReason: row.match_reason,
        ...("user_id" in row ? { userId: row.user_id } : {}),
      }));
      return ExpressionSearchResultsSchema.parse(rows);
    },
  };
}

function noStore(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function authFailure(session: WebSessionResult, requestId: string): Response | null {
  if (session.ok) return null;
  return noStore(failure({
    code: session.reason === "missing" ? "AUTH_REQUIRED" : "SESSION_EXPIRED",
    message: session.reason === "missing" ? "Authentication is required" : "Your session has expired",
    retryable: false,
  }, requestId), 401);
}

export function createExpressionSearchHttpHandler(dependencies: {
  readonly authenticate: (request: Request) => Promise<WebSessionResult>;
  readonly repository: ExpressionSearchRepository;
  readonly requestId: () => string;
}) {
  return async (request: Request): Promise<Response> => {
    const requestId = dependencies.requestId();
    const session = await dependencies.authenticate(request);
    const denied = authFailure(session, requestId);
    if (!session.ok) return denied!;

    let query: ExpressionSearchQuery;
    try {
      query = expressionSearchQueryFromUrl(new URL(request.url).searchParams);
    } catch {
      return noStore(failure({
        code: "VALIDATION_FAILED",
        message: "Invalid Vault search",
        retryable: false,
      }, requestId), 400);
    }

    try {
      return noStore(success(
        await dependencies.repository.searchExpressions(session.userId, query),
        requestId,
      ), 200);
    } catch {
      return noStore(failure({
        code: "INTERNAL_ERROR",
        message: "Vault search is temporarily unavailable",
        retryable: true,
      }, requestId), 500);
    }
  };
}

export async function createExpressionSearchRuntime() {
  const environment = getModelGatewaySettingsEnv();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(await cookies()),
  });
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return { authenticate, repository: createExpressionSearchRepository(client) };
}
