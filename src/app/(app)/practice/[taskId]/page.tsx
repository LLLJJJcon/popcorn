import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { resolvePracticeReturnTarget } from "@/features/practice/return-target";
import { PracticeSession } from "@/features/practice/practice-session";
import { createNextCookieAdapter, createWebSessionAuthenticator } from "@/server/auth/web-session";
import { getModelGatewaySettingsEnv } from "@/server/env";
import { createPracticeMaterialRepository } from "@/server/repositories/practice-material-repository";
import type { Database } from "@/types/database.generated";

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
  const savedReturnTarget = resolvePracticeReturnTarget(requestedReturnTarget).href;
  return <PracticeSession key={material.task.id} material={material} savedReturnTarget={savedReturnTarget} />;
}
