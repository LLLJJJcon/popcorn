const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

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

const SIDE_PANEL_HTML = `
  <button id="errorBtn" type="button"></button>
  <button id="saveVideoBtn" type="button">Save Video</button>
  <section id="saveStatus" hidden>
    <p id="saveStatusMessage"></p>
    <blockquote id="saveRawText" hidden></blockquote>
    <button id="saveRetryBtn" type="button" hidden>Retry save</button>
    <a id="saveRecoveryLink" hidden></a>
  </section>
  <div id="overviewText"></div>
  <ul id="chapterList"></ul>
  <div id="quotesList"></div>
  <div id="contentArea">
    <div><div id="transcriptList"></div></div>
  </div>
  <button id="followPlaybackBtn" type="button"></button>
`;

const TRANSCRIPT_SEGMENTS = [
  {
    stableId: "c".repeat(64),
    text: "你刚才看到了吗？",
    start: 36,
    duration: 6,
  },
  {
    stableId: SEGMENT_A,
    text: "这也太离谱了吧。",
    start: 42,
    duration: 6,
  },
  {
    stableId: SEGMENT_B,
    text: "我完全没想到。",
    start: 48,
    duration: 6,
  },
];

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSidePanelHandlerHarness() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "..", "sidepanel.js"),
    "utf8",
  );
  const dom = new JSDOM(SIDE_PANEL_HTML, {
    url: `chrome-extension://popcorn/sidepanel.html?v=${VIDEO_ID}`,
  });
  const document = dom.window.document;
  const nativeAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = (type, listener, options) => {
    if (type === "DOMContentLoaded") return;
    nativeAddEventListener(type, listener, options);
  };

  const saveCalls = [];
  const runtimeMessages = [];
  const messageListeners = [];
  const forbiddenCalls = [];
  const scheduledResets = [];
  const recordForbiddenCall = (name, args = []) => {
    forbiddenCalls.push({ name, args: jsonValue(args) });
  };
  const passive = { addListener() {} };
  const sandbox = {
    console: {
      ...console,
      error() {},
    },
    URL,
    URLSearchParams,
    TextDecoder,
    TextEncoder,
    Date,
    crypto: { randomUUID: () => EVENT_ID },
    document,
    window: dom.window,
    navigator: dom.window.navigator,
    fetch(...args) {
      recordForbiddenCall("fetch", args);
      throw new Error("fetch must not run from a save handler");
    },
    saveNote(...args) {
      recordForbiddenCall("saveNote", args);
      throw new Error("old saveNote must not run");
    },
    chrome: {
      runtime: {
        onMessage: { addListener(listener) { messageListeners.push(listener); } },
        async sendMessage(message) {
          runtimeMessages.push(jsonValue(message));
          if (
            message?.action === "relayToContent" &&
            message?.payload?.action === "getCurrentTime"
          ) {
            return { success: true, response: { currentTime: 42.8 } };
          }
          recordForbiddenCall("runtimePersistence", [message]);
          throw new Error(`unexpected runtime persistence: ${message?.action}`);
        },
      },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: { onUpdated: passive, onActivated: passive },
      storage: {
        local: {
          get: async () => ({}),
          remove: async () => {},
        },
      },
    },
    MutationObserver: dom.window.MutationObserver,
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    CSS: { escape: (value) => value },
    YTD_SETTINGS: {},
    setTimeout(callback, delay) {
      scheduledResets.push({ callback, delay });
      return scheduledResets.length;
    },
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    __saveCalls: saveCalls,
    __recordForbiddenCall: recordForbiddenCall,
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(source, context);
  vm.runInContext(
    `
      createSaveIdentity = () => (${JSON.stringify(identity)});
      enqueueSavedItem = async (input) => {
        globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
        return { success: true, synced: false };
      };
      currentVideoId = ${JSON.stringify(VIDEO_ID)};
      currentVideoUrl = ${JSON.stringify(`https://www.youtube.com/watch?v=${VIDEO_ID}`)};
      currentVideoTitle = "中文访谈";
      currentChannelName = "中文频道";
      currentVideoDescription = "一段中文访谈。";
      currentVideoDuration = 213.9;
      currentTranscript = ${JSON.stringify(TRANSCRIPT_SEGMENTS)};
      seekTo = (...args) => {
        globalThis.__recordForbiddenCall("seek", args);
        throw new Error("save must not seek");
      };
      sendCloudAction = async (...args) => {
        globalThis.__recordForbiddenCall("provider", args);
        throw new Error("Provider must not run from a save handler");
      };
      globalThis.__realTranslateTranscript = translateTranscript;
      translateTranscript = async (...args) => {
        globalThis.__recordForbiddenCall("translation", args);
        throw new Error("translation must not run from a save handler");
      };
      fetchTranscript = async (...args) => {
        globalThis.__recordForbiddenCall("transcript", args);
        throw new Error("transcript must not run from a save handler");
      };
      saveToCache = async (...args) => {
        globalThis.__recordForbiddenCall("saveToCache", args);
        throw new Error("secondary persistence must not run from a save handler");
      };
      updateCache = async (...args) => {
        globalThis.__recordForbiddenCall("updateCache", args);
        throw new Error("secondary persistence must not run from a save handler");
      };
    `,
    context,
  );

  let submitted = 0;
  document.addEventListener("submit", (event) => {
    submitted += 1;
    event.preventDefault();
  });

  return {
    context,
    document,
    dom,
    saveCalls,
    runtimeMessages,
    forbiddenCalls,
    scheduledResets,
    messageListeners,
    get submitted() {
      return submitted;
    },
  };
}

async function clickAndFlush(harness, element) {
  element.dispatchEvent(
    new harness.dom.window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    }),
  );
  await new Promise((resolve) => setImmediate(resolve));
}

function assertNoSaveSideEffects(harness) {
  for (const name of [
    "fetch",
    "provider",
    "translation",
    "transcript",
    "saveNote",
    "saveToCache",
    "updateCache",
    "runtimePersistence",
    "seek",
  ]) {
    assert.equal(
      harness.forbiddenCalls.filter((call) => call.name === name).length,
      0,
      `${name} must not run from a save handler`,
    );
  }
  assert.equal(harness.submitted, 0);
  assert.equal(harness.document.querySelectorAll("form").length, 0);
  assert.equal(
    harness.dom.window.location.href,
    `chrome-extension://popcorn/sidepanel.html?v=${VIDEO_ID}`,
  );
}

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

