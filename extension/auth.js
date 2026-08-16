const POPCORN_AUTH = (() => {
  const SESSION_KEY = "popcorn_session";
  const PKCE_KEY = "popcorn_pkce";
  const PENDING_EVENTS_KEY = "popcorn_pending_events";
  const PKCE_TTL_MS = 10 * 60 * 1000;

  function base64Url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  async function s256(value, cryptoApi) {
    return base64Url(new Uint8Array(await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(value))));
  }

  function randomValue(cryptoApi, byteLength) {
    const bytes = new Uint8Array(byteLength);
    cryptoApi.getRandomValues(bytes);
    return base64Url(bytes);
  }

  function isSession(value) {
    return !!value && typeof value.accessToken === "string" && typeof value.refreshToken === "string" && Number.isFinite(value.accessExpiresAt) && !!value.user && typeof value.user.id === "string" && typeof value.user.email === "string";
  }

  function createAuthClient({ chrome, crypto = globalThis.crypto, fetch = globalThis.fetch, appUrl, supabaseUrl = "https://project.supabase.co", now = () => Date.now() }) {
    if (!chrome?.storage?.local || !chrome?.storage?.session || !chrome?.identity || !crypto?.subtle || !appUrl) {
      throw new Error("Popcorn auth requires trusted Chrome and Web Crypto APIs.");
    }
    let refreshMutex = null;

    async function initialize() {
      for (const area of [chrome.storage.local, chrome.storage.session]) {
        if (typeof area.setAccessLevel === "function") {
          await area.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
        }
      }
    }

    async function clearPkce() {
      await chrome.storage.session.remove(PKCE_KEY);
    }

    async function getSession() {
      const stored = await chrome.storage.local.get(SESSION_KEY);
      return isSession(stored[SESSION_KEY]) ? stored[SESSION_KEY] : null;
    }

    async function saveSession(session) {
      if (!isSession(session)) throw new Error("Invalid Popcorn session.");
      await chrome.storage.local.set({ [SESSION_KEY]: session });
      return session;
    }

    async function exchangeCode(pkce, code) {
      const response = await fetch(`${appUrl}/api/v1/extension/session/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier: pkce.verifier, redirectUri: pkce.redirectUri }),
      });
      const payload = await response.json().catch(() => null);
      const session = payload?.data?.session ?? payload?.session;
      if (!response.ok || !isSession(session)) throw new Error("Popcorn sign-in could not be completed.");
      return saveSession(session);
    }

    async function completeInteractiveSignIn(callbackUrl) {
      const stored = await chrome.storage.session.get(PKCE_KEY);
      const pkce = stored[PKCE_KEY];
      try {
        if (!pkce || typeof pkce.state !== "string" || typeof pkce.verifier !== "string" || typeof pkce.redirectUri !== "string" || !Number.isFinite(pkce.expiresAt)) {
          throw new Error("Missing PKCE state.");
        }
        if (pkce.expiresAt <= now()) throw new Error("PKCE state expired.");
        const callback = new URL(callbackUrl);
        const redirect = new URL(pkce.redirectUri);
        if (callback.origin !== redirect.origin || callback.pathname !== redirect.pathname || callback.searchParams.get("state") !== pkce.state) {
          throw new Error("Invalid sign-in callback state.");
        }
        const code = callback.searchParams.get("code");
        if (!code || code.length > 2048 || callback.searchParams.has("access_token") || callback.searchParams.has("refresh_token")) {
          throw new Error("Invalid sign-in callback.");
        }
        return await exchangeCode(pkce, code);
      } finally {
        await clearPkce();
      }
    }

    async function beginInteractiveSignIn({ userInitiated = false } = {}) {
      if (!userInitiated) throw new Error("Sign-in requires an explicit user action.");
      const redirectUri = chrome.identity.getRedirectURL("supabase");
      const verifier = randomValue(crypto, 64);
      const state = randomValue(crypto, 32);
      const pkce = { verifier, state, redirectUri, expiresAt: now() + PKCE_TTL_MS };
      await chrome.storage.session.set({ [PKCE_KEY]: pkce });
      const signInUrl = new URL("/auth/extension", appUrl);
      signInUrl.searchParams.set("redirect_uri", redirectUri);
      signInUrl.searchParams.set("state", state);
      signInUrl.searchParams.set("code_challenge", await s256(verifier, crypto));
      signInUrl.searchParams.set("code_challenge_method", "S256");
      try {
        const callbackUrl = await chrome.identity.launchWebAuthFlow({ url: signInUrl.toString(), interactive: true });
        return await completeInteractiveSignIn(callbackUrl);
      } catch (error) {
        await clearPkce();
        throw error;
      }
    }

    async function refreshSession() {
      const session = await getSession();
      if (!session) throw new Error("No Popcorn session.");
      const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      const payload = await response.json().catch(() => null);
      const refreshed = payload?.data?.session ?? payload?.session ?? (payload?.access_token && payload?.refresh_token && payload?.user ? {
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token,
        accessExpiresAt: now() + Number(payload.expires_in) * 1_000,
        user: { id: payload.user.id, email: payload.user.email },
      } : null);
      if (!response.ok || !isSession(refreshed) || refreshed.user.id !== session.user.id) {
        throw new Error("Popcorn session refresh failed.");
      }
      await saveSession(refreshed);
      return refreshed.accessToken;
    }

    async function getAccessToken() {
      const session = await getSession();
      if (!session) throw new Error("No Popcorn session.");
      if (session.accessExpiresAt > now() + 5_000) return session.accessToken;
      if (!refreshMutex) refreshMutex = refreshSession().finally(() => { refreshMutex = null; });
      return refreshMutex;
    }

    async function signOut({ decision } = {}) {
      const session = await getSession();
      if (!session) {
        await clearPkce();
        return { pendingCount: 0, requiresDecision: false };
      }
      const stored = await chrome.storage.local.get(PENDING_EVENTS_KEY);
      const events = Array.isArray(stored[PENDING_EVENTS_KEY]) ? stored[PENDING_EVENTS_KEY] : [];
      const pendingCount = events.filter((event) => event?.ownerUserId === session.user.id).length;
      if (pendingCount && decision !== "discard") return { pendingCount, requiresDecision: true };
      if (decision === "discard") {
        await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: events.filter((event) => event?.ownerUserId !== session.user.id) });
      }
      await chrome.storage.local.remove(SESSION_KEY);
      await clearPkce();
      return { pendingCount, requiresDecision: false };
    }

    async function handleMessage(message) {
      if (message?.source === "content-script") throw new Error("Untrusted content scripts cannot access Popcorn credentials.");
      throw new Error("Unsupported trusted message.");
    }

    return { beginInteractiveSignIn, completeInteractiveSignIn, getSession, getAccessToken, signOut, handleMessage, initialize };
  }

  return { createAuthClient };
})();

globalThis.POPCORN_AUTH = POPCORN_AUTH;
export const createAuthClient = POPCORN_AUTH.createAuthClient;
