import type { NextCookieStore, WebCookieAdapter } from "./web-session";
import { createWebAuthFlowHandlers } from "./web-auth-flow";

const APP_URL = "https://popcorn.example/app/path";
const FLOW_ID = "11111111-1111-4111-8111-111111111111";

type CookieWrite = {
  name: string;
  value: string;
  path?: string;
  httpOnly?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  maxAge?: number;
};

function harness({
  initialCookies = [],
  otpError = null,
  exchangeError = null,
  signOutError = null,
  userId = "22222222-2222-4222-8222-222222222222",
}: {
  initialCookies?: { name: string; value: string }[];
  otpError?: Error | null;
  exchangeError?: Error | null;
  signOutError?: Error | null;
  userId?: string | null;
} = {}) {
  const writes: CookieWrite[] = [];
  const calls = {
    otp: [] as unknown[],
    exchange: [] as string[],
    signOut: 0,
    getUser: 0,
    adapter: null as WebCookieAdapter | null,
  };
  const cookieStore: NextCookieStore = {
    getAll: () => initialCookies,
    set: (cookie) => writes.push(cookie),
  };
  const handlers = createWebAuthFlowHandlers({
    appUrl: APP_URL,
    supabaseUrl: "https://project.supabase.co",
    anonKey: "anon-key",
    cookieStore,
    newFlowId: () => FLOW_ID,
    clientFactory: ({ cookies }) => {
      calls.adapter = cookies;
      return {
        auth: {
          signInWithOtp: async (input) => {
            calls.otp.push(input);
            return { data: {}, error: otpError };
          },
          exchangeCodeForSession: async (code) => {
            calls.exchange.push(code);
            return { data: {}, error: exchangeError };
          },
          signOut: async () => {
            calls.signOut += 1;
            return { error: signOutError };
          },
          getUser: async () => {
            calls.getUser += 1;
            return {
              data: { user: userId ? { id: userId } : null },
              error: userId ? null : new Error("raw expired-session detail"),
            };
          },
        },
      };
    },
  });
  return { handlers, writes, calls };
}