test("the actual Save Video click handler enqueues the exact displayed snapshot once", async () => {
  const harness = createSidePanelHandlerHarness();
  harness.context.setupEventListeners();

  await clickAndFlush(
    harness,
    harness.document.getElementById("saveVideoBtn"),
  );

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
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
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, [
    {
      action: "relayToContent",
      payload: { action: "getCurrentTime" },
    },
  ]);
  assertNoSaveSideEffects(harness);
});

test("the actual subtitle-row Save click enqueues its displayed bilingual row once without seeking", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
    `,
    harness.context,
  );
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  assert.equal(row.querySelector(".transcript-original").textContent, "这也太离谱了吧。");
  assert.equal(row.querySelector(".transcript-translation").textContent, "That is way too absurd.");

  await clickAndFlush(harness, row.querySelector(".transcript-save-btn"));

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
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
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, []);
  assertNoSaveSideEffects(harness);
});

test("the actual subtitle-row Save click keeps the row saved after the reset callback runs", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
    `,
    harness.context,
  );
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  const saveButton = row.querySelector(".transcript-save-btn");

  await clickAndFlush(harness, saveButton);

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
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
    },
  ]);
  assert.equal(harness.scheduledResets.length, 1);

  harness.scheduledResets[0].callback();

  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  saveButton.click();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(harness.saveCalls.length, 1);
  assert.deepEqual(harness.runtimeMessages, []);
  assertNoSaveSideEffects(harness);
});

