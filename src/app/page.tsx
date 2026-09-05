import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createWebAuthFlowHandlers } from "@/server/auth/web-auth-flow";
import { getModelGatewaySettingsEnv } from "@/server/env";

export default async function RootPage() {
  const environment = getModelGatewaySettingsEnv();
  const account = await createWebAuthFlowHandlers({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore: await cookies(),
  }).getPageAccount();
  redirect(account.authenticated ? "/home" : "/sign-in");
}
