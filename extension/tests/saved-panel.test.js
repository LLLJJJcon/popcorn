const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const extensionRoot = path.resolve(__dirname, "..");
const sidepanelSource = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
const sidepanelHtml = fs.readFileSync(path.join(extensionRoot, "sidepanel.html"), "utf8");
const backgroundSource = fs.readFileSync(path.join(extensionRoot, "background.js"), "utf8");

const CURRENT_VIDEO_ID = "dQw4w9WgXcQ";
const CURRENT_SOURCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_SOURCE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const summaries = [
  {
    sourceId: CURRENT_SOURCE_ID,
    youtubeVideoId: CURRENT_VIDEO_ID,
    canonicalUrl: `https://www.youtube.com/watch?v=${CURRENT_VIDEO_ID}`,
    title: `<img src=x onerror="alert(1)"> 中文访谈 ${"x".repeat(240)}`,
    channel: `<script>unsafe channel</script>${"y".repeat(140)}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${CURRENT_VIDEO_ID}/hqdefault.jpg`,
    savedCount: 2,
    latestSavedAt: "2026-08-22T10:00:00.000Z",
    processingState: "organizing",
  },
  {
    sourceId: OTHER_SOURCE_ID,
    youtubeVideoId: "abc123XYZ00",
    canonicalUrl: "https://www.youtube.com/watch?v=abc123XYZ00",
    title: "Second saved video",
    channel: "Second channel",
    thumbnailUrl: "https://i.ytimg.com/vi/abc123XYZ00/hqdefault.jpg",
    savedCount: 1,
    latestSavedAt: "2026-08-21T10:00:00.000Z",
    processingState: "ready",
  },
];

function eventHook() {
  const listeners = [];
  return { listeners, addListener(listener) { listeners.push(listener); } };
}

function loadSidepanel({ sendMessage } = {}) {
  const dom = new JSDOM(sidepanelHtml, {
    url: "chrome-extension://extension-id/sidepanel.html",
  });
  const nativeAddEventListener = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, listener, options) => {
    if (type === "DOMContentLoaded") return;
    nativeAddEventListener(type, listener, options);
  };
  const passive = eventHook();
  const messages = [];
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    Date,
    crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000101" },
    document: dom.window.document,
    window: dom.window,
    navigator: dom.window.navigator,
    chrome: {
      runtime: {
        onMessage: passive,
        async sendMessage(message) {
          messages.push(structuredClone(message));
          return sendMessage ? sendMessage(message) : { success: true, summaries: [] };
        },
      },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: { onUpdated: passive, onActivated: passive, query: async () => [] },
      storage: { local: { get: async () => ({}), remove: async () => {} } },
    },
    MutationObserver: dom.window.MutationObserver,
    IntersectionObserver: class { observe() {} disconnect() {} },
    CSS: { escape: (value) => value },
    POPCORN_RUNTIME_CONFIG: { appUrl: "https://app.popcorn.local" },
    YTD_SETTINGS: {},
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(
    `${sidepanelSource}\n;globalThis.__POPCORN_SAVED_TESTING__ = { setupEventListeners, setCurrentVideoId(value) { currentVideoId = value; } };`,
    sandbox,
    { filename: "sidepanel.js" },
  );
  sandbox.__POPCORN_SAVED_TESTING__.setCurrentVideoId(CURRENT_VIDEO_ID);
  sandbox.__POPCORN_SAVED_TESTING__.setupEventListeners();
  return { dom, document: dom.window.document, messages };
}

