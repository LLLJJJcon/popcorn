const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const VIDEO_ID = "dQw4w9WgXcQ";
const EVENT_ID = "00000000-0000-4000-8000-000000000101";
const CAPTURED_AT = "2026-08-16T10:00:00.000Z";
const SEGMENT_A = "a".repeat(64);
const SEGMENT_B = "b".repeat(64);

function loadScript(file, testingKey) {
  const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const passive = { addListener() {} };
  const document = {
    readyState: "loading",
    body: { appendChild() {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  };
  const sandbox = {
    console,
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    Date,
    crypto: { randomUUID: () => EVENT_ID },
    document,
    window: {
      location: { pathname: "/watch", search: `?v=${VIDEO_ID}` },
      addEventListener() {},
    },
    chrome: {
      runtime: { onMessage: passive, sendMessage: async () => ({ success: true }) },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: { onUpdated: passive, onActivated: passive },
      storage: { local: { get: async () => ({}), remove: async () => {} } },
    },
    MutationObserver: class { observe() {} },
    IntersectionObserver: class { observe() {} disconnect() {} },
    CSS: { escape: (value) => value },
    YTD_SETTINGS: {},
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox[testingKey];
}

const content = loadScript("content.js", "__YTD_SAVE_TESTING__");
const panel = loadScript("sidepanel.js", "__YTD_SAVE_TESTING__");
const identity = { clientEventId: EVENT_ID, capturedAt: CAPTURED_AT };

test("Save Video builds only the frozen canonical YouTube snapshot payload", () => {
  const actual = panel.buildVideoSaveInput({
    videoId: VIDEO_ID,
    title: "中文访谈",
    channelName: "中文频道",
    duration: 213.9,
    description: "一段中文访谈。",
    currentTime: 42.8,
  }, identity);

  assert.deepEqual(JSON.parse(JSON.stringify(actual)), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "video",
    canonicalUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    title: "中文访谈",
    channel: "中文频道",
    thumbnailUrl: `https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`,
    durationSeconds: 213.9,
    description: "一段中文访谈。",
    currentTimeSeconds: 42.8,
    requestNativeSnapshot: true,
  });
});

test("player moment preserves playback and subtracts the upstream reaction delay", async () => {
  const player = { currentTime: 2.75, paused: false };
  const calls = [];
  const result = await content.savePlayerMoment({
    videoId: VIDEO_ID,
    player,
    identity,
    enqueueSavedItem: async (input) => { calls.push(input); return { status: "saved" }; },
  });

  assert.equal(player.currentTime, 2.75);
  assert.equal(player.paused, false);
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "player_moment",
    capturedSecond: 0,
  });
  assert.equal(result.status, "saved");
});

test("subtitle row preserves exact visible evidence with bounded neighboring context", () => {
  const actual = panel.buildSubtitleRowSaveInput({
    videoId: VIDEO_ID,
    segment: {
      id: SEGMENT_A,
      text: "这也太离谱了吧。",
      start: 42,
      end: 48,
    },
    englishTranslation: "That is way too absurd.",
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  }, identity);

  assert.deepEqual(JSON.parse(JSON.stringify(actual)), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "subtitle_row",
    segmentId: SEGMENT_A,
    originalChinese: "这也太离谱了吧。",
    englishTranslation: "That is way too absurd.",
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  });
});

test("subtitle selection preserves exact UTF-16 cross-line evidence and all stable IDs", () => {
  const actual = panel.buildSubtitleSelectionSaveInput({
    videoId: VIDEO_ID,
    evidence: {
      selectedChinese: "第一行结尾\n第二行开头",
      segmentIds: [SEGMENT_A, SEGMENT_B],
      utf16Start: 2,
      utf16End: 13,
      startSeconds: 10,
      endSeconds: 24,
      context: "甲乙第一行结尾\n第二行开头丙丁",
      complete: true,
    },
    contextBefore: ["前一句。"],
    contextAfter: ["后一句。"],
  }, identity);

  assert.deepEqual(JSON.parse(JSON.stringify(actual)), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "subtitle_selection",
    originalChinese: "第一行结尾\n第二行开头",
    segmentIds: [SEGMENT_A, SEGMENT_B],
    startSeconds: 10,
    endSeconds: 24,
    startOffset: 2,
    endOffset: 13,
    contextBefore: ["前一句。"],
    contextAfter: ["后一句。"],
  });
});

