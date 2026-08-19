import { randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  createNextCookieAdapter,
  createPopcornSsrServerClient,
  type NextCookieStore,
  type WebCookieAdapter,
} from "./web-session";

const FLOW_COOKIE = "popcorn-auth-flow";
const FLOW_MAX_AGE_SECONDS = 10 * 60;
const MAX_FORM_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EmailSchema = z
  .string()
  .max(254)
  .email()
  .refine((value) => value === value.trim());

type WebAuthClient = {
  readonly auth: {
    readonly signInWithOtp: (input: {
      readonly email: string;
      readonly options: { readonly emailRedirectTo: string };
    }) => Promise<{ readonly data: unknown; readonly error: unknown }>;
    readonly exchangeCodeForSession: (
      code: string,
    ) => Promise<{ readonly data: unknown; readonly error: unknown }>;
    readonly signOut: () => Promise<{ readonly error: unknown }>;
    readonly getUser: () => Promise<{
      readonly data: { readonly user: { readonly id: string } | null };
      readonly error: unknown;
    }>;
  };
};

type ClientFactory = (input: {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly cookies: WebCookieAdapter;
  readonly secureCookies: boolean;
}) => WebAuthClient;

function redirectTo(origin: string, path: string): Response {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: new URL(path, origin).toString(),
    },
  });
}

function genericFailure(status: number): Response {
  return new Response("Unable to complete authentication", {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

async function readBoundedForm(request: Request): Promise<URLSearchParams> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded") throw new TypeError("invalid form");
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_FORM_BYTES)) {
    throw new TypeError("invalid form");
  }
  if (!request.body) throw new TypeError("invalid form");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_FORM_BYTES) {
      await reader.cancel();
      throw new TypeError("invalid form");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

function equalFlow(left: string, right: string): boolean {
  if (!UUID_PATTERN.test(left) || !UUID_PATTERN.test(right)) return false;
  const leftBytes = Buffer.from(left.toLowerCase());
  const rightBytes = Buffer.from(right.toLowerCase());
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createWebAuthFlowHandlers({
  appUrl,
  supabaseUrl,
  anonKey,
  cookieStore,
  newFlowId = randomUUID,
  clientFactory = (input) => createPopcornSsrServerClient(input) as unknown as WebAuthClient,
}: {
  readonly appUrl: string;
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly cookieStore: NextCookieStore;
  readonly newFlowId?: () => string;
  readonly clientFactory?: ClientFactory;
}) {
  const origin = new URL(appUrl).origin;
  const secureCookies = new URL(appUrl).protocol === "https:";
  const cookies = createNextCookieAdapter(cookieStore);
  const client = clientFactory({ supabaseUrl, anonKey, cookies, secureCookies });

  function setFlow(value: string, maxAge: number) {
    cookieStore.set({
      name: FLOW_COOKIE,
      value,
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
      path: "/auth/callback",
      maxAge,
    });
  }

  return {
    async signIn(request: Request): Promise<Response> {
      if (request.method !== "POST" || request.headers.get("origin") !== origin) {
        return genericFailure(403);
      }
      let params: URLSearchParams;
      try {
        params = await readBoundedForm(request);
      } catch {
        return genericFailure(400);
      }
      const emails = params.getAll("email");
      const parsedEmail = EmailSchema.safeParse(emails[0]);
      if (params.size !== 1 || emails.length !== 1 || !parsedEmail.success) {
        return genericFailure(400);
      }

      const flow = newFlowId();
      if (!UUID_PATTERN.test(flow)) return genericFailure(500);
      setFlow(flow, FLOW_MAX_AGE_SECONDS);
      try {
        await client.auth.signInWithOtp({
          email: parsedEmail.data,
          options: {
            emailRedirectTo: new URL(`/auth/callback?flow=${encodeURIComponent(flow)}`, origin).toString(),
          },
        });
      } catch {
        // Deliberately return the same response as a successful delivery request.
      }
      return redirectTo(origin, "/sign-in?status=check-email");
    },

    async callback(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const storedFlows = cookies.getAll().filter(({ name }) => name === FLOW_COOKIE);
      setFlow("", 0);
      const codes = url.searchParams.getAll("code");
      const flows = url.searchParams.getAll("flow");
      const validQuery =
        request.method === "GET" &&
        url.origin === origin &&
        url.hash === "" &&
        [...url.searchParams.keys()].every((key) => key === "code" || key === "flow") &&
        url.searchParams.size === 2 &&
        codes.length === 1 &&
        codes[0].length > 0 &&
        codes[0].length <= MAX_FORM_BYTES &&
        codes[0] === codes[0].trim() &&
        flows.length === 1 &&
        storedFlows.length === 1 &&
        equalFlow(flows[0], storedFlows[0].value);
      if (!validQuery) return redirectTo(origin, "/sign-in");

      try {
        const result = await client.auth.exchangeCodeForSession(codes[0]);
        if (!result.error) return redirectTo(origin, "/settings/model-gateway");
      } catch {
        // Fail closed to the fixed sign-in page.
      }
      return redirectTo(origin, "/sign-in");
    },

    async signOut(request: Request): Promise<Response> {
      if (request.method !== "POST" || request.headers.get("origin") !== origin) {
        return genericFailure(403);
      }
      try {
        await client.auth.signOut();
      } catch {
        // A fixed redirect avoids exposing provider behavior.
      }
      return redirectTo(origin, "/sign-in");
    },

    async getPageAuthorization(): Promise<boolean> {
      try {
        const { data, error } = await client.auth.getUser();
        return !error && typeof data.user?.id === "string" && data.user.id.length > 0;
      } catch {
        return false;
      }
    },
  };
}
