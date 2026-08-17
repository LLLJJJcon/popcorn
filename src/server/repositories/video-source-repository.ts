import { createClient } from "@supabase/supabase-js";

import { getServerEnv } from "@/server/env";
import type { Database } from "@/types/database.generated";

export type CaptureRpcArgs =
  Database["public"]["Functions"]["capture_saved_item"]["Args"];

export type CaptureRpcResponse = {
  data: unknown;
  error: unknown;
};

export type CaptureRpcClient = {
  ownerUserId: string;
  rpc: (
    functionName: "capture_saved_item",
    args: CaptureRpcArgs,
  ) => Promise<CaptureRpcResponse>;
};

export type CaptureAuthentication<TClient = CaptureRpcClient> =
  | { ok: true; userId: string; client: TClient }
  | { ok: false; reason: "missing" | "expired" };

export class CaptureScopeError extends Error {
  constructor() {
    super("Capture client owner does not match the verified user.");
    this.name = "CaptureScopeError";
  }
}

export function assertCaptureScope(userId: string, client: CaptureRpcClient) {
  if (client.ownerUserId !== userId) {
    throw new CaptureScopeError();
  }
}

const bearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  return match?.[1] ?? null;
};

export async function authenticateCaptureRequest(
  request: Request,
): Promise<CaptureAuthentication> {
  const token = bearerToken(request);
  if (!token) return { ok: false, reason: "missing" };

  const environment = getServerEnv();
  const supabase = createClient<Database>(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, reason: "expired" };

  const ownerUserId = data.user.id;
  return {
    ok: true,
    userId: ownerUserId,
    client: {
      ownerUserId,
      rpc: async (_functionName, args) => {
        const result = await supabase.rpc("capture_saved_item", args);
        return { data: result.data, error: result.error };
      },
    },
  };
}
