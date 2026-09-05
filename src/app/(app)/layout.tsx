import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/features/shell/app-shell";
import { createWebAuthFlowHandlers } from "@/server/auth/web-auth-flow";
import { getModelGatewaySettingsEnv } from "@/server/env";

export default async function AppLayout({ children }: { readonly children: React.ReactNode }) {
  const environment = getModelGatewaySettingsEnv();
  const account = await createWebAuthFlowHandlers({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore: await cookies(),
  }).getPageAccount();
  if (!account.authenticated) redirect("/sign-in");

  return <AppShell account={{ email: account.email }}>{children}</AppShell>;
}
