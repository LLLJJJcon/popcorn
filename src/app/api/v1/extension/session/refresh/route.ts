import { z } from "zod";

const requestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(8192),
  userId: z.string().min(1).max(200),
});

type RefreshEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  EXTENSION_REDIRECT_ORIGIN: string;
};

type RefreshDependencies = {
  environment: RefreshEnvironment;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
};

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function createRefreshHandler({ environment, fetcher = fetch, now = Date.now }: RefreshDependencies) {
  return async function post(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (request.headers.get("origin") !== environment.EXTENSION_REDIRECT_ORIGIN) {
      return json({ ok: false, error: "forbidden" }, 403);
    }

    const rawBody = await request.text();
    if (rawBody.length > 8_192) return json({ ok: false, error: "invalid_request" }, 400);
    let input: z.infer<typeof requestSchema>;
    try {
      input = requestSchema.parse(JSON.parse(rawBody));
    } catch {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    let providerResponse: Response;
    try {
      providerResponse = await fetcher(`${environment.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: input.refreshToken }),
      });
    } catch {
      return json({ ok: false, error: "refresh_failed" }, 502);
    }
    if (!providerResponse.ok) return json({ ok: false, error: "refresh_failed" }, 502);

    let provider: unknown;
    try {
      provider = await providerResponse.json();
    } catch {
      return json({ ok: false, error: "refresh_failed" }, 502);
    }
    const parsed = z.object({
      access_token: z.string().min(1).max(8192),
      refresh_token: z.string().min(1).max(8192),
      expires_in: z.number().int().positive().max(86_400),
      user: z.object({ id: z.string().min(1).max(200), email: z.string().email().max(320) }),
    }).safeParse(provider);
    if (!parsed.success || parsed.data.user.id !== input.userId) {
      return json({ ok: false, error: "refresh_failed" }, 502);
    }

    return json({
      ok: true,
      data: {
        session: {
          accessToken: parsed.data.access_token,
          refreshToken: parsed.data.refresh_token,
          accessExpiresAt: now() + parsed.data.expires_in * 1_000,
          user: { id: parsed.data.user.id, email: parsed.data.user.email },
        },
      },
      requestId: "extension-session-refresh",
    }, 200);
  };
}

export async function POST(request: Request) {
  const { getServerEnv } = await import("@/server/env");
  return createRefreshHandler({ environment: getServerEnv() })(request);
}
