const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");

function eventHook() {
  const listeners = [];
  return { listeners, addListener(listener) { listeners.push(listener); } };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function loadBackground() {
  const hooks = {
    startup: eventHook(), installed: eventHook(), alarm: eventHook(), message: eventHook(),
  };
  const calls = { flushes: [], enqueues: [], summaries: 0, discards: [] };
  const queue = {
    async enqueueSavedItem(input) { calls.enqueues.push(input); return { success: true, synced: false, pending: true }; },
    async flushPendingEvents(trigger) { calls.flushes.push(trigger); return { success: true, pending: 0 }; },
    async getSyncSummary() { calls.summaries += 1; return { pendingCount: 0 }; },
    async discardPendingEvents(ownerUserId) { calls.discards.push(ownerUserId); return { discardedCount: 1 }; },
    async recoverOnStartup(trigger) { calls.flushes.push(`recover:${trigger}`); return { success: true }; },
  };
  let session = { user: { id: "user-a", email: "a@example.com" } };
  const passive = eventHook();
  const chrome = {
    storage: { local: { setAccessLevel: async () => {}, get: async () => ({}) } },
    alarms: { onAlarm: hooks.alarm },
    runtime: {
      id: "extension-id",
      getURL: (file) => `chrome-extension://extension-id/${file}`,
      onMessage: hooks.message,
      onStartup: hooks.startup,
      onInstalled: hooks.installed,
      sendMessage: async () => {},
      openOptionsPage() {},
    },
    action: { onClicked: passive },
    sidePanel: { setOptions: async () => {}, open: async () => {}, setPanelBehavior() {} },
    tabs: { onUpdated: passive, onActivated: passive, query: async () => [], get: async () => ({}) },
    scripting: { executeScript: async () => [] },
  };
  const authClient = {
    initialize: async () => {},
    getSession: async () => session,
    getAccessToken: async () => "token",
  };
  const sandbox = {
    chrome, URL, console, fetch: async () => ({ json: async () => ({ ok: true, data: {} }) }),
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {},
    importScripts() {},
    YTD_SETTINGS: { DEFAULTS: { boundedCachePrefix: "digest_" } },
    POPCORN_AUTH: {
      createAuthClient: () => authClient,
      createAuthMessageHandler: () => async (message) => {
        if (message.command === "popcorn-auth:session") return { ok: true, account: session?.user ?? null };
        if (message.command === "popcorn-auth:sign-in") return { ok: true, account: session.user };
        return { ok: true };
      },
    },
    POPCORN_SYNC_QUEUE: { createSyncQueue: () => queue },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "background.js"), "utf8"), sandbox, { filename: "background.js" });
  return { hooks, calls, chrome, setSession(value) { session = value; } };
}

async function send(listener, message, sender) {
  return new Promise((resolve) => {
    const async = listener(message, sender, resolve);
    if (async !== true) setImmediate(() => resolve(undefined));
  });
}

test("startup, install, retry alarm, panel-open, new-save, and regained auth trigger independent recovery", async () => {
  const harness = loadBackground();
  assert.equal(harness.hooks.startup.listeners.length, 1);
  assert.equal(harness.hooks.installed.listeners.length, 1);
  assert.equal(harness.hooks.alarm.listeners.length, 1);
  await harness.hooks.startup.listeners[0]();
  await harness.hooks.installed.listeners[0]();
  await harness.hooks.alarm.listeners[0]({ name: "popcorn-sync-retry" });

  const listener = harness.hooks.message.listeners[0];
  const sidePanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel.html" };
  const options = { id: "extension-id", url: "chrome-extension://extension-id/options.html" };
  await send(listener, { action: "flushPendingEvents" }, sidePanel);
  await send(listener, { action: "enqueueSavedItem", input: { clientEventId: "event" } }, sidePanel);
  await send(listener, {
    command: "popcorn-auth:sign-in",
    email: "a@example.com",
    password: "correct-horse",
  }, options);

  assert.deepEqual(harness.calls.flushes, ["recover:startup", "recover:installed", "alarm", "panel-open", "regained-auth"]);
  assert.deepEqual(harness.calls.enqueues, [{ clientEventId: "event" }]);
});

