const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { webcrypto } = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const REDIRECT_ORIGIN = "chrome-extension://meocnghfgmmcnnjiihpcgjnaameioddp";
const getAuth = async () => {
  await import("../auth.js");
  return globalThis.POPCORN_AUTH;
};

function response(body, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

function createChrome({ onLaunch, redirectOrigin = REDIRECT_ORIGIN } = {}) {
  const local = {};
  const session = {};
  const calls = [];
  const area = (values, name) => ({
    async get(keys) {
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requested.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]),
      );
    },
    async set(items) {
      calls.push(`${name}:set`);
      Object.assign(values, items);
    },
    async remove(keys) {
      calls.push(`${name}:remove`);
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    },
    async setAccessLevel({ accessLevel }) {
      calls.push(`${name}:access:${accessLevel}`);
    },
  });

  return {
    local,
    session,
    calls,
    chrome: {
      storage: { local: area(local, "local"), session: area(session, "session") },
      identity: {
        getRedirectURL(pathname) {
          calls.push(`redirect:${pathname}`);
          return `${redirectOrigin}/supabase`;
        },
        async launchWebAuthFlow({ url }) {
          calls.push("launch");
          return onLaunch(url);
        },
      },
      runtime: {
        id: REDIRECT_ORIGIN.slice("chrome-extension://".length),
        getURL(pathname) {
          return `${REDIRECT_ORIGIN}/${pathname}`;
        },
      },
    },
  };
}