test("key quote and AI explanation preserve displayed text and grounded evidence", () => {
  const quote = panel.buildKeyQuoteSaveInput({
    videoId: VIDEO_ID,
    quote: {
      quote: "这也太离谱了吧。",
      timestampSeconds: 44,
      sourceSegmentIds: [SEGMENT_A],
    },
  }, identity);
  const explanation = panel.buildAiExplanationSaveInput({
    videoId: VIDEO_ID,
    evidence: {
      selectedChinese: "太离谱了",
      segmentIds: [SEGMENT_A],
      startSeconds: 42,
      endSeconds: 48,
      complete: true,
    },
    englishExplanation: "An informal reaction meaning something is absurd.",
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  }, identity);

  assert.deepEqual(JSON.parse(JSON.stringify(quote)), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "key_quote",
    exactQuote: "这也太离谱了吧。",
    quoteSeconds: 44,
    segmentIds: [SEGMENT_A],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(explanation)), {
    clientEventId: EVENT_ID,
    youtubeVideoId: VIDEO_ID,
    capturedAt: CAPTURED_AT,
    kind: "ai_explanation",
    selectedChinese: "太离谱了",
    englishExplanation: "An informal reaction meaning something is absurd.",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    contextBefore: ["你刚才看到了吗？"],
    contextAfter: ["我完全没想到。"],
  });
});

test("builders fail closed on untrusted sources, malformed evidence, and payload bounds", () => {
  const video = {
    videoId: VIDEO_ID,
    title: "中文访谈",
    channelName: "中文频道",
    duration: 213,
    description: "一段中文访谈。",
    currentTime: 42,
  };
  assert.throws(() => panel.buildVideoSaveInput({ ...video, videoId: "short" }, identity));
  assert.throws(() => panel.buildVideoSaveInput({ ...video, url: "https://example.com" }, identity));
  assert.throws(() => panel.buildVideoSaveInput({ ...video, thumbnailUrl: "https://attacker.example/image.png" }, identity));
  assert.throws(() => panel.buildVideoSaveInput({ ...video, description: "x".repeat(5001) }, identity));
  assert.throws(() => panel.buildSubtitleSelectionSaveInput({
    videoId: VIDEO_ID,
    evidence: {
      selectedChinese: "第一行\n第二行",
      segmentIds: [SEGMENT_A, SEGMENT_B],
      utf16Start: 0,
      utf16End: 7,
      startSeconds: 10,
      endSeconds: 24,
      context: "第一行\n第二行",
      complete: false,
    },
    contextBefore: [],
    contextAfter: [],
  }, identity));
  assert.throws(() => panel.buildKeyQuoteSaveInput({
    videoId: VIDEO_ID,
    quote: { quote: "No Chinese", timestampSeconds: 1, sourceSegmentIds: [] },
  }, identity));
});

test("the save controller accepts only six exact variants before one injected queue call", async () => {
  const calls = [];
  const forbidden = {
    fetch() { throw new Error("fetch must not run"); },
    transcript() { throw new Error("transcript must not run"); },
    translation() { throw new Error("translation must not run"); },
    ai() { throw new Error("AI must not run"); },
    saveNote() { throw new Error("old saveNote must not run"); },
  };
  const controller = panel.createSaveController(async (input) => {
    calls.push(input);
    return { status: "queued_locally" };
  }, forbidden);
  const valid = panel.buildKeyQuoteSaveInput({
    videoId: VIDEO_ID,
    quote: { quote: "这个表达很自然。", timestampSeconds: 10, sourceSegmentIds: [SEGMENT_A] },
  }, identity);

  await assert.rejects(() => controller.save({ ...valid, kind: "text", text: "hello" }));
  await assert.rejects(() => controller.save({ ...valid, kind: "image", imageUrl: "https://example.com/a.png" }));
  await assert.rejects(() => controller.save({ ...valid, screenshot: "data:image/png;base64,x" }));
  assert.equal(calls.length, 0);

  const result = await controller.save(valid);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], valid);
  assert.equal(result.status, "queued_locally");
});
