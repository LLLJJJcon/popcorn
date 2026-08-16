import { describe, expect, test, vi } from "vitest";

import { createExchangeHandler } from "@/app/api/v1/extension/session/exchange/route";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  EXTENSION_REDIRECT_ORIGIN: "chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp",
};
const redirectUri = `${environment.EXTENSION_REDIRECT_ORIGIN}/supabase`;
const body = { code: "one-time-code", codeVerifier: "v".repeat(64), redirectUri };

describe("extension session exchange", () => {
  test("exchanges one valid PKCE code once into a bounded no-store session", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=pkce");
      expect(JSON.parse(String(init?.body))).toEqual({ auth_code: body.code, code_verifier: body.codeVerifier });
      return new Response(JSON.stringify({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        user: { id: "user-a", email: "a@example.com", ignored: "not-returned" },
      }), { status: 200 });
    });
    const post = createExchangeHandler({ environment, fetcher, now: () => 1_700_000_000_000 });

    const result = await post(new Request("https://app.popcorn.local/api/v1/extension/session/exchange", { method: "POST", body: JSON.stringify(body) }));
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    await expect(result.json()).resolves.toMatchObject({ ok: true, data: { session: { accessToken: "access-token", refreshToken: "refresh-token", accessExpiresAt: 1_700_003_600_000, user: { id: "user-a", email: "a@example.com" } } } });
    expect(fetcher).toHaveBeenCalledTimes(1);

    const replay = await post(new Request("https://app.popcorn.local/api/v1/extension/session/exchange", { method: "POST", body: JSON.stringify(body) }));
    expect(replay.status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("rejects malformed redirect and bounded fields without provider leakage", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "provider-secret-response" }), { status: 401 }));
    const post = createExchangeHandler({ environment, fetcher });
    for (const invalid of [
      { ...body, redirectUri: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/other" },
      { ...body, code: "x".repeat(2049) },
      { ...body, codeVerifier: "" },
      { ...body, unexpected: "field" },
    ]) {
      const result = await post(new Request("https://app.popcorn.local/api/v1/extension/session/exchange", { method: "POST", body: JSON.stringify(invalid) }));
      expect(result.status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();

    const providerFailure = await post(new Request("https://app.popcorn.local/api/v1/extension/session/exchange", { method: "POST", body: JSON.stringify(body) }));
    expect(providerFailure.status).toBe(502);
    expect(await providerFailure.text()).not.toContain("provider-secret-response");
  });
});