test("manifest identity and options retain only the Popcorn account surface", () => {
  const manifest = JSON.parse(read("manifest.json"));
  const options = read("options.html");

  assert.match(manifest.key, /^[A-Za-z0-9+/=]+$/);
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.ok(manifest.permissions.includes("identity"));
  assert.ok(manifest.permissions.includes("alarms"));
  for (const permission of ["sidePanel", "storage", "tabs", "scripting"]) {
    assert.ok(manifest.permissions.includes(permission));
  }
  assert.deepEqual(manifest.host_permissions, [
    "https://www.youtube.com/*",
    "https://app.popcorn.local/*",
    "https://project.supabase.co/*",
  ]);
  assert.doesNotMatch(JSON.stringify(manifest), /supadata|deepseek|openai/i);
  for (const control of ["accountEmail", "signInBtn", "signOutBtn", "syncStatus", "clearCacheBtn", "discardPendingBtn"]) {
    assert.match(options, new RegExp(`id="${control}"`));
  }
  assert.doesNotMatch(options, /supadata|deepseek|api.?key|model|provider|customization/i);
  assert.match(read("options.js"), /chrome\.runtime\.sendMessage/);
  assert.doesNotMatch(read("options.js"), /createAuthClient|popcorn_session/);
  assert.doesNotMatch(read("options.js"), /\.get\(null\)/);
  const authPage = fs.readFileSync(path.resolve(root, "..", "src/app/auth/extension/page.tsx"), "utf8");
  assert.match(authPage, /auth\/v1\/authorize/);
  assert.doesNotMatch(authPage, /createBrowserClient|signInWithOAuth/);
  assert.match(authPage, /code_challenge_method", "s256"/);
  assert.match(authPage, /redirectTo\.searchParams\.set\("popcorn_state", popcornState\)/);
  assert.match(authPage, /redirect_to", redirectTo\.toString\(\)/);
  assert.equal((authPage.match(/authorize\.searchParams\.set\("code_challenge"/g) ?? []).length, 1);
  assert.doesNotMatch(authPage, /code_verifier/);
  assert.doesNotMatch(authPage, /authorize\.searchParams\.set\("state"/);
});

test("interactive sign-in is click-gated, stores PKCE before launch, and stores only a session", async () => {
  let fetched = 0;
  const auth = await getAuth();
  const harness = createChrome({
    onLaunch(url) {
      assert.equal(harness.calls.at(-2), "session:set");
      const start = new URL(url);
      assert.equal(start.searchParams.get("redirect_uri"), `${REDIRECT_ORIGIN}/supabase`);
      assert.ok(start.searchParams.get("code_challenge"));
      assert.equal(start.searchParams.get("code_challenge_method"), "s256");
      assert.equal(start.searchParams.get("code_verifier"), null);
      assert.equal(start.searchParams.get("access_token"), null);
      assert.equal(start.searchParams.get("refresh_token"), null);
      return `${REDIRECT_ORIGIN}/supabase?popcorn_state=${start.searchParams.get("popcorn_state")}&code=one-time-code&state=gotrue-owned-state`;
    },
  });
  const client = auth.createAuthClient({
    chrome: harness.chrome,
    crypto: webcrypto,
    appUrl: "https://app.popcorn.local",
    fetch: async (url, init) => {
      fetched += 1;
      assert.equal(url, "https://app.popcorn.local/api/v1/extension/session/exchange");
      assert.deepEqual(Object.keys(JSON.parse(init.body)).sort(), ["code", "codeVerifier", "redirectUri"]);
      return response({ session: { accessToken: "access", refreshToken: "refresh", accessExpiresAt: Date.now() + 60_000, user: { id: "user-a", email: "a@example.com" } } });
    },
  });

  await client.initialize();
  await assert.rejects(client.beginInteractiveSignIn(), /user action/i);
  const session = await client.beginInteractiveSignIn({ userInitiated: true });

  assert.equal(fetched, 1);
  assert.equal(session.user.email, "a@example.com");
  assert.deepEqual(Object.keys(harness.local), ["popcorn_session"]);
  assert.deepEqual(harness.session, {});
  assert.ok(harness.calls.includes("redirect:supabase"));
  assert.ok(harness.calls.includes("local:access:TRUSTED_CONTEXTS"));
  assert.ok(harness.calls.includes("session:access:TRUSTED_CONTEXTS"));
});

test("invalid, cancelled, and expired callbacks clear transient PKCE material", async () => {
  const auth = await getAuth();
  const cancelled = createChrome({ onLaunch: async () => { throw new Error("cancelled"); } });
  const client = auth.createAuthClient({ chrome: cancelled.chrome, crypto: webcrypto, appUrl: "https://app.popcorn.local", fetch: async () => response({}) });
  await assert.rejects(client.beginInteractiveSignIn({ userInitiated: true }), /cancelled/);
  assert.deepEqual(cancelled.session, {});

  const invalid = createChrome({ onLaunch: async () => `${REDIRECT_ORIGIN}/supabase?code=code&popcorn_state=wrong&state=gotrue-owned-state` });
  const invalidClient = auth.createAuthClient({ chrome: invalid.chrome, crypto: webcrypto, appUrl: "https://app.popcorn.local", fetch: async () => response({}) });
  await assert.rejects(invalidClient.beginInteractiveSignIn({ userInitiated: true }), /state/i);
  assert.deepEqual(invalid.session, {});

  invalid.session.popcorn_pkce = { state: "state", verifier: "v", redirectUri: `${REDIRECT_ORIGIN}/supabase`, expiresAt: 0 };
  await assert.rejects(invalidClient.completeInteractiveSignIn(`${REDIRECT_ORIGIN}/supabase?code=code&popcorn_state=state&state=gotrue-owned-state`), /expired/i);
  assert.deepEqual(invalid.session, {});
});

test("callbacks require exactly one nested Popcorn state and never accept token URL fields", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  let exchanges = 0;
  const client = auth.createAuthClient({
    chrome: harness.chrome,
    crypto: webcrypto,
    appUrl: "https://app.popcorn.local",
    now: () => 1_000,
    fetch: async () => {
      exchanges += 1;
      return response({ session: { accessToken: "access", refreshToken: "refresh", accessExpiresAt: 60_000, user: { id: "user-a", email: "a@example.com" } } });
    },
  });
  const setPkce = () => {
    harness.session.popcorn_pkce = { state: "popcorn-state", verifier: "verifier", redirectUri: `${REDIRECT_ORIGIN}/supabase`, expiresAt: 2_000 };
  };
  for (const suffix of [
    "code=code&state=gotrue-state",
    "code=code&state=gotrue-state&popcorn_state=popcorn-state&popcorn_state=duplicate",
    "code=code&state=gotrue-state&popcorn_state=wrong",
    "code=code&state=gotrue-state&popcorn_state=popcorn-state&access_token=forbidden",
  ]) {
    setPkce();
    await assert.rejects(client.completeInteractiveSignIn(`${REDIRECT_ORIGIN}/supabase?${suffix}`), /callback|state/i);
    assert.deepEqual(harness.session, {});
  }
  assert.equal(exchanges, 0);
});

test("rejects a syntactically valid extension redirect that is not the configured origin", async () => {
  const auth = await getAuth();
  const wrong = createChrome({ redirectOrigin: "chrome-extension://abcdefghijklmnopabcdefghijklmnop" });
  const client = auth.createAuthClient({ chrome: wrong.chrome, crypto: webcrypto, appUrl: "https://app.popcorn.local", fetch: async () => response({}), expectedRedirectUri: `${REDIRECT_ORIGIN}/supabase` });
  await assert.rejects(client.beginInteractiveSignIn({ userInitiated: true }), /configured redirect/i);
  assert.equal(wrong.calls.includes("launch"), false);
  assert.deepEqual(wrong.session, {});
});

test("simultaneous refreshes share one result and clear the mutex after success or failure", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  harness.local.popcorn_session = { accessToken: "old", refreshToken: "refresh", accessExpiresAt: 0, user: { id: "user-a", email: "a@example.com" } };
  let refreshCalls = 0;
  const client = auth.createAuthClient({
    chrome: harness.chrome,
    crypto: webcrypto,
    appUrl: "https://app.popcorn.local",
    fetch: async (url, init) => {
      refreshCalls += 1;
      assert.equal(url, "https://app.popcorn.local/api/v1/extension/session/refresh");
      assert.deepEqual(JSON.parse(init.body), { refreshToken: "refresh", userId: "user-a" });
      if (refreshCalls === 2) return response({ error: "ignored" }, false);
      return response({ session: { accessToken: `new-${refreshCalls}`, refreshToken: "refresh", accessExpiresAt: Date.now() + 60_000, user: { id: "user-a", email: "a@example.com" } } });
    },
  });

  const [a, b] = await Promise.all([client.getAccessToken(), client.getAccessToken()]);
  assert.equal(refreshCalls, 1);
  assert.equal(a, "new-1");
  assert.equal(b, "new-1");
  harness.local.popcorn_session.accessExpiresAt = 0;
  await assert.rejects(client.getAccessToken(), /refresh/i);
  harness.local.popcorn_session.accessExpiresAt = 0;
  assert.equal(await client.getAccessToken(), "new-3");
  assert.equal(refreshCalls, 3);
});

test("owner-bound pending events survive sign-out until explicit discard and never transfer accounts", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  harness.local.popcorn_session = { accessToken: "access", refreshToken: "refresh", accessExpiresAt: Date.now() + 60_000, user: { id: "user-a", email: "a@example.com" } };
  harness.local.popcorn_pending_events = [{ ownerUserId: "user-a", clientEventId: "a" }, { ownerUserId: "user-b", clientEventId: "b" }];
  const client = auth.createAuthClient({ chrome: harness.chrome, crypto: webcrypto, appUrl: "https://app.popcorn.local", fetch: async () => response({}) });

  assert.deepEqual(await client.signOut(), { pendingCount: 1, requiresDecision: true });
  assert.ok(harness.local.popcorn_session);
  assert.equal(harness.local.popcorn_pending_events.length, 2);
  assert.deepEqual(await client.signOut({ decision: "discard" }), { pendingCount: 1, requiresDecision: false });
  assert.equal(harness.local.popcorn_session, undefined);
  assert.deepEqual(harness.local.popcorn_pending_events, [{ ownerUserId: "user-b", clientEventId: "b" }]);
});

test("auth messages use Chrome sender identity and return only bounded account state", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const client = {
    initialize: async () => {},
    beginInteractiveSignIn: async () => ({ accessToken: "never-return", refreshToken: "never-return", user: { id: "user-a", email: "a@example.com" } }),
    getSession: async () => ({ user: { id: "user-a", email: "a@example.com" } }),
    signOut: async () => ({ pendingCount: 0, requiresDecision: false }),
    clearBoundedCache: async () => 2,
    getAccessToken: async () => "never-return",
  };
  const handler = auth.createAuthMessageHandler({ chrome: harness.chrome, authClient: client });
  const optionsSender = { id: harness.chrome.runtime.id, url: harness.chrome.runtime.getURL("options.html") };
  assert.deepEqual(await handler({ command: "popcorn-auth:session" }, optionsSender), { ok: true, account: { email: "a@example.com" } });
  await assert.rejects(handler({ command: "popcorn-auth:session" }, { ...optionsSender, tab: { id: 1 } }), /forbidden/i);
  await assert.rejects(handler({ command: "popcorn-auth:session" }, { ...optionsSender, id: "abcdefghijklmnopabcdefghijklmnop" }), /forbidden/i);
  assert.deepEqual(await handler({ command: "popcorn-auth:clear-cache" }, optionsSender), { ok: true, clearedCount: 2 });
  await assert.rejects(handler({ command: "popcorn-auth:get-access-token" }, optionsSender), /unsupported/i);
});
