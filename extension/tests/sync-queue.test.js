const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const USER_A = "00000000-0000-4000-8000-000000000001";
const USER_B = "00000000-0000-4000-8000-000000000002";
const EVENT_A = "00000000-0000-4000-8000-000000000101";
const EVENT_B = "00000000-0000-4000-8000-000000000102";
const EVENT_C = "00000000-0000-4000-8000-000000000103";

function savedInput(clientEventId) {
  return {
    clientEventId,
    youtubeVideoId: "dQw4w9WgXcQ",
    kind: "player_moment",
    capturedAt: "2026-08-16T10:00:00.000Z",
    capturedSecond: 42,
  };
}

function createChrome(initial = {}, { bytesInUse, failSet = false } = {}) {
  const values = structuredClone(initial);
  const calls = [];
  const local = {
    async get(keys) {
      calls.push(["get", keys]);
      if (keys === null) return structuredClone(values);
      const requested = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(requested.filter((key) => Object.hasOwn(values, key)).map((key) => [key, structuredClone(values[key])]));
    },
    async set(items) {
      calls.push(["set", structuredClone(items)]);
      if (failSet) throw Object.assign(new Error("QUOTA_BYTES quota exceeded"), { code: "QUOTA_BYTES" });
      Object.assign(values, structuredClone(items));
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      calls.push(["remove", [...list]]);
      for (const key of list) delete values[key];
    },
    async getBytesInUse(keys) {
      calls.push(["getBytesInUse", keys]);
      if (typeof bytesInUse === "function") return bytesInUse(values, keys);
      const selected = keys === null ? values : Object.fromEntries((Array.isArray(keys) ? keys : [keys]).filter((key) => Object.hasOwn(values, key)).map((key) => [key, values[key]]));
      return Buffer.byteLength(JSON.stringify(selected));
    },
  };
  const alarms = [];
  return {
    values,
    calls,
    alarms,
    chrome: {
      storage: { local },
      alarms: {
        async create(name, info) { alarms.push([name, structuredClone(info)]); },
        async clear(name) { calls.push(["clearAlarm", name]); return true; },
      },
    },
  };
}

function authFor(userId) {
  return { getSession: async () => userId ? ({ user: { id: userId } }) : null };
}

async function createQueue(dependencies) {
  await import("../sync-queue.js");
  return globalThis.POPCORN_SYNC_QUEUE.createSyncQueue(dependencies);
}

test("enqueue writes the complete owner-bound event before networking and a fresh worker flushes it", async () => {
  const harness = createChrome();
  const networkSnapshots = [];
  const firstWorker = await createQueue({
    chrome: harness.chrome,
    authClient: authFor(USER_A),
    apiFetch: async () => {
      networkSnapshots.push(structuredClone(harness.values.popcorn_pending_events));
      throw Object.assign(new Error("offline"), { retryable: true });
    },
    now: () => 1_000,
  });

  const result = await firstWorker.enqueueSavedItem(savedInput(EVENT_A));

  assert.equal(result.success, true);
  assert.equal(result.pending, true);
  assert.deepEqual(networkSnapshots[0], [{
    ownerUserId: USER_A,
    clientEventId: EVENT_A,
    input: savedInput(EVENT_A),
    attempts: 0,
    nextAttemptAt: 1_000,
  }]);
  assert.equal(harness.values.popcorn_pending_events[0].attempts, 1);

  const secondWorker = await createQueue({
    chrome: harness.chrome,
    authClient: authFor(USER_A),
    apiFetch: async (_path, options) => ({ data: { results: JSON.parse(options.body).events.map((input) => ({ clientEventId: input.clientEventId, ok: true })) } }),
    now: () => harness.values.popcorn_pending_events[0].nextAttemptAt,
  });
  await secondWorker.flushPendingEvents("startup");
  assert.deepEqual(harness.values.popcorn_pending_events, []);
});

test("partial and duplicate flushes remove only matching successful acknowledgements", async () => {
  const descriptors = [EVENT_A, EVENT_B, EVENT_C].map((id) => ({ ownerUserId: USER_A, clientEventId: id, input: savedInput(id), attempts: 0, nextAttemptAt: 0 }));
  const harness = createChrome({ popcorn_pending_events: descriptors });
  const batches = [];
  let call = 0;
  let clock = 10_000_000;
  const queue = await createQueue({
    chrome: harness.chrome,
    authClient: authFor(USER_A),
    apiFetch: async (_path, options) => {
      batches.push(JSON.parse(options.body).events.map((event) => event.clientEventId));
      call += 1;
      return call === 1
        ? { data: { results: [
          { clientEventId: EVENT_A, ok: true },
          { clientEventId: EVENT_B, ok: false, error: { code: "SYNC_RETRYING", retryable: true } },
          { clientEventId: "00000000-0000-4000-8000-999999999999", ok: true },
        ] } }
        : { data: { results: [
          { clientEventId: EVENT_B, ok: true },
          { clientEventId: EVENT_C, ok: true },
        ] } };
    },
    now: () => clock,
  });

  await queue.flushPendingEvents("manual");
  assert.deepEqual(harness.values.popcorn_pending_events.map((event) => event.clientEventId), [EVENT_B, EVENT_C]);
  clock = harness.values.popcorn_pending_events[0].nextAttemptAt;
  await queue.flushPendingEvents("manual");
  assert.deepEqual(harness.values.popcorn_pending_events, []);
  assert.deepEqual(batches, [[EVENT_A, EVENT_B, EVENT_C], [EVENT_B, EVENT_C]]);
});

