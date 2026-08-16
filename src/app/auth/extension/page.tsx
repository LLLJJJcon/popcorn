"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";

const redirectPattern = /^chrome-extension:\/\/[a-p]{32}\/supabase$/;

export default function ExtensionAuthPage() {
  const [message, setMessage] = useState("Preparing secure sign-in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect_uri");
    const state = params.get("state");
    const challenge = params.get("code_challenge");
    if (!redirectTo || !redirectPattern.test(redirectTo) || !state || !challenge) {
      setMessage("Invalid extension sign-in request.");
      return;
    }
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      { auth: { flowType: "pkce", persistSession: false, detectSessionInUrl: false } },
    );
    void supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: { state, code_challenge: challenge, code_challenge_method: "S256" },
      },
    }).then(({ data, error }) => {
      if (error || !data.url) {
        setMessage("Popcorn sign-in could not be started.");
        return;
      }
      window.location.assign(data.url);
    });
  }, []);

  return <main><h1>Link Popcorn</h1><p role="status">{message}</p></main>;
}