test("queue messages remain trusted-context-only and expose only bounded status", async () => {
  const harness = loadBackground();
  const listener = harness.hooks.message.listeners[0];
  const content = { id: "extension-id", tab: { id: 7, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
  const sidePanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel.html" };
  const options = { id: "extension-id", url: "chrome-extension://extension-id/options.html" };

  assert.deepEqual(plain(await send(listener, {
    action: "enqueueSavedItem",
    input: { clientEventId: "player-event", youtubeVideoId: "dQw4w9WgXcQ", kind: "player_moment" },
  }, content)), { success: true, synced: false, pending: true });
  assert.deepEqual(harness.calls.enqueues.at(-1), { clientEventId: "player-event", youtubeVideoId: "dQw4w9WgXcQ", kind: "player_moment" });
  assert.deepEqual(plain(await send(listener, {
    action: "enqueueSavedItem",
    input: { clientEventId: "wrong-video", youtubeVideoId: "aaaaaaaaaaa", kind: "player_moment" },
  }, content)), { success: false, error: "forbidden" });

  assert.deepEqual(plain(await send(listener, { action: "getSyncSummary" }, content)), { success: false, error: "forbidden" });
  assert.deepEqual(plain(await send(listener, { action: "discardPendingEvents", ownerUserId: "user-a" }, sidePanel)), { success: false, error: "forbidden" });
  assert.deepEqual(plain(await send(listener, { action: "getSyncSummary" }, options)), { pendingCount: 0 });
  assert.deepEqual(plain(await send(listener, { action: "discardPendingEvents", ownerUserId: "user-a" }, options)), { discardedCount: 1 });
});

test("manifest keeps exact extension hosts and bounded storage permissions", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  assert.equal(manifest.minimum_chrome_version, "116");
  assert.ok(manifest.permissions.includes("alarms"));
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(!manifest.permissions.includes("unlimitedStorage"));
  assert.deepEqual(manifest.host_permissions, [
    "https://www.youtube.com/*",
    "https://app.popcorn.local/*",
    "https://project.supabase.co/*",
  ]);
  assert.doesNotMatch(JSON.stringify(manifest), /openai|deepseek|provider/i);
});

test("background still imports auth and queue together and keeps the exact side-panel path", () => {
  const source = fs.readFileSync(path.join(root, "background.js"), "utf8");
  assert.match(source, /importScripts\("settings\.js", "auth\.js"\);[\s\S]*importScripts\("sync-queue\.js"\)/);
  assert.match(source, /message\?\.action === "openSidePanel"/);
  assert.match(source, /chrome\.sidePanel\.open\(\{ tabId \}\)/);
  assert.match(source, /startDigestFromButton/);
  assert.doesNotMatch(source, /setInterval/);
});

test("options shows the bounded queue summary and discards through the owner-bound queue command", async () => {
  const handlers = {};
  const elements = Object.fromEntries([
    "accountEmail", "signInBtn", "signOutBtn", "authStatus", "syncStatus",
    "signOutChoice", "discardPendingBtn", "dataStatus", "clearCacheBtn",
  ].map((id) => [id, {
    id,
    hidden: false,
    textContent: "",
    addEventListener(type, handler) { handlers[`${id}:${type}`] = handler; },
  }]));
  const messages = [];
  let account = { email: "a@example.com" };
  const sandbox = {
    document: { getElementById: (id) => elements[id] },
    chrome: { runtime: { async sendMessage(message) {
      messages.push(structuredClone(message));
      if (message.command === "popcorn-auth:session") return { ok: true, account };
      if (message.action === "getSyncSummary") return { pendingCount: 2 };
      if (message.action === "discardPendingEvents") return { discardedCount: 2 };
      if (message.command === "popcorn-auth:sign-out") { account = null; return { ok: true }; }
      return { ok: true };
    } } },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(root, "options.js"), "utf8"), sandbox, { filename: "options.js" });
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(elements.syncStatus.textContent, "2 saved moments waiting to sync.");
  await handlers["discardPendingBtn:click"]();
  assert.deepEqual(messages.slice(-4), [
    { action: "discardPendingEvents" },
    { command: "popcorn-auth:sign-out" },
    { command: "popcorn-auth:session" },
    { action: "getSyncSummary" },
  ]);
});