test("player moment notifications mark only the matching row across transcript modes", async () => {
  const harness = createSidePanelHandlerHarness();
  const dispatch = (message) => harness.messageListeners.forEach((listener) => listener(message, {}, () => {}));

  dispatch({ action: "playerMomentSaved", youtubeVideoId: "aaaaaaaaaaa", capturedSecond: 36 });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: "36" });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: -1 });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 36.5 });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 604_801 });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 36, extra: true });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 42 });
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 42 });

  vm.runInContext(`
    const markerSegments = getActiveTranscriptSegments();
    markerSegments.forEach((segment, index) => transcriptParagraphCache.set(
      transcriptTranslationCacheKey(segment),
      "English marker row " + index
    ));
    translateTranscript = globalThis.__realTranslateTranscript;
    renderTranscript();
  `, harness.context);
  for (const mode of ["zh", "en", "bilingual", "zh"]) {
    await vm.runInContext(`handleTranscriptModeChange(${JSON.stringify(mode)})`, harness.context);
    const row = harness.document.querySelectorAll(".transcript-entry")[1];
    assert.equal(row.querySelector(".transcript-save-btn").textContent, "Saved");
    assert.equal(row.querySelector(".transcript-save-btn").disabled, true);
    assert.equal(harness.document.querySelectorAll(".transcript-entry")[0].querySelector(".transcript-save-btn").disabled, false);
  }

  vm.runInContext('currentVideoId = "aaaaaaaaaaa"; renderTranscript()', harness.context);
  assert.ok([...harness.document.querySelectorAll(".transcript-save-btn")].every((button) => (
    button.textContent === "Save" && button.disabled === false
  )));
  vm.runInContext(`currentVideoId = ${JSON.stringify(VIDEO_ID)}; renderTranscript()`, harness.context);
  assert.equal(harness.document.querySelectorAll(".transcript-save-btn")[1].textContent, "Saved");
  assertNoSaveSideEffects(harness);
  assert.equal(harness.saveCalls.length, 0);
});

test("player moment row mapping includes its start and excludes the next row start", () => {
  const harness = createSidePanelHandlerHarness();
  const dispatch = (message) => harness.messageListeners.forEach((listener) => listener(message, {}, () => {}));

  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 48 });
  vm.runInContext("renderTranscript()", harness.context);

  const buttons = harness.document.querySelectorAll(".transcript-save-btn");
  assert.equal(buttons[1].textContent, "Save");
  assert.equal(buttons[1].disabled, false);
  assert.equal(buttons[2].textContent, "Saved");
  assert.equal(buttons[2].disabled, true);
  assertNoSaveSideEffects(harness);
});

test("player moment row mapping truncates fractional starts exactly like playback highlighting", () => {
  const harness = createSidePanelHandlerHarness();
  const dispatch = (message) => harness.messageListeners.forEach((listener) => listener(message, {}, () => {}));
  vm.runInContext(`
    currentTranscript = currentTranscript.map((segment) => ({
      ...segment,
      start: segment.start + 0.8,
    }));
  `, harness.context);

  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 42 });
  vm.runInContext("renderTranscript(); autoScrollEnabled = false; highlightActiveEntry(42)", harness.context);

  const rows = harness.document.querySelectorAll(".transcript-entry");
  assert.equal(rows[0].querySelector(".transcript-save-btn").textContent, "Save");
  assert.equal(rows[0].classList.contains("active-playback"), false);
  assert.equal(rows[1].querySelector(".transcript-save-btn").textContent, "Saved");
  assert.equal(rows[1].querySelector(".transcript-save-btn").disabled, true);
  assert.equal(rows[1].classList.contains("active-playback"), true);
  assertNoSaveSideEffects(harness);
});