test("missing auth retains events and another account can neither upload nor discard them", async () => {
  const descriptor = { ownerUserId: USER_A, clientEventId: EVENT_A, input: savedInput(EVENT_A), attempts: 0, nextAttemptAt: 0 };
  const harness = createChrome({ popcorn_pending_events: [descriptor] });
  let uploads = 0;
  const signedOut = await createQueue({ chrome: harness.chrome, authClient: authFor(null), apiFetch: async () => { uploads += 1; }, now: () => 5_000 });
  const signedOutResult = await signedOut.flushPendingEvents("startup");
  assert.equal(signedOutResult.code, "AUTH_REQUIRED");
  assert.equal(uploads, 0);
  assert.equal(harness.values.popcorn_pending_events.length, 1);
  assert.ok(harness.alarms.length > 0);

  const otherAccount = await createQueue({ chrome: harness.chrome, authClient: authFor(USER_B), apiFetch: async () => { uploads += 1; }, now: () => 5_000 });
  assert.equal((await otherAccount.flushPendingEvents("panel-open")).pending, 1);
  assert.equal(uploads, 0);
  assert.deepEqual(harness.calls.at(-1), ["clearAlarm", "popcorn-sync-retry"]);
  await assert.rejects(otherAccount.discardPendingEvents(USER_A), /owner/i);
  assert.equal(harness.values.popcorn_pending_events.length, 1);
});

test("queue admission budgets raw events independently and never silently deletes an event on quota failure", async () => {
  const existing = { ownerUserId: USER_A, clientEventId: EVENT_A, input: savedInput(EVENT_A), attempts: 0, nextAttemptAt: 0 };
  const harness = createChrome({
    popcorn_pending_events: [existing],
    "digest_dQw4w9WgXcQ": { transcript: "large display cache".repeat(100), timestamp: 1 },
  }, {
    bytesInUse(_values, keys) {
      return keys === "popcorn_pending_events" ? 200 : 6_000_000;
    },
  });
  const queue = await createQueue({ chrome: harness.chrome, authClient: authFor(USER_A), apiFetch: async () => { throw new Error("offline"); }, now: () => 1_000 });

  await queue.enqueueSavedItem(savedInput(EVENT_B));
  assert.deepEqual(harness.values.digest_dQw4w9WgXcQ, { transcript: "large display cache".repeat(100), timestamp: 1 });
  assert.deepEqual(harness.values.popcorn_pending_events.map((event) => event.clientEventId), [EVENT_A, EVENT_B]);
  assert.ok(harness.calls.some(([name, keys]) => name === "getBytesInUse" && keys === "popcorn_pending_events"));

  const full = createChrome({ popcorn_pending_events: [existing] }, { bytesInUse: () => 6_000_000 });
  const fullQueue = await createQueue({ chrome: full.chrome, authClient: authFor(USER_A), apiFetch: async () => { throw new Error("should not upload"); }, now: () => 1_000 });
  const rejected = await fullQueue.enqueueSavedItem(savedInput(EVENT_B));
  assert.equal(rejected.code, "SYNC_QUEUE_FULL");
  assert.deepEqual(full.values.popcorn_pending_events, [existing]);

});

test("retry attempts and nextAttemptAt are capped and deterministic", async () => {
  const harness = createChrome({ popcorn_pending_events: [{ ownerUserId: USER_A, clientEventId: EVENT_A, input: savedInput(EVENT_A), attempts: 31, nextAttemptAt: 0 }] });
  const queue = await createQueue({
    chrome: harness.chrome,
    authClient: authFor(USER_A),
    apiFetch: async () => { throw Object.assign(new Error("offline"), { retryable: true }); },
    now: () => 1_000,
  });
  await queue.flushPendingEvents("alarm");
  const pending = harness.values.popcorn_pending_events[0];
  assert.equal(pending.attempts, 32);
  assert.equal(pending.nextAttemptAt, 3_601_000);
  assert.deepEqual(harness.alarms.at(-1), ["popcorn-sync-retry", { when: 3_601_000 }]);
});

test("startup recovery preserves legacy user data and pending descriptors", async () => {
  const descriptor = { ownerUserId: USER_A, clientEventId: EVENT_A, input: savedInput(EVENT_A), attempts: 2, nextAttemptAt: 99 };
  const harness = createChrome({
    popcorn_pending_events: [descriptor],
    ytd_notes: [{ text: "retired" }],
    digest_dQw4w9WgXcQ: { transcript: [{ text: "full transcript" }], analysis: { overview: "cache" } },
    popcorn_display_compact: { title: "safe compact display state" },
  });
  const queue = await createQueue({ chrome: harness.chrome, authClient: authFor(USER_A), apiFetch: async () => ({ data: { results: [] } }), now: () => 1 });
  await queue.recoverOnStartup("startup");
  assert.deepEqual(harness.values.ytd_notes, [{ text: "retired" }]);
  assert.deepEqual(harness.values.digest_dQw4w9WgXcQ, { transcript: [{ text: "full transcript" }], analysis: { overview: "cache" } });
  assert.deepEqual(harness.values.popcorn_pending_events, [descriptor]);
  assert.deepEqual(harness.values.popcorn_display_compact, { title: "safe compact display state" });
});

test("queue module has no interval or durable-secret surface", () => {
  const source = fs.readFileSync(path.join(root, "sync-queue.js"), "utf8");
  assert.doesNotMatch(source, /setInterval|accessToken|refreshToken|apiKey|gateway/i);
});
