const POPCORN_AUTH = (() => {
  const SESSION_KEY = "popcorn_session";
  const PENDING_EVENTS_KEY = "popcorn_pending_events";

  function isSession(value) {
    return !!value &&
      typeof value.accessToken === "string" &&
      typeof value.refreshToken === "string" &&
      Number.isFinite(value.accessExpiresAt) &&
      !!value.user &&
      typeof value.user.id === "string" &&
      typeof value.user.email === "string";
  }

  function isSameSession(left, right) {
    return isSession(left) &&
      isSession(right) &&
      left.accessToken === right.accessToken &&
      left.refreshToken === right.refreshToken &&
      left.accessExpiresAt === right.accessExpiresAt &&
      left.user.id === right.user.id &&
      left.user.email === right.user.email;
  }

  function exactSupabaseUrl(value) {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error("Invalid Popcorn authentication configuration.");
    }
    return url.toString().replace(/\/$/, "");
  }

  function normalizeCredentials(input) {
    if (!input || typeof input !== "object") throw new Error("Invalid Popcorn credentials.");
    const email = typeof input.email === "string" ? input.email : "";
    const password = typeof input.password === "string" ? input.password : "";
    if (
      email !== email.trim() ||
      email.length < 3 ||
      email.length > 254 ||
      !email.includes("@") ||
      password.length < 6 ||
      password.length > 128
    ) {
      throw new Error("Invalid Popcorn credentials.");
    }
    return { email, password };
  }

  function normalizeProviderSession(payload, now) {
    const value = payload?.session ?? payload;
    if (
      !value ||
      typeof value.access_token !== "string" ||
      !value.access_token ||
      typeof value.refresh_token !== "string" ||
      !value.refresh_token ||
      !Number.isFinite(value.expires_in) ||
      value.expires_in <= 0 ||
      !value.user ||
      typeof value.user.id !== "string" ||
      !value.user.id ||
      typeof value.user.email !== "string" ||
      !value.user.email
    ) {
      return null;
    }
    return {
      accessToken: value.access_token,
      refreshToken: value.refresh_token,
      accessExpiresAt: now() + value.expires_in * 1000,
      user: { id: value.user.id, email: value.user.email },
    };
  }

  function createAuthClient({
    chrome,
    fetch = globalThis.fetch,
    supabaseUrl,
    anonKey,
    boundedCachePrefix = "digest_",
    now = () => Date.now(),
  }) {
    if (
      !chrome?.storage?.local ||
      !chrome?.storage?.session ||
      !/^[a-p]{32}$/.test(chrome?.runtime?.id ?? "") ||
      typeof fetch !== "function" ||
      typeof anonKey !== "string" ||
      !anonKey
    ) {
      throw new Error("Popcorn auth requires trusted Chrome APIs and public Supabase configuration.");
    }
    const authOrigin = exactSupabaseUrl(supabaseUrl);
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

    async function getSession() {
      const stored = await chrome.storage.local.get(SESSION_KEY);
      return isSession(stored[SESSION_KEY]) ? stored[SESSION_KEY] : null;
    }

    async function saveSession(value) {
      if (!isSession(value)) throw new Error("Invalid Popcorn session.");
      await chrome.storage.local.set({ [SESSION_KEY]: value });
      return value;
    }

    async function requestPasswordSession(kind, input) {
      const credentials = normalizeCredentials(input);
      sessionGeneration += 1;
      const acceptedGeneration = sessionGeneration;
      const endpoint = kind === "sign-up"
        ? `${authOrigin}/auth/v1/signup`
        : `${authOrigin}/auth/v1/token?grant_type=password`;
      let response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey },
          body: JSON.stringify(credentials),
        });
      } catch {
        throw new Error("Popcorn sign-in could not be completed.");
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Popcorn sign-in could not be completed.");
      }
      const normalized = response.ok ? normalizeProviderSession(payload, now) : null;
      if (!normalized) throw new Error("Popcorn sign-in could not be completed.");
      return queueSessionMutation(async () => {
        assertCurrentGeneration(acceptedGeneration);
        const saved = await saveSession(normalized);
        assertCurrentGeneration(acceptedGeneration);
        return saved;
      });
    }

    function signInWithPassword(input) {
      return requestPasswordSession("sign-in", input);
    }

    function signUpWithPassword(input) {
      return requestPasswordSession("sign-up", input);
    }

    async function refreshSession() {
      const refreshGeneration = sessionGeneration;
      const current = await getSession();
      if (!current) throw new Error("No Popcorn session.");
      let response;
      try {
        response = await fetch(`${authOrigin}/auth/v1/token?grant_type=refresh_token`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: anonKey },
          body: JSON.stringify({ refresh_token: current.refreshToken }),
        });
      } catch {
        throw new Error("Popcorn session refresh failed.");
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Popcorn session refresh failed.");
      }
      const refreshed = response.ok ? normalizeProviderSession(payload, now) : null;
      if (!refreshed || refreshed.user.id !== current.user.id) {
        throw new Error("Popcorn session refresh failed.");
      }
      await queueSessionMutation(async () => {
        assertCurrentGeneration(refreshGeneration);
        const latest = await getSession();
        assertCurrentGeneration(refreshGeneration);
        if (!isSameSession(latest, current)) throw new Error("Popcorn session was invalidated.");
        await saveSession(refreshed);
        assertCurrentGeneration(refreshGeneration);
      });
      assertCurrentGeneration(refreshGeneration);
      return refreshed.accessToken;
    }

    async function getAccessToken() {
      const current = await getSession();
      if (!current) throw new Error("No Popcorn session.");
      if (current.accessExpiresAt > now() + 5000) return current.accessToken;
      if (!refreshMutex) {
        refreshMutex = refreshSession().finally(() => {
          refreshMutex = null;
        });
      }
      return refreshMutex;
    }

    async function signOut({ decision } = {}) {
      const current = await getSession();
      if (!current) return { pendingCount: 0, requiresDecision: false };
      const stored = await chrome.storage.local.get(PENDING_EVENTS_KEY);
      const events = Array.isArray(stored[PENDING_EVENTS_KEY]) ? stored[PENDING_EVENTS_KEY] : [];
      const pendingCount = events.filter((event) => event?.ownerUserId === current.user.id).length;
      if (pendingCount && decision !== "discard") {
        return { pendingCount, requiresDecision: true };
      }

      sessionGeneration += 1;
      const signOutGeneration = sessionGeneration;
      const activeRefresh = refreshMutex;
      if (activeRefresh) await activeRefresh.catch(() => {});
      if (decision === "discard") {
        await chrome.storage.local.set({
          [PENDING_EVENTS_KEY]: events.filter((event) => event?.ownerUserId !== current.user.id),
        });
      }
      await queueSessionMutation(async () => {
        assertCurrentGeneration(signOutGeneration);
        await chrome.storage.local.remove(SESSION_KEY);
        assertCurrentGeneration(signOutGeneration);
      });
      return { pendingCount, requiresDecision: false };
    }

    async function clearBoundedCache() {
      const stored = await chrome.storage.local.get(null);
      const keys = Object.keys(stored).filter((key) => key.startsWith(boundedCachePrefix));
      if (keys.length) await chrome.storage.local.remove(keys);
      return keys.length;
    }

    return {
      signInWithPassword,
      signUpWithPassword,
      getSession,
      getAccessToken,
      signOut,
      clearBoundedCache,
      initialize,
    };
  }

  function createAuthMessageHandler({ chrome, authClient }) {
    const optionsUrl = chrome.runtime.getURL("options.html");
    function assertTrustedOptionsSender(sender) {
      const trustedTab = sender?.tab === undefined ||
        (Number.isInteger(sender.tab?.id) && sender.tab.url === optionsUrl);
      if (!sender || sender.id !== chrome.runtime.id || sender.url !== optionsUrl || !trustedTab) {
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
      if (["popcorn-auth:sign-in", "popcorn-auth:sign-up"].includes(message.command)) {
        const credentials = normalizeCredentials({ email: message.email, password: message.password });
        const session = message.command === "popcorn-auth:sign-up"
          ? await authClient.signUpWithPassword(credentials)
          : await authClient.signInWithPassword(credentials);
        return { ok: true, account: { email: session.user.email } };
      }
      if (message.command === "popcorn-auth:sign-out") {
        const result = await authClient.signOut({
          decision: message.decision === "discard" ? "discard" : undefined,
        });
        return {
          ok: true,
          pendingCount: result.pendingCount,
          requiresDecision: result.requiresDecision,
        };
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
if (typeof module !== "undefined" && module.exports) module.exports = POPCORN_AUTH;
