const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const background = fs.readFileSync(path.resolve(__dirname, "..", "background.js"), "utf8");

test("the classic MV3 worker is the sole trusted auth owner", () => {
  assert.match(background, /importScripts\("settings\.js", "auth\.js"\)/);
  assert.match(background, /const popcornAuthClient = POPCORN_AUTH\.createAuthClient/);
  assert.match(background, /popcornAuthClient\.initialize\(\)/);
  assert.match(background, /chrome\.runtime\.onMessage\.addListener/);
  assert.match(background, /sender\.id/);
  assert.match(background, /sender\.url/);
  assert.match(background, /sender\.tab/);
  assert.doesNotMatch(background, /message\.source/);
  assert.match(background, /getPopcornAccessToken/);
  assert.doesNotMatch(background, /sendResponse\([^\n]*(?:accessToken|refreshToken|verifier|state)/);
});
