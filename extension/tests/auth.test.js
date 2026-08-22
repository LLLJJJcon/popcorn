const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const EXTENSION_ID = "meocnghfgmmcnnjiihpcgjnaameioddp";
const REQUEST_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const SUPABASE_URL = "https://project.supabase.co";
const ANON_KEY = "public-anon-key";

const getAuth = async () => {
  await import("../auth.js");
  return globalThis.POPCORN_AUTH;
};

function response(body, ok = true, status = ok ? 200 : 400) {
  return { ok, status, json: async () => body };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createChrome() {
  const local = {};
  const session = {};
  const reads = [];
  const writes = [];
  const area = (values, name) => ({
    async get(keys) {
      reads.push({ area: name, keys: structuredClone(keys) });
      if (keys === null) return { ...values };
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(
        requested.filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]),
      );
    },
    async set(items) {
      writes.push({ area: name, items: structuredClone(items) });
      Object.assign(values, items);
    },
    async remove(keys) {
      writes.push({ area: name, remove: structuredClone(keys) });
      for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
    },
    async setAccessLevel({ accessLevel }) {
      writes.push({ area: name, accessLevel });
    },
  });

  return {
    local,
    session,
    reads,
    writes,
    chrome: {
      storage: { local: area(local, "local"), session: area(session, "session") },
      runtime: {
        id: EXTENSION_ID,
        getURL(pathname) {
          return `${REQUEST_ORIGIN}/${pathname}`;
        },
      },
    },
  };
}

const providerSession = ({
  accessToken = "access-token",
  refreshToken = "refresh-token",
  userId = "user-a",
  email = "a@example.com",
  expiresIn = 3600,
} = {}) => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  expires_in: expiresIn,
  user: { id: userId, email, app_metadata: { ignored: true } },
});

function createClient(auth, harness, fetch, now = () => 1_700_000_000_000) {
  return auth.createAuthClient({
    chrome: harness.chrome,
    fetch,
    supabaseUrl: SUPABASE_URL,
    anonKey: ANON_KEY,
    now,
  });
}

test("concurrent auth operations share one trusted-storage initialization barrier", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const localAccess = deferred();
  const sessionAccess = deferred();
  const accessCalls = [];
  const requests = [];
  harness.chrome.storage.local.setAccessLevel = async (input) => {
    accessCalls.push({ area: "local", input });
    return localAccess.promise;
  };
  harness.chrome.storage.session.setAccessLevel = async (input) => {
    accessCalls.push({ area: "session", input });
    return sessionAccess.promise;
  };
  const client = createClient(auth, harness, async (url) => {
    requests.push(url);
    return response(providerSession());
  });

  const initialization = client.initialize();
  const sessionRead = client.getSession();
  const signIn = client.signInWithPassword({
    email: "a@example.com",
    password: "correct-horse",
  });
  await Promise.resolve();

  assert.equal(accessCalls.length, 1);
  assert.deepEqual(harness.reads, []);
  assert.deepEqual(requests, []);
  assert.deepEqual(harness.writes, []);

  localAccess.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(accessCalls.length, 2);
  assert.deepEqual(harness.reads, []);
  assert.deepEqual(requests, []);
  assert.deepEqual(harness.writes, []);

  sessionAccess.resolve();
  await initialization;
  assert.equal(await sessionRead, null);
  assert.equal((await signIn).accessToken, "access-token");
  assert.deepEqual(accessCalls, [
    { area: "local", input: { accessLevel: "TRUSTED_CONTEXTS" } },
    { area: "session", input: { accessLevel: "TRUSTED_CONTEXTS" } },
  ]);
  assert.equal(requests.length, 1);
});

test("a rejected trusted-storage initialization fails closed before reads, writes, fetches, or tokens", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const accessCalls = [];
  let fetchCalls = 0;
  harness.local.popcorn_session = {
    accessToken: "must-not-return",
    refreshToken: "refresh-token",
    accessExpiresAt: 1_700_003_600_000,
    user: { id: "user-a", email: "a@example.com" },
  };
  harness.chrome.storage.local.setAccessLevel = async (input) => {
    accessCalls.push({ area: "local", input });
  };
  harness.chrome.storage.session.setAccessLevel = async (input) => {
    accessCalls.push({ area: "session", input });
    throw new Error("storage access denied");
  };
  const client = createClient(auth, harness, async () => {
    fetchCalls += 1;
    return response(providerSession());
  });

  const results = await Promise.allSettled([
    client.initialize(),
    client.getSession(),
    client.getAccessToken(),
    client.signInWithPassword({ email: "a@example.com", password: "correct-horse" }),
    client.signUpWithPassword({ email: "a@example.com", password: "correct-horse" }),
    client.signOut({ decision: "discard" }),
    client.clearBoundedCache(),
  ]);

  assert.ok(results.every((result) => result.status === "rejected"));
  assert.deepEqual(accessCalls, [
    { area: "local", input: { accessLevel: "TRUSTED_CONTEXTS" } },
    { area: "session", input: { accessLevel: "TRUSTED_CONTEXTS" } },
  ]);
  assert.equal(fetchCalls, 0);
  assert.deepEqual(harness.reads, []);
  assert.deepEqual(harness.writes, []);
});