test("a failed subtitle-row Save retry stays saved after the stale failure reset runs", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      globalThis.__attempts = 0;
      enqueueSavedItem = async (input) => {
        globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
        globalThis.__attempts += 1;
        if (globalThis.__attempts === 1) throw new Error("SAVE_RETRY");
        return { success: true, synced: false };
      };
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
    `,
    harness.context,
  );
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  const saveButton = row.querySelector(".transcript-save-btn");
  const retryButton = harness.document.getElementById("saveRetryBtn");

  await clickAndFlush(harness, saveButton);

  assert.equal(vm.runInContext("__attempts", harness.context), 1);
  assert.equal(saveButton.textContent, "Retry save");
  assert.equal(saveButton.disabled, true);
  assert.equal(retryButton.hidden, false);
  assert.equal(harness.scheduledResets.length, 1);

  await clickAndFlush(harness, retryButton);

  assert.equal(vm.runInContext("__attempts", harness.context), 2);
  assert.equal(harness.scheduledResets.length, 2);
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  for (const reset of harness.scheduledResets) reset.callback();

  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);
  assertNoSaveSideEffects(harness);
});

test("a rejected subtitle-row save does not mark until a successful retry, then survives every mode", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      globalThis.__attempts = 0;
      enqueueSavedItem = async (input) => {
        globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
        globalThis.__attempts += 1;
        if (globalThis.__attempts === 1) throw new Error("rejected");
        return { success: true, synced: false };
      };
      const retrySegments = getActiveTranscriptSegments();
      retrySegments.forEach((segment, index) => transcriptParagraphCache.set(
        transcriptTranslationCacheKey(segment),
        "English retry row " + index
      ));
      translateTranscript = globalThis.__realTranslateTranscript;
      currentTranscriptMode = "zh";
      renderTranscript();
    `,
    harness.context,
  );
  let row = harness.document.querySelectorAll(".transcript-entry")[1];
  const saveButton = row.querySelector(".transcript-save-btn");
  const retryButton = harness.document.getElementById("saveRetryBtn");

  await clickAndFlush(harness, saveButton);
  assert.equal(saveButton.textContent, "Retry save");
  assert.equal(saveButton.disabled, true);
  assert.equal(retryButton.hidden, false);

  for (const mode of ["en", "bilingual", "zh"]) {
    await vm.runInContext(`handleTranscriptModeChange(${JSON.stringify(mode)})`, harness.context);
    row = harness.document.querySelectorAll(".transcript-entry")[1];
    assert.equal(row.querySelector(".transcript-save-btn").textContent, "Save");
    assert.equal(row.querySelector(".transcript-save-btn").disabled, false);
  }

  await clickAndFlush(harness, retryButton);
  for (const mode of ["en", "bilingual", "zh"]) {
    await vm.runInContext(`handleTranscriptModeChange(${JSON.stringify(mode)})`, harness.context);
    row = harness.document.querySelectorAll(".transcript-entry")[1];
    assert.equal(row.querySelector(".transcript-save-btn").textContent, "Saved");
    assert.equal(row.querySelector(".transcript-save-btn").disabled, true);
  }
  assert.equal(vm.runInContext("__attempts", harness.context), 2);
  assertNoSaveSideEffects(harness);
});

test("an admitted player marker stays authoritative over a concurrent row-save failure and reset", async () => {
  const harness = createSidePanelHandlerHarness();
  const dispatch = (message) => harness.messageListeners.forEach((listener) => listener(message, {}, () => {}));
  vm.runInContext(`
    globalThis.__rejectRowSave = null;
    enqueueSavedItem = (input) => {
      globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
      return new Promise((_resolve, reject) => {
        globalThis.__rejectRowSave = () => reject(new Error("rejected"));
      });
    };
    currentTranscriptMode = "zh";
    renderTranscript();
  `, harness.context);
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  const saveButton = row.querySelector(".transcript-save-btn");

  await clickAndFlush(harness, saveButton);
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 42 });
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  vm.runInContext("__rejectRowSave()", harness.context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  assert.equal(harness.scheduledResets.length, 1);
  harness.scheduledResets[0].callback();
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);
  assert.equal(harness.saveCalls.length, 1);
  assertNoSaveSideEffects(harness);
});

test("an admitted player marker stays authoritative when the real row-save retry rejects and resets", async () => {
  const harness = createSidePanelHandlerHarness();
  const dispatch = (message) => harness.messageListeners.forEach((listener) => listener(message, {}, () => {}));
  vm.runInContext(`
    globalThis.__attempts = 0;
    globalThis.__rejectRowRetry = null;
    enqueueSavedItem = (input) => {
      globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
      globalThis.__attempts += 1;
      if (globalThis.__attempts === 1) return Promise.reject(new Error("initial rejection"));
      return new Promise((_resolve, reject) => {
        globalThis.__rejectRowRetry = () => reject(new Error("retry rejection"));
      });
    };
    currentTranscriptMode = "zh";
    renderTranscript();
  `, harness.context);
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  const saveButton = row.querySelector(".transcript-save-btn");
  const retryButton = harness.document.getElementById("saveRetryBtn");

  await clickAndFlush(harness, saveButton);
  assert.equal(saveButton.textContent, "Retry save");
  assert.equal(retryButton.hidden, false);

  await clickAndFlush(harness, retryButton);
  dispatch({ action: "playerMomentSaved", youtubeVideoId: VIDEO_ID, capturedSecond: 42 });
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  vm.runInContext("__rejectRowRetry()", harness.context);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);

  assert.equal(harness.scheduledResets.length, 2);
  for (const reset of harness.scheduledResets) reset.callback();
  assert.equal(saveButton.textContent, "Saved");
  assert.equal(saveButton.disabled, true);
  assert.equal(vm.runInContext("__attempts", harness.context), 2);
  assert.equal(harness.saveCalls.length, 2);
  assertNoSaveSideEffects(harness);
});

