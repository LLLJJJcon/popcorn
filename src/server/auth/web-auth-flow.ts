import { z } from "zod";

import {
  createNextCookieAdapter,
  createPopcornSsrServerClient,
  type NextCookieStore,
  type WebCookieAdapter,
} from "./web-session";

const MAX_FORM_BYTES = 4 * 1024;
const EmailSchema = z
  .string()
  .max(254)
  .email()
  .refine((value) => value === value.trim());
const PasswordSchema = z.string().min(6).max(128);
const IntentSchema = z.enum(["sign-in", "sign-up"]);

type WebAuthClient = {
  readonly auth: {
    readonly signUp: (input: {
      readonly email: string;
      readonly password: string;
    }) => Promise<{ readonly data: unknown; readonly error: unknown }>;
    readonly signInWithPassword: (input: {
      readonly email: string;
      readonly password: string;
    }) => Promise<{ readonly data: unknown; readonly error: unknown }>;
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

export function createWebAuthFlowHandlers({
  appUrl,
  supabaseUrl,
  anonKey,
  cookieStore,
  clientFactory = (input) => createPopcornSsrServerClient(input) as unknown as WebAuthClient,
}: {
  readonly appUrl: string;
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly cookieStore: NextCookieStore;
  readonly clientFactory?: ClientFactory;
}) {
  const origin = new URL(appUrl).origin;
  const secureCookies = new URL(appUrl).protocol === "https:";
  const cookies = createNextCookieAdapter(cookieStore);
  const client = clientFactory({ supabaseUrl, anonKey, cookies, secureCookies });

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
      const passwords = params.getAll("password");
      const intents = params.getAll("intent");
      const parsedEmail = EmailSchema.safeParse(emails[0]);
      const parsedPassword = PasswordSchema.safeParse(passwords[0]);
      const parsedIntent = IntentSchema.safeParse(intents[0]);
      if (
        params.size !== 3 ||
        emails.length !== 1 ||
        passwords.length !== 1 ||
        intents.length !== 1 ||
        !parsedEmail.success ||
        !parsedPassword.success ||
        !parsedIntent.success
      ) {
        return genericFailure(400);
      }

      try {
        const credentials = {
          email: parsedEmail.data,
          password: parsedPassword.data,
        };
        const result = parsedIntent.data === "sign-up"
          ? await client.auth.signUp(credentials)
          : await client.auth.signInWithPassword(credentials);
        if (result.error) return redirectTo(origin, "/sign-in?status=error");
      } catch {
        return redirectTo(origin, "/sign-in?status=error");
      }
      return redirectTo(origin, "/settings/model-gateway");
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
