const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const background = fs.readFileSync(path.join(root, "background.js"), "utf8");
const optionsSource = fs.readFileSync(path.join(root, "options.js"), "utf8");
const legacyMessageSourceAccess = /\bmessage\s*(?:\??\.\s*source\b|\??\.\s*\[\s*["']source["']\s*\]|\[\s*["']source["']\s*\])/;

function optionHarness({ authFailure = false, initialAccount = null, pendingCount = 0, signOutRequiresDecision = false } = {}) {
  const handlers = {};
  const messages = [];
  const elements = Object.fromEntries([
    "accountEmail",
    "authEmail",
    "authPassword",
    "signInBtn",
    "reauthBtn",
    "credentialFields",
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
  let account = initialAccount;
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
      if (message.action === "getSyncSummary") return { pendingCount };
      if (message.command === "popcorn-auth:sign-out") {
        if (signOutRequiresDecision) return {ok:true, requiresDecision:true};
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


test("Options reauthenticates an existing account without sign-out or discarding queued moments", async () => {
  const h=optionHarness({initialAccount:{email:"existing@example.test"},pendingCount:3});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.elements.credentialFields.hidden,true);assert.equal(h.elements.signInBtn.hidden,true);assert.equal(h.elements.reauthBtn.hidden,false);
  const before=h.messages.length;
  h.handlers["reauthBtn:click"]();
  assert.equal(h.messages.length,before);assert.equal(h.elements.credentialFields.hidden,false);assert.equal(h.elements.signInBtn.hidden,false);assert.equal(h.elements.signUpBtn.hidden,true);
  assert.equal(h.elements.authEmail.value,"");assert.equal(h.elements.authPassword.value,"");
  h.elements.authEmail.value="existing@example.test";h.elements.authPassword.value="typed-by-user";
  await h.handlers["signInBtn:click"]();
  assert.equal(h.elements.credentialFields.hidden,true);assert.equal(h.elements.signInBtn.hidden,true);assert.equal(h.elements.reauthBtn.hidden,false);
  assert.match(h.elements.syncStatus.textContent,/3 saved moments waiting to sync/);
  assert.equal(h.messages.some(m=>m.command==="popcorn-auth:sign-out"||m.action==="discardPendingEvents"),false);
});

test("Options keeps explicit reauthentication available after rejection while retaining the queued account", async () => {
  const h=optionHarness({authFailure:true,initialAccount:{email:"existing@example.test"},pendingCount:2});
  await new Promise(resolve=>setImmediate(resolve));
  h.handlers["reauthBtn:click"]();h.elements.authEmail.value="existing@example.test";h.elements.authPassword.value="wrong-password";
  await h.handlers["signInBtn:click"]();
  assert.equal(h.elements.credentialFields.hidden,false);assert.equal(h.elements.signInBtn.hidden,false);assert.equal(h.elements.signUpBtn.hidden,true);
  assert.equal(h.elements.accountEmail.textContent,"existing@example.test");assert.equal(h.elements.authPassword.value,"");
  assert.match(h.elements.authStatus.textContent,/not completed/);
  assert.equal(h.messages.some(m=>m.command==="popcorn-auth:sign-out"||m.action==="discardPendingEvents"),false);
});


test("Options invalidates an earlier discard decision when reauthentication starts and succeeds", async () => {
  const h=optionHarness({initialAccount:{email:"existing@example.test"},pendingCount:3,signOutRequiresDecision:true});
  await new Promise(resolve=>setImmediate(resolve));
  await h.handlers["signOutBtn:click"]();assert.equal(h.elements.discardPendingBtn.hidden,false);
  h.handlers["reauthBtn:click"]();assert.equal(h.elements.signOutChoice.hidden,true);assert.equal(h.elements.discardPendingBtn.hidden,true);
  await h.handlers["signOutBtn:click"]();assert.equal(h.elements.discardPendingBtn.hidden,false);
  h.elements.authEmail.value="existing@example.test";h.elements.authPassword.value="correct-horse";
  await h.handlers["signInBtn:click"]();
  assert.equal(h.elements.signOutChoice.hidden,true);assert.equal(h.elements.discardPendingBtn.hidden,true);
  assert.equal(h.messages.some(m=>m.action==="discardPendingEvents"),false);
  assert.match(h.elements.syncStatus.textContent,/3 saved moments waiting to sync/);
});