test("a row save resolving after navigation marks only the video admitted in its payload", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(`
    globalThis.__resolveRowSave = null;
    enqueueSavedItem = (input) => {
      globalThis.__saveCalls.push(JSON.parse(JSON.stringify(input)));
      return new Promise((resolve) => { globalThis.__resolveRowSave = resolve; });
    };
    currentTranscriptMode = "zh";
    renderTranscript();
  `, harness.context);
  const originalSaveButton = harness.document.querySelectorAll(".transcript-save-btn")[1];

  await clickAndFlush(harness, originalSaveButton);
  vm.runInContext('currentVideoId = "aaaaaaaaaaa"; renderTranscript()', harness.context);
  vm.runInContext('__resolveRowSave({ success: true, synced: false })', harness.context);
  await new Promise((resolve) => setImmediate(resolve));

  assert.ok([...harness.document.querySelectorAll(".transcript-save-btn")].every((button) => (
    button.textContent === "Save" && button.disabled === false
  )));
  vm.runInContext(`currentVideoId = ${JSON.stringify(VIDEO_ID)}; renderTranscript()`, harness.context);
  assert.equal(harness.document.querySelectorAll(".transcript-save-btn")[1].textContent, "Saved");
  assert.equal(harness.document.querySelectorAll(".transcript-save-btn")[1].disabled, true);
  assert.equal(harness.saveCalls.length, 1);
  assert.equal(harness.saveCalls[0].youtubeVideoId, VIDEO_ID);
  assertNoSaveSideEffects(harness);
});

test("the actual bilingual single-line selection Save includes displayed English without changing exact Chinese offsets", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
      setupExplainFeature();
    `,
    harness.context,
  );
  const row = harness.document.querySelectorAll(".transcript-entry")[1];
  const textNode = row.querySelector(".transcript-original").firstChild;
  const range = harness.document.createRange();
  range.setStart(textNode, 2);
  range.setEnd(textNode, 6);
  range.getBoundingClientRect = () => ({
    bottom: 20,
    left: 10,
    width: 40,
  });
  const selection = harness.dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  harness.document.dispatchEvent(
    new harness.dom.window.MouseEvent("mouseup", { bubbles: true }),
  );
  const saveButton = harness.document.querySelector(".selection-save-btn");
  assert.equal(selection.toString(), "太离谱了");

  await clickAndFlush(harness, saveButton);

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
      clientEventId: EVENT_ID,
      youtubeVideoId: VIDEO_ID,
      capturedAt: CAPTURED_AT,
      kind: "subtitle_selection",
      originalChinese: "太离谱了",
      englishTranslation: "That is way too absurd.",
      segmentIds: [SEGMENT_A],
      startSeconds: 42,
      endSeconds: 48,
      startOffset: 2,
      endOffset: 6,
      contextBefore: ["你刚才看到了吗？"],
      contextAfter: ["我完全没想到。"],
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, []);
  assertNoSaveSideEffects(harness);
});

test("the actual bilingual cross-line selection Save joins complete displayed English in stable segment order", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[2]),
        "I never expected that."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
      setupExplainFeature();
    `,
    harness.context,
  );
  const rows = harness.document.querySelectorAll(".transcript-entry");
  const range = harness.document.createRange();
  range.setStart(rows[1].querySelector(".transcript-original").firstChild, 2);
  range.setEnd(rows[2].querySelector(".transcript-original").firstChild, 4);
  range.getBoundingClientRect = () => ({ bottom: 20, left: 10, width: 40 });
  const selection = harness.dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  harness.document.dispatchEvent(
    new harness.dom.window.MouseEvent("mouseup", { bubbles: true }),
  );

  await clickAndFlush(
    harness,
    harness.document.querySelector(".selection-save-btn"),
  );

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
      clientEventId: EVENT_ID,
      youtubeVideoId: VIDEO_ID,
      capturedAt: CAPTURED_AT,
      kind: "subtitle_selection",
      originalChinese: "太离谱了吧。\n我完全没",
      englishTranslation: "That is way too absurd.\nI never expected that.",
      segmentIds: [SEGMENT_A, SEGMENT_B],
      startSeconds: 42,
      endSeconds: 54,
      startOffset: 2,
      endOffset: 13,
      contextBefore: ["你刚才看到了吗？"],
      contextAfter: [],
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, []);
  assertNoSaveSideEffects(harness);
});

