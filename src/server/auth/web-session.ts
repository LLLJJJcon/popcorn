import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";

export type WebSessionResult =
  | { readonly ok: true; readonly userId: string }
  | { readonly ok: false; readonly reason: "missing" | "expired" };

type CookiePair = { readonly name: string; readonly value: string };
export type WebCookieAdapter = {
  readonly getAll: () => CookiePair[];
  readonly setAll?: (cookies: (CookiePair & { readonly options: CookieOptions })[]) => void | Promise<void>;
};

export type NextCookieStore = {
  readonly getAll: () => readonly CookiePair[];
  readonly set: (cookie: CookiePair & CookieOptions) => void;
};

export function createNextCookieAdapter(store: NextCookieStore): WebCookieAdapter {
  return {
    getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
    setAll: (cookies) => {
      for (const { name, value, options } of cookies) {
        store.set({ name, value, ...options });
      }
    },
  };
}

type AuthClient = {
  readonly auth: {
    readonly getUser: () => Promise<{
      readonly data: { readonly user: { readonly id: string } | null };
      readonly error: unknown;
    }>;
  };
};

type ClientFactory = (
  url: string,
  key: string,
  options: {
    readonly cookies: WebCookieAdapter;
    readonly cookieOptions: {
      readonly path: "/";
      readonly httpOnly: true;
      readonly sameSite: "lax";
      readonly secure: boolean;
    };
  },
) => AuthClient;

function hasSupabaseSessionCookie(cookies: readonly CookiePair[]): boolean {
  return cookies.some(({ name }) =>
    /^sb-(?:access-token|refresh-token|.+-auth-token(?:\.\d+)?)$/.test(name),
  );
}

function requestCookies(request: Request): CookiePair[] {
  const header = request.headers.get("cookie");
  if (!header) return [];
  return header.split(";").flatMap((part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return [];
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    return name.length === 0 ? [] : [{ name, value }];
  });
}

export function createWebSessionAuthenticator({
  supabaseUrl,
  anonKey,
  secureCookies = true,
  cookieAdapter,
  clientFactory,
}: {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly secureCookies?: boolean;
  readonly cookieAdapter?: (request: Request) => Promise<WebCookieAdapter>;
  readonly clientFactory?: ClientFactory;
}) {
  return async (request: Request): Promise<WebSessionResult> => {
    const adapter = cookieAdapter
      ? await cookieAdapter(request)
      : { getAll: () => requestCookies(request), setAll: () => undefined };
    if (!hasSupabaseSessionCookie(adapter.getAll())) return { ok: false, reason: "missing" };

    try {
      const client = clientFactory
        ? clientFactory(supabaseUrl, anonKey, popcornSsrOptions(adapter, secureCookies))
        : createPopcornSsrServerClient({ supabaseUrl, anonKey, cookies: adapter, secureCookies });
      const { data, error } = await client.auth.getUser();
      if (error || !data.user?.id) return { ok: false, reason: "expired" };
      return { ok: true, userId: data.user.id };
    } catch {
      return { ok: false, reason: "expired" };
    }
  };
}

export function createPopcornSsrServerClient({
  supabaseUrl,
  anonKey,
  cookies,
  secureCookies,
}: {
  readonly supabaseUrl: string;
  readonly anonKey: string;
  readonly cookies: WebCookieAdapter;
  readonly secureCookies: boolean;
}): SupabaseClient<Database> {
  return createServerClient<Database>(supabaseUrl, anonKey, popcornSsrOptions(cookies, secureCookies));
}

function popcornSsrOptions(cookies: WebCookieAdapter, secureCookies: boolean) {
  return {
    cookies,
    cookieOptions: {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: secureCookies,
    },
  } as const;
}
