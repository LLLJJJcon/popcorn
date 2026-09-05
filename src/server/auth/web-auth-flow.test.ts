import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SignInForm } from "@/app/sign-in/sign-in-form";

import type { NextCookieStore, WebCookieAdapter } from "./web-session";
import { createWebAuthFlowHandlers } from "./web-auth-flow";

const APP_URL = "https://popcorn.example/app/path";

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
  signUpError = null,
  signInError = null,
  signOutError = null,
  userId = "22222222-2222-4222-8222-222222222222",
  userEmail = "learner@example.com",
}: {
  signUpError?: Error | null;
  signInError?: Error | null;
  signOutError?: Error | null;
  userId?: string | null;
  userEmail?: string | null;
} = {}) {
  const writes: CookieWrite[] = [];
  const calls = {
    signUp: [] as unknown[],
    signIn: [] as unknown[],
    signOut: 0,
    getUser: 0,
    adapter: null as WebCookieAdapter | null,
  };
  const cookieStore: NextCookieStore = {
    getAll: () => [],
    set: (cookie) => writes.push(cookie),
  };
  const handlers = createWebAuthFlowHandlers({
    appUrl: APP_URL,
    supabaseUrl: "https://project.supabase.co",
    anonKey: "anon-key",
    cookieStore,
    clientFactory: ({ cookies }) => {
      calls.adapter = cookies;
      return {
        auth: {
          signUp: async (input: unknown) => {
            calls.signUp.push(input);
            return { data: {}, error: signUpError };
          },
          signInWithPassword: async (input: unknown) => {
            calls.signIn.push(input);
            return { data: {}, error: signInError };
          },
          signOut: async () => {
            calls.signOut += 1;
            return { error: signOutError };
          },
          getUser: async () => {
            calls.getUser += 1;
            return {
              data: { user: userId ? { id: userId, email: userEmail } : null },
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

describe("local Web password authentication", () => {
  it("renders dedicated password sign-in and account-creation controls", () => {
    const html = renderToStaticMarkup(createElement(SignInForm));

    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).toContain('type="password"');
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="sign-in"');
    expect(html).toContain('value="sign-up"');
    expect(html).not.toMatch(/magic link|oauth|google/i);
  });

  it("signs in through the shared SSR cookie client and uses a fixed success redirect", async () => {
    const { handlers, calls } = harness();

    const response = await handlers.signIn(formRequest(
      "intent=sign-in&email=learner%40example.com&password=correct-horse",
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://popcorn.example/settings/model-gateway",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.signIn).toEqual([{
      email: "learner@example.com",
      password: "correct-horse",
    }]);
    expect(calls.signUp).toEqual([]);
    expect(calls.adapter?.getAll()).toEqual([]);
  });

  it("creates an account with the same fixed success redirect", async () => {
    const { handlers, calls } = harness();

    const response = await handlers.signIn(formRequest(
      "intent=sign-up&email=new%40example.com&password=correct-horse",
    ));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://popcorn.example/settings/model-gateway",
    );
    expect(calls.signUp).toEqual([{ email: "new@example.com", password: "correct-horse" }]);
    expect(calls.signIn).toEqual([]);
  });

  it("uses the same generic failure for wrong credentials and rejected account creation", async () => {
    const wrongCredentials = harness({
      signInError: new Error("Invalid password correct-horse for learner@example.com"),
    });
    const rejectedSignUp = harness({
      signUpError: new Error("User new@example.com already registered"),
    });

    const [signInResponse, signUpResponse] = await Promise.all([
      wrongCredentials.handlers.signIn(formRequest(
        "intent=sign-in&email=learner%40example.com&password=correct-horse",
      )),
      rejectedSignUp.handlers.signIn(formRequest(
        "intent=sign-up&email=new%40example.com&password=correct-horse",
      )),
    ]);

    for (const response of [signInResponse, signUpResponse]) {
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        "https://popcorn.example/sign-in?status=error",
      );
      expect(await response.text()).not.toMatch(/correct-horse|learner|already|invalid/i);
    }
  });

  it.each([
    { name: "missing origin", headers: { Origin: "" }, body: "intent=sign-in&email=learner%40example.com&password=correct-horse", status: 403 },
    { name: "inexact origin", headers: { Origin: "https://evil.example" }, body: "intent=sign-in&email=learner%40example.com&password=correct-horse", status: 403 },
    { name: "wrong content type", headers: { "Content-Type": "application/json" }, body: "intent=sign-in&email=learner%40example.com&password=correct-horse", status: 400 },
    { name: "duplicate email", headers: {}, body: "intent=sign-in&email=a%40example.com&email=b%40example.com&password=correct-horse", status: 400 },
    { name: "extra redirect", headers: {}, body: "intent=sign-in&email=a%40example.com&password=correct-horse&next=https%3A%2F%2Fevil.example", status: 400 },
    { name: "invalid email", headers: {}, body: "intent=sign-in&email=not-an-email&password=correct-horse", status: 400 },
    { name: "short password", headers: {}, body: "intent=sign-in&email=a%40example.com&password=short", status: 400 },
    { name: "unknown intent", headers: {}, body: "intent=oauth&email=a%40example.com&password=correct-horse", status: 400 },
  ])("rejects $name without invoking Supabase password auth", async ({ headers, body, status }) => {
    const { handlers, calls } = harness();
    const response = await handlers.signIn(formRequest(body, headers as HeadersInit));

    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls.signIn).toEqual([]);
    expect(calls.signUp).toEqual([]);
    expect(await response.text()).not.toMatch(/correct-horse|learner|evil|oauth/i);
  });

  it("rejects declared and streamed bodies over 4 KiB", async () => {
    for (const headers of [{ "Content-Length": "4097" }, {}]) {
      const { handlers, calls } = harness();
      const response = await handlers.signIn(formRequest(
        `intent=sign-in&email=a%40example.com&password=${"a".repeat(4_097)}`,
        headers as HeadersInit,
      ));
      expect(response.status).toBe(400);
      expect(calls.signIn).toEqual([]);
    }
  });

  it("retires the callback operation", () => {
    expect("callback" in harness().handlers).toBe(false);
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
    expect(await allowed.text()).not.toMatch(/raw|failure/i);
  });

  it("authorizes pages only with verified getUser", async () => {
    const authenticated = harness();
    const anonymous = harness({ userId: null });

    await expect(authenticated.handlers.getPageAuthorization()).resolves.toBe(true);
    await expect(anonymous.handlers.getPageAuthorization()).resolves.toBe(false);
    expect(authenticated.calls.getUser).toBe(1);
    expect(anonymous.calls.getUser).toBe(1);
  });

  it("returns only a bounded verified account state without leaking a user UUID", async () => {
    const verified = harness();
    const missingEmail = harness({ userEmail: null });
    const expired = harness({ userId: null });

    await expect(verified.handlers.getPageAccount()).resolves.toEqual({
      authenticated: true,
      email: "learner@example.com",
    });
    await expect(missingEmail.handlers.getPageAccount()).resolves.toEqual({ authenticated: true });
    await expect(expired.handlers.getPageAccount()).resolves.toEqual({ authenticated: false });
  });
});
