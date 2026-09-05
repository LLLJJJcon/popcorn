const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(root, "options.js"), "utf8");
const legacyMessageSourceAccess = /\bmessage\s*(?:\??\.\s*source\b|\??\.\s*\[\s*["']source["']\s*\]|\[\s*["']source["']\s*\])/;

function optionHarness({ authFailure = false } = {}) {
  const handlers = {};
  const messages = [];
  const elements = Object.fromEntries([
    "accountEmail",
    "authEmail",
    "authPassword",
    "signInBtn",
    "signUpBtn",
    "signOutBtn",
    "authStatus",
    "syncStatus",
    "signOutChoice",
    "discardPendingBtn",
    "dataStatus",
    "clearCacheBtn",
  ].map((id) => [id, {
    id,
    hidden: false,
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      handlers[`${id}:${type}`] = handler;
    },
  }]));
  let account = null;
  const sandbox = {
    document: { getElementById: (id) => elements[id] },
    chrome: { runtime: { async sendMessage(message) {
      messages.push(structuredClone(message));
      if (message.command === "popcorn-auth:session") return { ok: true, account };
      if (["popcorn-auth:sign-in", "popcorn-auth:sign-up"].includes(message.command)) {
        if (authFailure) return { ok: false, error: "raw provider rejection" };
        account = { email: message.email };
        return {
          ok: true,
          account,
          ignoredAccessToken: "must-not-be-rendered",
        };
      }
      if (message.action === "getSyncSummary") return { pendingCount: 0 };
      if (message.command === "popcorn-auth:sign-out") {
        account = null;
        return { ok: true };
      }
      return { ok: true, clearedCount: 0 };
    } } },
    globalThis: null,
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(optionsSource, sandbox, { filename: "options.js" });
  return { handlers, messages, elements };
}

test("the classic MV3 worker remains the sole trusted auth owner", () => {
  assert.match(background, /importScripts\("settings\.js", "auth\.js"\)/);
  assert.match(background, /const popcornAuthClient = POPCORN_AUTH\.createAuthClient/);
  assert.match(background, /function ensurePopcornAuthReady\(\)[\s\S]*popcornAuthClient\.initialize\(\)/);
  assert.doesNotMatch(background, /void popcornAuthClient\.initialize|setAccessLevel/);
  assert.match(background, /chrome\.runtime\.onMessage\.addListener/);
  assert.match(background, /sender\.id/);
  assert.match(background, /sender\.url/);
  assert.match(background, /sender\.tab/);
  assert.doesNotMatch(background, legacyMessageSourceAccess);
  for (const prohibited of [
    "message.source",
    "message?.source",
    "message['source']",
    'message["source"]',
    "message?.['source']",
  ]) {
    assert.match(prohibited, legacyMessageSourceAccess);
  }
  assert.doesNotMatch("message.sourceId", legacyMessageSourceAccess);
  assert.match(background, /getPopcornAccessToken/);
  assert.doesNotMatch(
    background,
    /sendResponse\([^\n]*(?:accessToken|refreshToken|password)/,
  );
  assert.doesNotMatch(background, /launchWebAuthFlow|getRedirectURL|popcorn_pkce/);
});

test("Options clears email and password after successful password sign-in", async () => {
  const harness = optionHarness();
  await new Promise((resolve) => setImmediate(resolve));
  harness.elements.authEmail.value = "a@example.com";
  harness.elements.authPassword.value = "correct-horse";

  await harness.handlers["signInBtn:click"]();

  assert.deepEqual(harness.messages.slice(-3), [
    {
      command: "popcorn-auth:sign-in",
      email: "a@example.com",
      password: "correct-horse",
    },
    { command: "popcorn-auth:session" },
    { action: "getSyncSummary" },
  ]);
  assert.equal(harness.elements.authEmail.value, "");
  assert.equal(harness.elements.authPassword.value, "");
  assert.equal(harness.elements.authStatus.textContent, "Signed in.");
  assert.doesNotMatch(
    `${harness.elements.authStatus.textContent} ${harness.elements.accountEmail.textContent}`,
    /correct-horse|must-not-be-rendered|raw provider/i,
  );
});

test("Options clears credentials and renders only a fixed message after rejection", async () => {
  const harness = optionHarness({ authFailure: true });
  await new Promise((resolve) => setImmediate(resolve));
  harness.elements.authEmail.value = "a@example.com";
  harness.elements.authPassword.value = "correct-horse";

  await harness.handlers["signUpBtn:click"]();

  assert.equal(harness.elements.authEmail.value, "");
  assert.equal(harness.elements.authPassword.value, "");
  assert.equal(harness.elements.authStatus.textContent, "Account request was not completed.");
  assert.doesNotMatch(harness.elements.authStatus.textContent, /correct-horse|provider|raw|a@example/i);
});
