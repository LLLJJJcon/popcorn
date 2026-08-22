const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const extensionRoot = path.resolve(__dirname, "..");
const sidepanelSource = fs.readFileSync(path.join(extensionRoot, "sidepanel.js"), "utf8");
const sidepanelHtml = fs.readFileSync(path.join(extensionRoot, "sidepanel.html"), "utf8");
const optionsSource = fs.readFileSync(path.join(extensionRoot, "options.js"), "utf8");

function loadSidepanelRecovery() {
  const dom = new JSDOM(sidepanelHtml, {
    url: "chrome-extension://popcorn/sidepanel.html",
  });
  const nativeAddEventListener = dom.window.document.addEventListener.bind(dom.window.document);
  dom.window.document.addEventListener = (type, listener, options) => {
    if (type === "DOMContentLoaded") return;
    nativeAddEventListener(type, listener, options);
  };
  const passive = { addListener() {} };
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
      runtime: { onMessage: passive, sendMessage: async () => ({ success: true }) },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: { onUpdated: passive, onActivated: passive },
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
  vm.runInNewContext(sidepanelSource, sandbox, { filename: "sidepanel.js" });
  return { dom, document: dom.window.document, helpers: sandbox.__YTD_SAVE_TESTING__ };
}

function optionsHarness(summary, account = null) {
  const dom = new JSDOM(fs.readFileSync(path.join(extensionRoot, "options.html"), "utf8"));
  const messages = [];
  const root = {
    document: dom.window.document,
    chrome: { runtime: { async sendMessage(message) {
      messages.push(structuredClone(message));
      if (message.command === "popcorn-auth:session") return { ok: true, account };
      if (message.action === "getSyncSummary") return summary;
      return { ok: true };
    } } },
  };
  const module = { exports: {} };
  vm.runInNewContext(optionsSource, { module, globalThis: root }, { filename: "options.js" });
  module.exports.initialize(root);
  return { dom, document: dom.window.document, messages };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

test("Side Panel exposes one polite save live region and semantic recovery controls", () => {
  const { document } = loadSidepanelRecovery();
  const liveRegions = document.querySelectorAll('[aria-live="polite"]');
  assert.equal(liveRegions.length, 1);
  assert.equal(liveRegions[0].id, "saveStatus");
  assert.equal(liveRegions[0].getAttribute("aria-atomic"), "true");
  assert.equal(document.getElementById("saveRetryBtn").tagName, "BUTTON");
  assert.equal(document.getElementById("saveRetryBtn").type, "button");
  assert.equal(document.getElementById("saveRecoveryLink").tagName, "A");
  assert.equal(document.querySelectorAll("form").length, 0);
});

test("saving, local queue, sign-in, retrying, and organizing states tell the truth", async () => {
  const { document, helpers } = loadSidepanelRecovery();
  const presenter = helpers.createSaveStatusPresenter(document, "https://app.popcorn.local");
  const button = document.getElementById("saveVideoBtn");
  let resolveSave;
  const saving = helpers.saveWithFeedback({
    input: { kind: "subtitle_row", originalChinese: "这个表达很自然。" },
    button,
    idleLabel: "Save Video",
    save: () => new Promise((resolve) => { resolveSave = resolve; }),
    presenter,
    scheduleReset() {},
  });
  assert.equal(button.textContent, "Saving…");
  assert.match(document.getElementById("saveStatusMessage").textContent, /Saving/i);
  resolveSave({ success: true, synced: false, pending: true });
  await saving;
  assert.match(document.getElementById("saveStatusMessage").textContent, /Saved locally.*queued/i);

  presenter.show({ state: "sign-in-required" });
  assert.match(document.getElementById("saveStatusMessage").textContent, /Sign in required.*stays queued/i);
  presenter.show({ state: "retrying" });
  assert.match(document.getElementById("saveStatusMessage").textContent, /Offline.*queued.*retrying/i);
  presenter.show({ state: "organizing" });
  assert.match(document.getElementById("saveStatusMessage").textContent, /Saved to Popcorn.*Organizing/i);
});

test("failed organization retains raw saved text and retries in place without player or page side effects", async () => {
  const { dom, document, helpers } = loadSidepanelRecovery();
  const presenter = helpers.createSaveStatusPresenter(document, "https://app.popcorn.local");
  const transcript = document.getElementById("transcriptList");
  transcript.scrollTop = 137;
  const player = { currentTime: 42.5, paused: false, pauseCalls: 0, playCalls: 0 };
  const initialLocation = dom.window.location.href;
  let attempts = 0;
  const save = async () => {
    attempts += 1;
    return attempts === 1
      ? { success: true, synced: true, status: "failed" }
      : { success: true, synced: true, status: "organizing" };
  };

  await helpers.saveWithFeedback({
    input: { kind: "subtitle_selection", originalChinese: "我完全没想到。" },
    button: document.getElementById("saveVideoBtn"),
    idleLabel: "Save Video",
    save,
    presenter,
    scheduleReset() {},
  });

  assert.equal(document.getElementById("saveRawText").textContent, "我完全没想到。");
  assert.match(document.getElementById("saveStatusMessage").textContent, /still available.*could not organize/i);
  const recovery = document.getElementById("saveRecoveryLink");
  assert.equal(recovery.href, "https://app.popcorn.local/saved");
  assert.equal(recovery.hidden, false);
  const retry = document.getElementById("saveRetryBtn");
  assert.equal(retry.hidden, false);
  retry.focus();
  assert.equal(document.activeElement, retry);
  retry.click();
  await flush();
  assert.equal(attempts, 2);
  assert.match(document.getElementById("saveStatusMessage").textContent, /Saved to Popcorn.*Organizing/i);
  assert.equal(transcript.scrollTop, 137);
  assert.equal(player.currentTime, 42.5);
  assert.equal(player.paused, false);
  assert.equal(player.pauseCalls, 0);
  assert.equal(player.playCalls, 0);
  assert.equal(dom.window.location.href, initialLocation);
  assert.equal(document.querySelectorAll("form").length, 0);
});

test("a save rejected before queue admission never claims that it was saved", async () => {
  const { document, helpers } = loadSidepanelRecovery();
  const presenter = helpers.createSaveStatusPresenter(document, "https://app.popcorn.local");

  await assert.rejects(() => helpers.saveWithFeedback({
    input: { kind: "subtitle_row", originalChinese: "这个表达很自然。" },
    button: document.getElementById("saveVideoBtn"),
    idleLabel: "Save Video",
    save: async () => { throw new Error("AUTH_REQUIRED"); },
    presenter,
    scheduleReset() {},
  }));

  const message = document.getElementById("saveStatusMessage").textContent;
  assert.match(message, /save was not completed/i);
  assert.doesNotMatch(message, /saved|queued|stays queued/i);
});

test("unsupported state is limited to the current YouTube watch-page boundary", () => {
  const { document, helpers } = loadSidepanelRecovery();
  helpers.showUnsupportedYouTube();
  assert.match(document.getElementById("welcomeTitle").textContent, /YouTube video/i);
  assert.match(document.getElementById("welcomeDescription").textContent, /youtube\.com\/watch/i);
  assert.match(document.getElementById("saveStatusMessage").textContent, /only.*currently watching/i);
  assert.doesNotMatch(document.getElementById("welcomeDescription").textContent, /text|URL|image|screenshot/i);
});

test("Options exposes queued saves through sign-in required and automatic retry states", async () => {
  const signedOut = optionsHarness({ pendingCount: 0, requiresSignIn: true, nextRetryAt: null });
  await flush();
  assert.match(signedOut.document.getElementById("syncStatus").textContent, /remain queued.*Sign in to retry/i);

  const retrying = optionsHarness(
    { pendingCount: 2, requiresSignIn: false, nextRetryAt: Date.now() + 30_000 },
    { email: "learner@example.com" },
  );
  await flush();
  assert.match(retrying.document.getElementById("syncStatus").textContent, /2 saved moments.*queued.*retrying automatically/i);
});