test("the actual bilingual cross-line selection Save omits English when any displayed segment translation is missing", async () => {
  const harness = createSidePanelHandlerHarness();
  vm.runInContext(
    `
      currentTranscriptMode = "bilingual";
      const renderedSegments = getActiveTranscriptSegments();
      transcriptParagraphCache.set(
        transcriptTranslationCacheKey(renderedSegments[1]),
        "That is way too absurd."
      );
      renderTranscriptModeRows(renderedSegments, "bilingual");
      setupExplainFeature();
    `,
    harness.context,
  );
  const rows = harness.document.querySelectorAll(".transcript-entry");
  const range = harness.document.createRange();
  range.setStart(rows[1].querySelector(".transcript-original").firstChild, 2);
  range.setEnd(rows[2].querySelector(".transcript-original").firstChild, 4);
  range.getBoundingClientRect = () => ({ bottom: 20, left: 10, width: 40 });
  const selection = harness.dom.window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
  harness.document.dispatchEvent(
    new harness.dom.window.MouseEvent("mouseup", { bubbles: true }),
  );

  await clickAndFlush(
    harness,
    harness.document.querySelector(".selection-save-btn"),
  );

  assert.equal(harness.saveCalls.length, 1);
  assert.equal(harness.saveCalls[0].originalChinese, "太离谱了吧。\n我完全没");
  assert.equal(harness.saveCalls[0].englishTranslation, undefined);
  assert.deepEqual(jsonValue(harness.saveCalls[0].segmentIds), [SEGMENT_A, SEGMENT_B]);
  assertNoSaveSideEffects(harness);
});

test("the actual Key Quote Save click enqueues the exact displayed quote once without following its seek click", async () => {
  const harness = createSidePanelHandlerHarness();
  const quote = {
    quote: "这也太离谱了吧。",
    englishMeaning: "That is way too absurd.",
    timestampSeconds: 44,
    sourceSegmentIds: [SEGMENT_A],
    sourceLineIndex: 999,
  };
  harness.context.renderAnalysisResults({
    overview: "概览",
    chapters: [],
    keyQuotes: [quote],
  });
  const saveButton = harness.document.querySelector(".quote-save-note-btn");
  assert.equal(harness.document.querySelector(".quote-text").textContent, quote.quote);

  await clickAndFlush(harness, saveButton);

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
      clientEventId: EVENT_ID,
      youtubeVideoId: VIDEO_ID,
      capturedAt: CAPTURED_AT,
      kind: "key_quote",
      exactQuote: "这也太离谱了吧。",
      quoteSeconds: 44,
      segmentIds: [SEGMENT_A],
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, []);
  assertNoSaveSideEffects(harness);
});

test("the actual AI Explanation Save click enqueues the exact shown explanation once without another Provider call", async () => {
  const harness = createSidePanelHandlerHarness();
  const evidence = {
    selectedChinese: "太离谱了",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    complete: true,
  };
  vm.runInContext(
    `sendCloudAction = async () => ({
      success: true,
      content: {
        meaning: "Something is absurd.",
        tone: "Informal.",
        communicativeFunction: "Expresses disbelief.",
        contextualFit: "A reaction to an unexpected claim.",
        selectedChinese: "模型不得覆盖的中文",
        sourceLineIndex: 999
      }
    })`,
    harness.context,
  );
  await harness.context.showExplanation(evidence);
  vm.runInContext(
    `sendCloudAction = async (...args) => {
      globalThis.__recordForbiddenCall("provider", args);
      throw new Error("Provider must not run from a save handler");
    }`,
    harness.context,
  );
  const saveButton = harness.document.querySelector(".explanation-save-btn");
  const displayedExplanation = [
    "Meaning: Something is absurd.",
    "Tone: Informal.",
    "Communicative function: Expresses disbelief.",
    "Contextual fit: A reaction to an unexpected claim.",
  ].join("\n\n");
  assert.equal(
    harness.document.querySelector(".explain-text").textContent,
    displayedExplanation.replace(/\n/g, ""),
  );

  await clickAndFlush(harness, saveButton);

  assert.deepEqual(jsonValue(harness.saveCalls), [
    {
      clientEventId: EVENT_ID,
      youtubeVideoId: VIDEO_ID,
      capturedAt: CAPTURED_AT,
      kind: "ai_explanation",
      selectedChinese: "太离谱了",
      englishExplanation: displayedExplanation,
      segmentIds: [SEGMENT_A],
      startSeconds: 42,
      endSeconds: 48,
      contextBefore: ["你刚才看到了吗？"],
      contextAfter: ["我完全没想到。"],
    },
  ]);
  assert.deepEqual(harness.runtimeMessages, []);
  assert.equal(
    harness.forbiddenCalls.filter((call) => call.name === "provider").length,
    0,
    "the AI Explanation Save handler must not call the Provider",
  );
  assertNoSaveSideEffects(harness);
});

