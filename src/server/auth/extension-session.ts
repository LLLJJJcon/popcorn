import { z } from "zod";

const exchangeRequestSchema = z.strictObject({
  code: z.string().min(1).max(2048),
  codeVerifier: z.string().min(43).max(512),
  redirectUri: z.string().url().max(256),
});

const refreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(8192),
  userId: z.string().min(1).max(200),
});

export type ExtensionSessionEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  EXTENSION_REDIRECT_ORIGIN: string;
};

type ExtensionSessionDependencies = {
  environment: ExtensionSessionEnvironment;
  fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
  now?: () => number;
};

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const parseRequest = async <T>(request: Request, schema: z.ZodType<T>) => {
  const rawBody = await request.text();
  if (rawBody.length > 8_192) return null;
  try {
    return schema.parse(JSON.parse(rawBody));
  } catch {
    return null;
  }
};

const parseProviderSession = (provider: unknown) =>
  z.object({
    access_token: z.string().min(1).max(8192),
    refresh_token: z.string().min(1).max(8192),
    expires_in: z.number().int().positive().max(86_400),
    user: z.object({ id: z.string().min(1).max(200), email: z.string().email().max(320) }),
  }).safeParse(provider);

export function createExchangeHandler({ environment, fetcher = fetch, now = Date.now }: ExtensionSessionDependencies) {
  const expectedRedirectUri = `${environment.EXTENSION_REDIRECT_ORIGIN}/supabase`;

  return async function post(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (request.headers.get("origin") !== environment.EXTENSION_REDIRECT_ORIGIN) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const input = await parseRequest(request, exchangeRequestSchema);
    if (!input || input.redirectUri !== expectedRedirectUri) {
      return json({ ok: false, error: "invalid_request" }, 400);
    }

    let providerResponse: Response;
    try {
      providerResponse = await fetcher(`${environment.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY },
        body: JSON.stringify({ auth_code: input.code, code_verifier: input.codeVerifier }),
      });
    } catch {
      return json({ ok: false, error: "exchange_failed" }, 502);
    }
    if (!providerResponse.ok) return json({ ok: false, error: "exchange_failed" }, 502);

    let provider: unknown;
    try {
      provider = await providerResponse.json();
    } catch {
      return json({ ok: false, error: "exchange_failed" }, 502);
    }
    const parsed = parseProviderSession(provider);
    if (!parsed.success) return json({ ok: false, error: "exchange_failed" }, 502);

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
      requestId: "extension-session-exchange",
    }, 200);
  };
}

export function createRefreshHandler({ environment, fetcher = fetch, now = Date.now }: ExtensionSessionDependencies) {
  return async function post(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
    if (request.headers.get("origin") !== environment.EXTENSION_REDIRECT_ORIGIN) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
    const input = await parseRequest(request, refreshRequestSchema);
    if (!input) return json({ ok: false, error: "invalid_request" }, 400);

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
    const parsed = parseProviderSession(provider);
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
