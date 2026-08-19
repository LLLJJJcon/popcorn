import { createNextCookieAdapter, createWebSessionAuthenticator } from "./web-session";

describe("createNextCookieAdapter", () => {
  it("maps reads exactly and forwards secure cookie writes without dropping options", async () => {
    const writes: unknown[] = [];
    const adapter = createNextCookieAdapter({
      getAll: () => [
        { name: "sb-project-auth-token", value: "verified", domain: "ignored.example" },
        { name: "theme", value: "dark" },
      ],
      set: (cookie) => {
        writes.push(cookie);
      },
    });

    expect(adapter.getAll()).toEqual([
      { name: "sb-project-auth-token", value: "verified" },
      { name: "theme", value: "dark" },
    ]);

    await adapter.setAll?.([
      {
        name: "sb-project-auth-token",
        value: "refreshed",
        options: {
          httpOnly: true,
          sameSite: "lax",
          secure: true,
          path: "/",
          maxAge: 3_600,
        },
      },
    ]);

    expect(writes).toEqual([
      {
        name: "sb-project-auth-token",
        value: "refreshed",
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/",
        maxAge: 3_600,
      },
    ]);
  });
});

describe("createWebSessionAuthenticator", () => {
  const request = (headers?: HeadersInit) =>
    new Request("https://popcorn.example/api/v1/settings/model-gateway", { headers });

  it("rejects a missing cookie without constructing an auth client", async () => {
    let clients = 0;
    const authenticate = createWebSessionAuthenticator({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon",
      clientFactory: () => {
        clients += 1;
        throw new Error("must not construct");
      },
    });

    await expect(authenticate(request())).resolves.toEqual({ ok: false, reason: "missing" });
    expect(clients).toBe(0);
  });

  it("does not accept a bearer token when the browser cookie is absent", async () => {
    const authenticate = createWebSessionAuthenticator({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon",
      clientFactory: () => { throw new Error("must not construct"); },
    });

    await expect(authenticate(request({ Authorization: "Bearer browser-token" }))).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("does not treat unrelated browser cookies as a Popcorn session", async () => {
    const authenticate = createWebSessionAuthenticator({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon",
      clientFactory: () => { throw new Error("must not construct"); },
    });

    await expect(authenticate(request({ Cookie: "theme=dark" }))).resolves.toEqual({
      ok: false,
      reason: "missing",
    });
  });

  it("uses the SSR cookie adapter and verified getUser identity", async () => {
    let getUserCalls = 0;
    let seenCookies: readonly { name: string; value: string }[] = [];
    const authenticate = createWebSessionAuthenticator({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon",
      secureCookies: true,
      clientFactory: (_url, _key, options) => {
        seenCookies = options.cookies.getAll();
        expect(options.cookieOptions).toEqual({
          path: "/",
          httpOnly: true,
          sameSite: "lax",
          secure: true,
        });
        return {
          auth: {
            getUser: async () => {
              getUserCalls += 1;
              return { data: { user: { id: "11111111-1111-4111-8111-111111111111" } }, error: null };
            },
          },
        };
      },
    });

    await expect(authenticate(request({ Cookie: "sb-access-token=verified; theme=dark" }))).resolves.toEqual({
      ok: true,
      userId: "11111111-1111-4111-8111-111111111111",
    });
    expect(getUserCalls).toBe(1);
    expect(seenCookies).toEqual([
      { name: "sb-access-token", value: "verified" },
      { name: "theme", value: "dark" },
    ]);
  });

  it("maps an invalid or expired cookie to expired without exposing provider errors", async () => {
    const authenticate = createWebSessionAuthenticator({
      supabaseUrl: "https://project.supabase.co",
      anonKey: "anon",
      clientFactory: () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: new Error("raw auth token") }) },
      }),
    });

    await expect(authenticate(request({ Cookie: "sb-access-token=expired" }))).resolves.toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
