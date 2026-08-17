import { createRefreshHandler } from "@/server/auth/extension-session";

export async function POST(request: Request) {
  const { getServerEnv } = await import("@/server/env");
  return createRefreshHandler({ environment: getServerEnv() })(request);
}