function loadBackground({
  fetchImpl,
  session = { user: { id: "user-a" } },
  accessTokenError = null,
} = {}) {
  const message = eventHook();
  const passive = eventHook();
  const opened = [];
  const requests = [];
  const chrome = {
    storage: { local: { setAccessLevel: async () => {}, get: async () => ({}) } },
    alarms: { onAlarm: passive },
    runtime: {
      id: "extension-id",
      getURL: (file) => `chrome-extension://extension-id/${file}`,
      onMessage: message,
      onStartup: passive,
      onInstalled: passive,
      sendMessage: async () => {},
      openOptionsPage() {},
    },
    action: { onClicked: passive },
    sidePanel: { setOptions: async () => {}, open: async () => {}, setPanelBehavior() {} },
    tabs: {
      onUpdated: passive,
      onActivated: passive,
      query: async () => [],
      get: async () => ({}),
      create: async (input) => { opened.push(structuredClone(input)); return input; },
    },
    scripting: { executeScript: async () => [] },
  };
  const sandbox = {
    chrome,
    URL,
    console,
    async fetch(url, options) {
      requests.push({ url, options: structuredClone(options) });
      return fetchImpl
        ? fetchImpl(url, options)
        : { status: 200, json: async () => ({ ok: true, data: summaries }) };
    },
    setTimeout: () => 0,
    clearTimeout() {},
    importScripts() {},
    YTD_SETTINGS: { DEFAULTS: { boundedCachePrefix: "digest_" } },
    POPCORN_RUNTIME_CONFIG: { appUrl: "https://app.popcorn.local" },
    POPCORN_AUTH: {
      createAuthClient: () => ({
        initialize: async () => {},
        getSession: async () => session,
        getAccessToken: async () => {
          if (accessTokenError) throw new Error(accessTokenError);
          return "owner-token";
        },
      }),
      createAuthMessageHandler: () => async () => ({ ok: true }),
    },
    POPCORN_SYNC_QUEUE: { createSyncQueue: () => null },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(backgroundSource, sandbox, { filename: "background.js" });
  return { listener: message.listeners[0], opened, requests };
}

async function send(listener, message, sender) {
  return new Promise((resolve) => {
    const asynchronous = listener(message, sender, resolve);
    if (asynchronous !== true) setImmediate(() => resolve(undefined));
  });
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("opening Saved requests the fixed library once and safely filters literal summaries", async () => {
  const { document, messages } = loadSidepanel({
    sendMessage: async (message) => message.action === "getSavedLibrary"
      ? { success: true, summaries }
      : { success: true },
  });

  document.querySelector('[data-tab="saved"]').click();
  await flush();

  assert.deepEqual(messages.filter(({ action }) => action === "getSavedLibrary"), [
    { action: "getSavedLibrary" },
  ]);
  assert.equal(document.querySelectorAll(".saved-library-item").length, 1);
  assert.match(document.getElementById("savedList").textContent, /中文访谈/);
  assert.match(document.getElementById("savedList").textContent, /2 saves/);
  assert.match(document.getElementById("savedList").textContent, /Organizing/);
  assert.doesNotMatch(document.getElementById("savedList").textContent, /Second saved video/);
  assert.equal(document.getElementById("savedList").querySelector("img"), null);
  assert.equal(document.getElementById("savedList").querySelector("script"), null);
  assert.ok(document.querySelector(".saved-library-title").textContent.length <= 200);
  assert.ok(document.querySelector(".saved-library-channel").textContent.length <= 120);

  document.getElementById("savedFilterAll").click();
  await flush();
  assert.equal(document.querySelectorAll(".saved-library-item").length, 2);
  assert.match(document.getElementById("savedList").textContent, /Second saved video/);
  document.querySelector(".saved-library-open").click();
  await flush();
  assert.deepEqual(messages.at(-1), {
    action: "openSavedDetail",
    sourceId: CURRENT_SOURCE_ID,
  });
  assert.equal(messages.some(({ action }) => action === "getNotes"), false);
  assert.doesNotMatch(document.body.textContent, /All Notes|Copy text|Copy timestamp|Delete note/i);
});

test("Saved exposes a loading state while its fixed request is pending", async () => {
  let resolveLibrary;
  const { document } = loadSidepanel({
    sendMessage: (message) => message.action === "getSavedLibrary"
      ? new Promise((resolve) => { resolveLibrary = resolve; })
      : Promise.resolve({ success: true }),
  });

  document.querySelector('[data-tab="saved"]').click();
  assert.match(document.getElementById("savedLibraryMessage").textContent, /loading.*Saved library/i);
  assert.equal(document.getElementById("savedRetryBtn").hidden, true);

  resolveLibrary({ success: true, summaries: [] });
  await flush();
  assert.match(document.getElementById("savedLibraryMessage").textContent, /queued locally.*after sync/i);
});

test("Saved refreshes on every activation so a newly synchronized save becomes visible", async () => {
  let library = [];
  const { document, messages } = loadSidepanel({
    sendMessage: async (message) => message.action === "getSavedLibrary"
      ? { success: true, summaries: library }
      : { success: true },
  });

  document.querySelector('[data-tab="saved"]').click();
  await flush();
  assert.match(document.getElementById("savedLibraryMessage").textContent, /queued locally.*after sync/i);

  library = [summaries[0]];
  document.querySelector('[data-tab="transcript"]').click();
  document.querySelector('[data-tab="saved"]').click();
  await flush();

  assert.equal(messages.filter(({ action }) => action === "getSavedLibrary").length, 2);
  assert.match(document.getElementById("savedList").textContent, /中文访谈/);
});

test("Saved shows empty, authentication, and temporary failure states with recovery actions", async (t) => {
  const cases = [
    {
      name: "empty",
      result: { success: true, summaries: [] },
      expected: /queued locally.*after sync/i,
    },
    {
      name: "signed out",
      result: { success: false, code: "AUTH_REQUIRED", retryable: false },
      expected: /sign in.*Saved/i,
    },
    {
      name: "expired",
      result: { success: false, code: "SESSION_EXPIRED", retryable: false },
      expected: /session expired.*sign in again/i,
    },
    {
      name: "temporary failure",
      result: { success: false, code: "INTERNAL_ERROR", retryable: true },
      expected: /temporarily unavailable/i,
    },
  ];

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      let calls = 0;
      const { document, messages } = loadSidepanel({
        sendMessage: async (message) => {
          if (message.action === "getSavedLibrary") {
            calls += 1;
            return calls === 1 ? scenario.result : { success: true, summaries: [summaries[0]] };
          }
          return { success: true };
        },
      });
      document.querySelector('[data-tab="saved"]').click();
      await flush();

      assert.match(document.getElementById("savedLibraryMessage").textContent, scenario.expected);
      assert.equal(document.getElementById("savedRetryBtn").hidden, false);
      assert.equal(document.getElementById("openSavedLibraryBtn").hidden, false);

      document.getElementById("savedRetryBtn").click();
      await flush();
      assert.equal(messages.filter(({ action }) => action === "getSavedLibrary").length, 2);
      assert.match(document.getElementById("savedList").textContent, /中文访谈/);

      document.getElementById("openSavedLibraryBtn").click();
      await flush();
      assert.deepEqual(messages.at(-1), { action: "openSavedLibrary" });
    });
  }
});

