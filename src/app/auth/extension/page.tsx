import { redirect } from "next/navigation";

import { getServerEnv } from "@/server/env";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const value = (input: string | string[] | undefined) => typeof input === "string" ? input : undefined;

export default async function ExtensionAuthPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const redirectUri = value(params.redirect_uri);
  const state = value(params.state);
  const challenge = value(params.code_challenge);
  const method = value(params.code_challenge_method);
  const environment = getServerEnv();
  const expectedRedirectUri = `${environment.EXTENSION_REDIRECT_ORIGIN}/supabase`;

  if (
    redirectUri !== expectedRedirectUri ||
    !state || state.length < 43 || state.length > 512 ||
    !challenge || !/^[A-Za-z0-9_-]{43,128}$/.test(challenge) ||
    method !== "S256"
  ) {
    return <main><h1>Link Popcorn</h1><p role="status">Invalid extension sign-in request.</p></main>;
  }

  const authorize = new URL(`${environment.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize`);
  authorize.searchParams.set("provider", "google");
  authorize.searchParams.set("redirect_to", expectedRedirectUri);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  redirect(authorize.toString());
}
