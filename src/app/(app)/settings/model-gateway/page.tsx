import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ModelGatewaySettings } from "@/app/settings/model-gateway/model-gateway-settings";
import { createWebAuthFlowHandlers } from "@/server/auth/web-auth-flow";
import { getModelGatewaySettingsEnv } from "@/server/env";

export default async function ModelGatewaySettingsPage() {
  const environment = getModelGatewaySettingsEnv();
  const authorized = await createWebAuthFlowHandlers({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore: await cookies(),
  }).getPageAuthorization();
  if (!authorized) redirect("/sign-in");

  return <ModelGatewaySettings />;
}