function formRequest(body: string, headers: HeadersInit = {}) {
  return new Request("https://popcorn.example/auth/sign-in", {
    method: "POST",
    headers: {
      Origin: "https://popcorn.example",
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body,
  });
}

describe("server-only Web authentication flow", () => {
  it("uses the shared SSR cookie adapter and a fixed callback for magic-link sign-in", async () => {
    const { handlers, writes, calls } = harness();
    const response = await handlers.signIn(formRequest("email=learner%40example.com"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://popcorn.example/sign-in?status=check-email");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.otp).toEqual([{
      email: "learner@example.com",
      options: {
        emailRedirectTo: `https://popcorn.example/auth/callback?flow=${FLOW_ID}`,
      },
    }]);
    expect(writes).toEqual([expect.objectContaining({
      name: "popcorn-auth-flow",
      value: FLOW_ID,
      path: "/auth/callback",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 600,
    })]);
    expect(calls.adapter?.getAll()).toEqual([]);
  });

  it.each([
    { name: "missing origin", headers: { Origin: "" }, body: "email=learner%40example.com", status: 403 },
    { name: "inexact origin", headers: { Origin: "https://evil.example" }, body: "email=learner%40example.com", status: 403 },
    { name: "wrong content type", headers: { "Content-Type": "application/json" }, body: "email=learner%40example.com", status: 400 },
    { name: "duplicate email", headers: {}, body: "email=a%40example.com&email=b%40example.com", status: 400 },
    { name: "extra redirect", headers: {}, body: "email=a%40example.com&next=https%3A%2F%2Fevil.example", status: 400 },
    { name: "invalid email", headers: {}, body: "email=not-an-email", status: 400 },
  ])("rejects $name without invoking email delivery", async ({ headers, body, status }) => {
    const { handlers, calls } = harness();
    const response = await handlers.signIn(formRequest(body, headers as HeadersInit));
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.otp).toEqual([]);
    expect(await response.text()).not.toMatch(/learner|evil|not-an-email|redirect/i);
  });

  it("rejects declared and streamed bodies over 4 KiB", async () => {
    for (const headers of [{ "Content-Length": "4097" }, {}]) {
      const { handlers, calls } = harness();
      const response = await handlers.signIn(formRequest(`email=${"a".repeat(4_097)}`, headers as HeadersInit));
      expect(response.status).toBe(400);
      expect(calls.otp).toEqual([]);
    }
  });

  it("returns the same enumeration-safe response when the email provider rejects", async () => {
    const success = harness();
    const failure = harness({ otpError: new Error("user does not exist: learner@example.com") });
    const [successResponse, failureResponse] = await Promise.all([
      success.handlers.signIn(formRequest("email=learner%40example.com")),
      failure.handlers.signIn(formRequest("email=learner%40example.com")),
    ]);
    expect({ status: failureResponse.status, location: failureResponse.headers.get("location") }).toEqual({
      status: successResponse.status,
      location: successResponse.headers.get("location"),
    });
    expect(await failureResponse.text()).not.toMatch(/learner|does not exist|example\.com/i);
  });

  it("exchanges a code once when the UUID flow matches and clears the callback cookie", async () => {
    const { handlers, writes, calls } = harness({
      initialCookies: [{ name: "popcorn-auth-flow", value: FLOW_ID }],
    });
    const response = await handlers.callback(new Request(
      `https://popcorn.example/auth/callback?code=pkce-code&flow=${FLOW_ID}`,
    ));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://popcorn.example/settings/model-gateway");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.exchange).toEqual(["pkce-code"]);
    expect(writes).toContainEqual(expect.objectContaining({
      name: "popcorn-auth-flow",
      value: "",
      path: "/auth/callback",
      maxAge: 0,
    }));
  });

  it.each([
    `https://popcorn.example/auth/callback?code=a&code=b&flow=${FLOW_ID}`,
    `https://popcorn.example/auth/callback?code=a&flow=${FLOW_ID}&next=https://evil.example`,
    `https://popcorn.example/auth/callback?code=a&flow=not-a-uuid`,
    `https://popcorn.example/auth/callback?token=secret&flow=${FLOW_ID}`,
    `https://popcorn.example/auth/callback?code=a&flow=${FLOW_ID}#access_token=secret`,
    `https://evil.example/auth/callback?code=a&flow=${FLOW_ID}`,
  ])("rejects malformed callback query, clears flow state, and never exchanges: %s", async (url) => {
    const { handlers, writes, calls } = harness({
      initialCookies: [{ name: "popcorn-auth-flow", value: FLOW_ID }],
    });
    const response = await handlers.callback(new Request(url));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://popcorn.example/sign-in");
    expect(calls.exchange).toEqual([]);
    expect(writes).toContainEqual(expect.objectContaining({ name: "popcorn-auth-flow", value: "", maxAge: 0 }));
    expect(await response.text()).not.toMatch(/secret|evil|pkce/i);
  });

  it("rejects a missing or mismatched one-time cookie and does not replay it", async () => {
    for (const initialCookies of [[], [{ name: "popcorn-auth-flow", value: "33333333-3333-4333-8333-333333333333" }]]) {
      const { handlers, calls } = harness({ initialCookies });
      const response = await handlers.callback(new Request(
        `https://popcorn.example/auth/callback?code=pkce-code&flow=${FLOW_ID}`,
      ));
      expect(response.headers.get("location")).toBe("https://popcorn.example/sign-in");
      expect(calls.exchange).toEqual([]);
    }
  });

  it("fails callback closed on provider error without leaking code or raw text", async () => {
    const { handlers } = harness({
      initialCookies: [{ name: "popcorn-auth-flow", value: FLOW_ID }],
      exchangeError: new Error("raw pkce-code provider detail"),
    });
    const response = await handlers.callback(new Request(
      `https://popcorn.example/auth/callback?code=pkce-code&flow=${FLOW_ID}`,
    ));
    expect(response.headers.get("location")).toBe("https://popcorn.example/sign-in");
    expect(await response.text()).not.toMatch(/pkce-code|provider detail/i);
  });

  it("signs out only from an exact-origin POST and always uses the fixed redirect", async () => {
    const { handlers, calls } = harness({ signOutError: new Error("raw sign-out failure") });
    const denied = await handlers.signOut(new Request("https://popcorn.example/auth/sign-out", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    }));
    expect(denied.status).toBe(403);
    expect(calls.signOut).toBe(0);

    const allowed = await handlers.signOut(new Request("https://popcorn.example/auth/sign-out", {
      method: "POST",
      headers: { Origin: "https://popcorn.example" },
    }));
    expect(calls.signOut).toBe(1);
    expect(allowed.status).toBe(303);
    expect(allowed.headers.get("location")).toBe("https://popcorn.example/sign-in");
    expect(allowed.headers.get("cache-control")).toBe("no-store");
    expect(await allowed.text()).not.toMatch(/raw|failure/i);
  });

  it("authorizes pages only with verified getUser and never returns identity details", async () => {
    const authenticated = harness();
    const anonymous = harness({ userId: null });
    await expect(authenticated.handlers.getPageAuthorization()).resolves.toBe(true);
    await expect(anonymous.handlers.getPageAuthorization()).resolves.toBe(false);
    expect(authenticated.calls.getUser).toBe(1);
    expect(anonymous.calls.getUser).toBe(1);
  });
});