test("background fetches one fixed owner-authenticated library endpoint", async () => {
  const harness = loadBackground();
  const sidePanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel.html" };
  const response = await send(harness.listener, { action: "getSavedLibrary", userId: "attacker" }, sidePanel);

  assert.deepEqual(JSON.parse(JSON.stringify(response)), { success: true, summaries });
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].url, "https://app.popcorn.local/api/v1/extension/saved");
  assert.equal(harness.requests[0].options.method, "GET");
  assert.equal(harness.requests[0].options.headers.Authorization, "Bearer owner-token");
});

test("background distinguishes signed-out and expired authentication before fetching Saved", async () => {
  const sidePanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel.html" };
  const signedOut = loadBackground({ session: null });
  const expired = loadBackground({ accessTokenError: "Popcorn session refresh failed." });

  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    signedOut.listener,
    { action: "getSavedLibrary" },
    sidePanel,
  ))), {
    success: false,
    error: "Sign in to view Saved.",
    code: "AUTH_REQUIRED",
    retryable: false,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    expired.listener,
    { action: "getSavedLibrary" },
    sidePanel,
  ))), {
    success: false,
    error: "Your session expired. Sign in again.",
    code: "SESSION_EXPIRED",
    retryable: false,
  });
  assert.equal(signedOut.requests.length, 0);
  assert.equal(expired.requests.length, 0);
});

test("background opens only the fixed Saved page or a validated Saved detail", async () => {
  const harness = loadBackground();
  const sidePanel = { id: "extension-id", url: "chrome-extension://extension-id/sidepanel.html" };
  const untrusted = { id: "extension-id", url: "chrome-extension://extension-id/options.html" };

  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    harness.listener,
    { action: "openSavedLibrary", url: "https://evil.example/steal" },
    sidePanel,
  ))), { success: true });
  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    harness.listener,
    { action: "openSavedDetail", sourceId: CURRENT_SOURCE_ID, url: "https://evil.example/steal" },
    sidePanel,
  ))), { success: true });
  assert.deepEqual(harness.opened, [
    { url: "https://app.popcorn.local/saved" },
    { url: `https://app.popcorn.local/saved/${CURRENT_SOURCE_ID}` },
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    harness.listener,
    { action: "openSavedDetail", sourceId: "../../settings" },
    sidePanel,
  ))), { success: false, error: "invalid saved source" });
  assert.deepEqual(JSON.parse(JSON.stringify(await send(
    harness.listener,
    { action: "openSavedLibrary" },
    untrusted,
  ))), { success: false, error: "forbidden" });
  assert.equal(harness.opened.length, 2);
});