test("Options remains the adapted account surface and exposes password controls", () => {
  const options = read("options.html");

  for (const control of [
    "accountEmail",
    "authEmail",
    "authPassword",
    "signInBtn",
    "signUpBtn",
    "signOutBtn",
    "syncStatus",
    "clearCacheBtn",
    "discardPendingBtn",
  ]) {
    assert.match(options, new RegExp(`id="${control}"`));
  }
  assert.match(options, /type="password"/);
  assert.doesNotMatch(options, /google|oauth|magic link|api.?key|model|provider/i);
  assert.match(read("options.js"), /createStorageAdapter/);
  assert.match(read("options.js"), /chrome\.runtime\.sendMessage/);
  assert.doesNotMatch(read("options.js"), /createAuthClient|popcorn_session/);
});

test("password sign-in calls the exact Supabase endpoint and persists only normalized session data", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const requests = [];
  const client = createClient(auth, harness, async (url, init) => {
    requests.push({ url, init: structuredClone(init) });
    return response(providerSession());
  });

  await client.initialize();
  const session = await client.signInWithPassword({
    email: "a@example.com",
    password: "correct-horse",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, `${SUPABASE_URL}/auth/v1/token?grant_type=password`);
  assert.deepEqual(requests[0].init.headers, {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
  });
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    email: "a@example.com",
    password: "correct-horse",
  });
  assert.deepEqual(session, {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accessExpiresAt: 1_700_003_600_000,
    user: { id: "user-a", email: "a@example.com" },
  });
  assert.deepEqual(Object.keys(harness.local), ["popcorn_session"]);
  assert.doesNotMatch(JSON.stringify(harness.writes), /correct-horse|password/i);
  assert.doesNotMatch(JSON.stringify(harness.local), /correct-horse|app_metadata|password/i);
  assert.deepEqual(harness.session, {});
  assert.ok(harness.writes.some((write) => write.accessLevel === "TRUSTED_CONTEXTS"));
});

test("account creation calls Supabase signup and returns the same bounded session shape", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const requests = [];
  const client = createClient(auth, harness, async (url, init) => {
    requests.push({ url, init: structuredClone(init) });
    return response(providerSession({ email: "new@example.com" }));
  });

  const session = await client.signUpWithPassword({
    email: "new@example.com",
    password: "correct-horse",
  });

  assert.equal(requests[0].url, `${SUPABASE_URL}/auth/v1/signup`);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    email: "new@example.com",
    password: "correct-horse",
  });
  assert.deepEqual(session.user, { id: "user-a", email: "new@example.com" });
  assert.doesNotMatch(JSON.stringify(harness.local), /correct-horse|password/i);
});

test("wrong credentials, malformed responses, and provider errors stay generic and do not log secrets", async () => {
  const auth = await getAuth();
  const originalError = console.error;
  const originalLog = console.log;
  const logged = [];
  console.error = (...values) => logged.push(values);
  console.log = (...values) => logged.push(values);
  try {
    for (const providerResponse of [
      response({ message: "wrong correct-horse for a@example.com" }, false, 400),
      response({ access_token: "provider-secret" }),
    ]) {
      const harness = createChrome();
      const client = createClient(auth, harness, async () => providerResponse);
      await assert.rejects(
        client.signInWithPassword({ email: "a@example.com", password: "correct-horse" }),
        (error) => {
          assert.equal(error.message, "Popcorn sign-in could not be completed.");
          assert.doesNotMatch(error.message, /correct-horse|a@example|provider-secret/i);
          return true;
        },
      );
      assert.deepEqual(harness.local, {});
    }
  } finally {
    console.error = originalError;
    console.log = originalLog;
  }
  assert.doesNotMatch(JSON.stringify(logged), /correct-horse|a@example|provider-secret/i);
});

test("expired access tokens refresh once through Supabase and survive a worker restart", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  harness.local.popcorn_session = {
    accessToken: "expired",
    refreshToken: "refresh-token",
    accessExpiresAt: 0,
    user: { id: "user-a", email: "a@example.com" },
  };
  let refreshCalls = 0;
  const fetch = async (url, init) => {
    refreshCalls += 1;
    assert.equal(url, `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`);
    assert.deepEqual(init.headers, { "Content-Type": "application/json", apikey: ANON_KEY });
    assert.deepEqual(JSON.parse(init.body), { refresh_token: "refresh-token" });
    return response(providerSession({ accessToken: "refreshed", refreshToken: "next-refresh" }));
  };

  const restartedClient = createClient(auth, harness, fetch);
  const [first, second] = await Promise.all([
    restartedClient.getAccessToken(),
    restartedClient.getAccessToken(),
  ]);

  assert.equal(first, "refreshed");
  assert.equal(second, "refreshed");
  assert.equal(refreshCalls, 1);
  assert.equal(harness.local.popcorn_session.refreshToken, "next-refresh");
});

