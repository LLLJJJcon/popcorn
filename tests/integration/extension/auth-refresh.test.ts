import { describe, expect, test, vi } from "vitest";

import { createRefreshHandler } from "@/app/api/v1/extension/session/refresh/route";

const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  EXTENSION_REDIRECT_ORIGIN: "chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp",
};
const request = (body: unknown, origin = environment.EXTENSION_REDIRECT_ORIGIN) =>
  new Request("https://app.popcorn.local/api/v1/extension/session/refresh", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });

describe("extension session refresh", () => {
  test("uses server-held Supabase credentials with exact origin and expected user", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://project.supabase.co/auth/v1/token?grant_type=refresh_token");
      expect(init?.headers).toMatchObject({ apikey: "anon-key" });
      expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "refresh" });
      return new Response(JSON.stringify({ access_token: "access", refresh_token: "next-refresh", expires_in: 3600, user: { id: "user-a", email: "a@example.com" } }), { status: 200 });
    });
    const post = createRefreshHandler({ environment, fetcher, now: () => 1_700_000_000_000 });
    const result = await post(request({ refreshToken: "refresh", userId: "user-a" }));
    expect(result.headers.get("Cache-Control")).toBe("no-store");
    await expect(result.json()).resolves.toMatchObject({
      ok: true,
      data: { session: { accessToken: "access", user: { id: "user-a", email: "a@example.com" } } },
    });
  });

  test("rejects wrong origin, bounded input, user switches, and provider-body leakage", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ message: "provider body must not escape", access_token: "access", refresh_token: "next", expires_in: 1, user: { id: "user-b", email: "b@example.com" } }), { status: 200 }));
    const post = createRefreshHandler({ environment, fetcher });
    expect((await post(request({ refreshToken: "refresh", userId: "user-a" }, "chrome-extension://abcdefghijklmnopabcdefghijklmnop"))).status).toBe(403);
    const wrongUser = await post(request({ refreshToken: "refresh", userId: "user-a" }));
    expect(wrongUser.status).toBe(502);
    expect(await wrongUser.text()).not.toContain("provider body must not escape");
  });
});
