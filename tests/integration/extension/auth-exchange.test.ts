import { describe, expect, test, vi } from "vitest";

import { createExchangeHandler } from "@/server/auth/extension-session";
import { ExtensionRedirectOriginSchema } from "@/server/env";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  EXTENSION_REDIRECT_ORIGIN: ExtensionRedirectOriginSchema.parse("https://meocnghfgmmcnnjiihpcgjnaameioddp.chromiumapp.org"),
};
const requestOrigin = "chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp";
const redirectUri = `${environment.EXTENSION_REDIRECT_ORIGIN}/supabase`;
const body = { code: "one-time-code", codeVerifier: "v".repeat(64), redirectUri };
const request = (payload = body, origin = requestOrigin) =>
  new Request("https://app.popcorn.local/api/v1/extension/session/exchange", {
    method: "POST",
    headers: { Origin: origin },
    body: JSON.stringify(payload),
  });

describe("extension session exchange", () => {
  test("uses one external PKCE challenge and lets Supabase authoritatively reject replay", async () => {
    let providerCalls = 0;
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      providerCalls += 1;
      expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=pkce");
      expect(JSON.parse(String(init?.body))).toEqual({ auth_code: body.code, code_verifier: body.codeVerifier });
      if (providerCalls === 2) return new Response(JSON.stringify({ message: "provider replay body" }), { status: 400 });
      return new Response(JSON.stringify({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 3600, user: { id: "user-a", email: "a@example.com", ignored: "not-returned" } }), { status: 200 });
    });
    const post = createExchangeHandler({ environment, fetcher, now: () => 1_700_000_000_000 });

    const result = await post(request());
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    await expect(result.json()).resolves.toMatchObject({ ok: true, data: { session: { accessToken: "access-token", refreshToken: "refresh-token", accessExpiresAt: 1_700_003_600_000, user: { id: "user-a", email: "a@example.com" } } } });
    const replay = await post(request());
    expect(replay.status).toBe(502);
    expect(await replay.text()).not.toContain("provider replay body");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("rejects wrong HTTP origin, malformed inputs, and provider leakage", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "provider-secret-response" }), { status: 401 }));
    const post = createExchangeHandler({ environment, fetcher });
    expect((await post(request(body, "chrome-extension://abcdefghijklmnopabcdefghijklmnop"))).status).toBe(403);
    for (const invalid of [
      { ...body, redirectUri: "chrome-extension://abcdefghijklmnopabcdefghijklmnop/other" },
      { ...body, code: "x".repeat(2049) },
      { ...body, codeVerifier: "" },
      { ...body, unexpected: "field" },
    ]) expect((await post(request(invalid))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
    const providerFailure = await post(request());
    expect(providerFailure.status).toBe(502);
    expect(await providerFailure.text()).not.toContain("provider-secret-response");
  });
});
