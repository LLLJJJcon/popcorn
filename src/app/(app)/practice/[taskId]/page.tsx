import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { PracticeSession } from "@/features/practice/practice-session";
import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createPracticeMaterialRepository } from "@/server/repositories/practice-material-repository";
import type { Database } from "@/types/database.generated";

const savedReturnTargetPattern = /^\/saved\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}#saved-item-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PracticeTaskPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly taskId: string }>;
  readonly searchParams: Promise<{ readonly returnTo?: string | string[] }>;
}) {
  const environment = getModelGatewaySettingsEnv();
  const authenticate = createWebSessionAuthenticator({
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secureCookies: new URL(environment.APP_URL).protocol === "https:",
    cookieAdapter: async () => createNextCookieAdapter(await cookies()),
  });
  const session = await authenticate(new Request(environment.APP_URL));
  if (!session.ok) redirect("/sign-in");
  const client = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const material = await createPracticeMaterialRepository(client).findImmediateMaterial(
    session.userId,
    (await params).taskId,
  );
  if (!material) notFound();
  const requestedReturnTarget = (await searchParams).returnTo;
  const savedReturnTarget = typeof requestedReturnTarget === "string"
    && savedReturnTargetPattern.test(requestedReturnTarget)
    ? requestedReturnTarget
    : null;
  return <PracticeSession material={material} savedReturnTarget={savedReturnTarget} />;
}