test("a confirmed sign-out invalidates an in-flight refresh before removing the session", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  harness.local.popcorn_session = {
    accessToken: "expired",
    refreshToken: "refresh-token",
    accessExpiresAt: 0,
    user: { id: "user-a", email: "a@example.com" },
  };
  const refreshStarted = deferred();
  const providerRefresh = deferred();
  const client = createClient(auth, harness, async () => {
    refreshStarted.resolve();
    return providerRefresh.promise;
  });

  const refreshing = client.getAccessToken();
  await refreshStarted.promise;
  const signingOut = client.signOut();
  providerRefresh.resolve(response(providerSession({ accessToken: "stale-refreshed" })));

  await assert.rejects(refreshing, /invalidated|session/i);
  assert.deepEqual(await signingOut, { pendingCount: 0, requiresDecision: false });
  assert.equal(harness.local.popcorn_session, undefined);
});

test("owner-bound pending events survive sign-out and another account cannot discard them", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  harness.local.popcorn_session = {
    accessToken: "access",
    refreshToken: "refresh",
    accessExpiresAt: 1_700_003_600_000,
    user: { id: "user-a", email: "a@example.com" },
  };
  harness.local.popcorn_pending_events = [
    { ownerUserId: "user-a", clientEventId: "a" },
    { ownerUserId: "user-b", clientEventId: "b" },
  ];
  const client = createClient(auth, harness, async () => response({}));

  assert.deepEqual(await client.signOut(), { pendingCount: 1, requiresDecision: true });
  assert.equal(harness.local.popcorn_pending_events.length, 2);
  assert.deepEqual(await client.signOut({ decision: "discard" }), {
    pendingCount: 1,
    requiresDecision: false,
  });
  assert.equal(harness.local.popcorn_session, undefined);
  assert.deepEqual(harness.local.popcorn_pending_events, [
    { ownerUserId: "user-b", clientEventId: "b" },
  ]);

  harness.local.popcorn_session = {
    accessToken: "other",
    refreshToken: "other-refresh",
    accessExpiresAt: 1_700_003_600_000,
    user: { id: "user-c", email: "c@example.com" },
  };
  assert.deepEqual(await client.signOut(), { pendingCount: 0, requiresDecision: false });
  assert.deepEqual(harness.local.popcorn_pending_events, [
    { ownerUserId: "user-b", clientEventId: "b" },
  ]);
});

test("trusted Options messages return only bounded account state and never password or tokens", async () => {
  const auth = await getAuth();
  const harness = createChrome();
  const credentials = [];
  const client = {
    signInWithPassword: async (input) => {
      credentials.push(input);
      return { accessToken: "never-return", refreshToken: "never-return", user: { id: "user-a", email: input.email } };
    },
    signUpWithPassword: async (input) => {
      credentials.push(input);
      return { accessToken: "never-return", refreshToken: "never-return", user: { id: "user-a", email: input.email } };
    },
    getSession: async () => ({ user: { id: "user-a", email: "a@example.com" } }),
    signOut: async () => ({ pendingCount: 0, requiresDecision: false }),
    clearBoundedCache: async () => 2,
  };
  const handler = auth.createAuthMessageHandler({ chrome: harness.chrome, authClient: client });
  const optionsSender = {
    id: harness.chrome.runtime.id,
    url: harness.chrome.runtime.getURL("options.html"),
  };

  for (const command of ["popcorn-auth:sign-in", "popcorn-auth:sign-up"]) {
    const result = await handler({
      command,
      email: "a@example.com",
      password: "correct-horse",
    }, optionsSender);
    assert.deepEqual(result, { ok: true, account: { email: "a@example.com" } });
    assert.doesNotMatch(JSON.stringify(result), /correct-horse|never-return|accessToken|refreshToken|password/i);
  }
  assert.deepEqual(credentials, [
    { email: "a@example.com", password: "correct-horse" },
    { email: "a@example.com", password: "correct-horse" },
  ]);
  assert.deepEqual(await handler({ command: "popcorn-auth:session" }, optionsSender), {
    ok: true,
    account: { email: "a@example.com" },
  });
  await assert.rejects(
    handler({ command: "popcorn-auth:get-access-token" }, optionsSender),
    /unsupported/i,
  );
  await assert.rejects(
    handler({ command: "popcorn-auth:session" }, {
      ...optionsSender,
      url: harness.chrome.runtime.getURL("sidepanel.html"),
    }),
    /forbidden/i,
  );
});
