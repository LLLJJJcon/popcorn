const POPCORN_AUTH = (() => {
  const SESSION_KEY = "popcorn_session";
  const PKCE_KEY = "popcorn_pkce";
  const POPCORN_STATE_PARAM = "popcorn_state";
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

  function isSameSession(left, right) {
    return isSession(left) && isSession(right) && left.accessToken === right.accessToken && left.refreshToken === right.refreshToken && left.accessExpiresAt === right.accessExpiresAt && left.user.id === right.user.id && left.user.email === right.user.email;
  }

  function createAuthClient({ chrome, crypto = globalThis.crypto, fetch = globalThis.fetch, appUrl, boundedCachePrefix = "digest_", now = () => Date.now() }) {
    if (!chrome?.storage?.local || !chrome?.storage?.session || !chrome?.identity || !/^[a-p]{32}$/.test(chrome?.runtime?.id ?? "") || !crypto?.subtle || !appUrl) {
      throw new Error("Popcorn auth requires trusted Chrome and Web Crypto APIs.");
    }
    const expectedRedirectUri = `https://${chrome.runtime.id}.chromiumapp.org/supabase`;
    let refreshMutex = null;
    let sessionGeneration = 0;
    let sessionMutationQueue = Promise.resolve();

    function assertCurrentGeneration(generation) {
      if (generation !== sessionGeneration) throw new Error("Popcorn session was invalidated.");
    }

    function queueSessionMutation(mutation) {
      const result = sessionMutationQueue.then(mutation);
      sessionMutationQueue = result.catch(() => {});
      return result;
    }

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
      sessionGeneration += 1;
      const acceptedGeneration = sessionGeneration;
      return queueSessionMutation(async () => {
        assertCurrentGeneration(acceptedGeneration);
        const saved = await saveSession(session);
        assertCurrentGeneration(acceptedGeneration);
        return saved;
      });
    }

    async function completeInteractiveSignIn(callbackUrl) {
      const stored = await chrome.storage.session.get(PKCE_KEY);
      const pkce = stored[PKCE_KEY];
      try {
        if (!pkce || typeof pkce.state !== "string" || typeof pkce.verifier !== "string" || pkce.redirectUri !== expectedRedirectUri || !Number.isFinite(pkce.expiresAt)) {
          throw new Error("Missing PKCE state.");
        }
        if (pkce.expiresAt <= now()) throw new Error("PKCE state expired.");
        const callback = new URL(callbackUrl);
        const redirect = new URL(pkce.redirectUri);
        if (callback.hash) throw new Error("Invalid sign-in callback fragment.");
        const popcornStates = callback.searchParams.getAll(POPCORN_STATE_PARAM);
        if (callback.origin !== redirect.origin || callback.pathname !== redirect.pathname || popcornStates.length !== 1 || popcornStates[0] !== pkce.state) {
          throw new Error("Invalid sign-in callback state.");
        }
        const codes = callback.searchParams.getAll("code");
        const code = codes[0];
        if (codes.length !== 1 || !code || code.length > 2048 || callback.searchParams.has("access_token") || callback.searchParams.has("refresh_token") || callback.searchParams.has("id_token") || callback.searchParams.has("token_type") || callback.searchParams.has("expires_in")) {
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
      if (redirectUri !== expectedRedirectUri) throw new Error("Unexpected configured redirect URI.");
      const verifier = randomValue(crypto, 64);
      const state = randomValue(crypto, 32);
      const pkce = { verifier, state, redirectUri, expiresAt: now() + PKCE_TTL_MS };
      await chrome.storage.session.set({ [PKCE_KEY]: pkce });
      try {
        const signInUrl = new URL("/auth/extension", appUrl);
        signInUrl.searchParams.set("redirect_uri", redirectUri);
        signInUrl.searchParams.set(POPCORN_STATE_PARAM, state);
        signInUrl.searchParams.set("code_challenge", await s256(verifier, crypto));
        signInUrl.searchParams.set("code_challenge_method", "s256");
        const callbackUrl = await chrome.identity.launchWebAuthFlow({ url: signInUrl.toString(), interactive: true });
        return await completeInteractiveSignIn(callbackUrl);
      } catch (error) {
        await clearPkce();
        throw error;
      }
    }

    async function refreshSession() {
      const refreshGeneration = sessionGeneration;
      const session = await getSession();
      if (!session) throw new Error("No Popcorn session.");
      const response = await fetch(`${appUrl}/api/v1/extension/session/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken, userId: session.user.id }),
      });
      const payload = await response.json().catch(() => null);
      const refreshed = payload?.data?.session ?? payload?.session;
      if (!response.ok || !isSession(refreshed) || refreshed.user.id !== session.user.id) {
        throw new Error("Popcorn session refresh failed.");
      }
      await queueSessionMutation(async () => {
        assertCurrentGeneration(refreshGeneration);
        const currentSession = await getSession();
        assertCurrentGeneration(refreshGeneration);
        if (!isSameSession(currentSession, session)) throw new Error("Popcorn session was invalidated.");
        await saveSession(refreshed);
        assertCurrentGeneration(refreshGeneration);
      });
      assertCurrentGeneration(refreshGeneration);
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
      sessionGeneration += 1;
      const signOutGeneration = sessionGeneration;
      const activeRefresh = refreshMutex;
      if (activeRefresh) await activeRefresh.catch(() => {});
      if (decision === "discard") {
        await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: events.filter((event) => event?.ownerUserId !== session.user.id) });
      }
      await queueSessionMutation(async () => {
        assertCurrentGeneration(signOutGeneration);
        await chrome.storage.local.remove(SESSION_KEY);
        assertCurrentGeneration(signOutGeneration);
      });
      await clearPkce();
      return { pendingCount, requiresDecision: false };
    }

    async function clearBoundedCache() {
      const stored = await chrome.storage.local.get(null);
      const keys = Object.keys(stored).filter((key) => key.startsWith(boundedCachePrefix));
      if (keys.length) await chrome.storage.local.remove(keys);
      return keys.length;
    }

    return { beginInteractiveSignIn, completeInteractiveSignIn, getSession, getAccessToken, signOut, clearBoundedCache, initialize };
  }

  function createAuthMessageHandler({ chrome, authClient }) {
    const optionsUrl = chrome.runtime.getURL("options.html");
    function assertTrustedOptionsSender(sender) {
      if (!sender || sender.id !== chrome.runtime.id || sender.tab || sender.url !== optionsUrl) {
        throw new Error("Forbidden auth sender.");
      }
    }
    return async function handleAuthMessage(message, sender) {
      if (!message || typeof message.command !== "string" || !message.command.startsWith("popcorn-auth:")) {
        throw new Error("Unsupported auth command.");
      }
      assertTrustedOptionsSender(sender);
      if (message.command === "popcorn-auth:session") {
        const session = await authClient.getSession();
        return { ok: true, account: session ? { email: session.user.email } : null };
      }
      if (message.command === "popcorn-auth:begin") {
        const session = await authClient.beginInteractiveSignIn({ userInitiated: message.userInitiated === true });
        return { ok: true, account: { email: session.user.email } };
      }
      if (message.command === "popcorn-auth:sign-out") {
        const result = await authClient.signOut({ decision: message.decision === "discard" ? "discard" : undefined });
        return { ok: true, pendingCount: result.pendingCount, requiresDecision: result.requiresDecision };
      }
      if (message.command === "popcorn-auth:clear-cache") {
        return { ok: true, clearedCount: await authClient.clearBoundedCache() };
      }
      throw new Error("Unsupported auth command.");
    };
  }

  return { createAuthClient, createAuthMessageHandler };
})();

globalThis.POPCORN_AUTH = POPCORN_AUTH;
