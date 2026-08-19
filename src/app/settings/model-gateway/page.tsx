import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createWebAuthFlowHandlers } from "@/server/auth/web-auth-flow";
import { getModelGatewaySettingsEnv } from "@/server/env";

import { ModelGatewaySettings } from "./model-gateway-settings";

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