test("AI Explanation uses safe model status copy without exposing raw Provider text", async () => {
  const harness = createSidePanelHandlerHarness();
  const evidence = {
    selectedChinese: "太离谱了",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    complete: true,
  };
  vm.runInContext(
    `sendCloudAction = async () => ({
      success: false,
      terminal: true,
      failureCategory: "model_unavailable",
      error: "PRIVATE_PROVIDER_RESPONSE_DO_NOT_DISPLAY"
    })`,
    harness.context,
  );

  await harness.context.showExplanation(evidence);

  const output = harness.document.querySelector(".explain-error");
  assert.match(output.textContent, /model is unavailable/i);
  assert.match(output.textContent, /retry/i);
  assert.doesNotMatch(output.textContent, /PRIVATE_PROVIDER_RESPONSE/);
});

test("AI Explanation hides uncategorized and unknown runtime failure detail", async () => {
  const evidence = {
    selectedChinese: "太离谱了",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    complete: true,
  };
  const fixtures = [
    {
      result: {
        success: false,
        error: "EXPLANATION_MISSING_CATEGORY_SENTINEL",
      },
      sentinel: /EXPLANATION_MISSING_CATEGORY_SENTINEL/,
    },
    {
      result: {
        success: false,
        failureCategory: "future_private_category",
        error: "EXPLANATION_UNKNOWN_CATEGORY_SENTINEL",
      },
      sentinel: /EXPLANATION_UNKNOWN_CATEGORY_SENTINEL/,
    },
  ];

  for (const fixture of fixtures) {
    const harness = createSidePanelHandlerHarness();
    vm.runInContext(
      `sendCloudAction = async () => (${JSON.stringify(fixture.result)})`,
      harness.context,
    );

    await harness.context.showExplanation(evidence);

    const output = harness.document.querySelector(".explain-error").textContent;
    assert.equal(output, "Explanation could not be completed. Retry.");
    assert.doesNotMatch(output, fixture.sentinel);
    assert.ok(output.length <= 80);
  }
});

test("AI Explanation hides thrown runtime detail", async () => {
  const harness = createSidePanelHandlerHarness();
  const evidence = {
    selectedChinese: "太离谱了",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    complete: true,
  };
  vm.runInContext(
    `sendCloudAction = async () => {
      throw new Error("EXPLANATION_THROWN_SENTINEL");
    }`,
    harness.context,
  );

  await harness.context.showExplanation(evidence);

  const output = harness.document.querySelector(".explain-error").textContent;
  assert.equal(output, "Explanation could not be completed. Retry.");
  assert.doesNotMatch(output, /EXPLANATION_THROWN_SENTINEL/);
  assert.ok(output.length <= 80);
});

test("AI Explanation keeps processing distinct from a model failure", async () => {
  const harness = createSidePanelHandlerHarness();
  const evidence = {
    selectedChinese: "太离谱了",
    segmentIds: [SEGMENT_A],
    startSeconds: 42,
    endSeconds: 48,
    complete: true,
  };
  vm.runInContext(
    `sendCloudAction = async () => ({
      success: true,
      pending: true,
      jobId: "explanation-job-42",
      status: "pending"
    })`,
    harness.context,
  );

  await harness.context.showExplanation(evidence);

  const output = harness.document.querySelector(".explain-loading");
  assert.match(output.textContent, /still processing/i);
  assert.match(output.textContent, /Retry/i);
  assert.doesNotMatch(output.textContent, /failed|unavailable/i);
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
  const controller = panel.createSaveController(async (input) => {
    calls.push(input);
    return { status: "queued_locally" };
  });
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
