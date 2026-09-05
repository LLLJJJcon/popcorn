const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadSidepanelHelpers({
  sendMessage = () => Promise.resolve({}),
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
  documentImpl,
  windowImpl,
  cryptoImpl = { randomUUID },
} = {}) {
  const listeners = { addListener() {} };
  const injectedDocument = documentImpl
    ? new Proxy(documentImpl, {
      get(target, property) {
        if (property === "addEventListener") return () => {};
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    })
    : null;
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    setInterval() {},
    clearInterval() {},
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
    CSS: { escape: (value) => value },
    crypto: cryptoImpl,
    window: windowImpl || { getSelection: () => null, close() {} },
    document: injectedDocument || {
      addEventListener() {},
      querySelectorAll: () => [],
      querySelector: () => null,
      getElementById: () => null,
      createElement: () => {
        let value = "";
        return {
          set textContent(text) {
            value = String(text);
          },
          get innerHTML() {
            return value
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;")
              .replaceAll('"', "&quot;");
          },
        };
      },
    },
    chrome: {
      runtime: { onMessage: listeners, sendMessage },
      windows: { getCurrent: () => Promise.resolve({ id: 1 }) },
      tabs: { onUpdated: listeners, onActivated: listeners },
    },
    YTD_SETTINGS: {},
  };
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  vm.runInContext(read("sidepanel.js"), context);
  Object.defineProperty(sandbox.__YTD_TRANSCRIPT_TESTING__, "evaluateInSidepanel", {
    value: (source) => vm.runInContext(source, context),
  });
  return sandbox.__YTD_TRANSCRIPT_TESTING__;
}

function loadBackgroundHelpers({
  accessToken = "popcorn-access-token",
  fetchImpl = fetch,
  setTimeoutImpl = () => 0,
  clearTimeoutImpl = () => {},
} = {}) {
  const listeners = { addListener() {} };
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    fetch: fetchImpl,
    AbortController,
    setTimeout: setTimeoutImpl,
    clearTimeout: clearTimeoutImpl,
    importScripts() {},
    chrome: {
      storage: {
        local: {
          setAccessLevel: () => Promise.resolve(),
          get: async () => ({}),
        },
      },
      action: { onClicked: listeners },
      sidePanel: {
        setPanelBehavior() {},
        setOptions: () => Promise.resolve(),
      },
      runtime: {
        onInstalled: listeners,
        onMessage: listeners,
        openOptionsPage() {},
        id: "extension-id",
        getURL: (resourcePath) => `chrome-extension://test/${resourcePath}`,
      },
      tabs: {
        onUpdated: listeners,
        onActivated: listeners,
        get: async () => ({ url: "https://www.youtube.com/watch?v=abc123XYZ00" }),
        query: async () => [],
        sendMessage: async () => ({}),
      },
      scripting: { executeScript: async () => [] },
    },
    YTD_SETTINGS: {
      DEFAULTS: { boundedCachePrefix: "popcorn:test" },
    },
    POPCORN_RUNTIME_CONFIG: { appUrl: "https://app.popcorn.local" },
    POPCORN_AUTH: {
      createAuthClient: () => ({
        initialize: async () => {},
        getAccessToken: async () => accessToken,
      }),
      createAuthMessageHandler: () => async () => ({ ok: true }),
    },
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(read("background.js"), sandbox);
  return sandbox.__POPCORN_CLOUD_TESTING__;
}

test("Transcript header exposes and wires Chinese, English, and bilingual modes", () => {
  const html = read("sidepanel.html");
  const js = read("sidepanel.js");
  assert.match(html, /data-transcript-mode="zh"[\s\S]*?>\u4e2d\u6587</);
  assert.match(html, /data-transcript-mode="en"[\s\S]*?>English</);
  assert.match(html, /data-transcript-mode="bilingual"[\s\S]*?>Bilingual</);
  assert.match(js, /handleTranscriptModeChange\(button\.dataset\.transcriptMode\)/);
  assert.match(js, /action: "translateSegments"/);
  assert.doesNotMatch(js, /English \+ Chinese|Original \(\$\{language\}\)/);
});

test("transcript header places a hidden Retry failed action immediately beside Copy", () => {
  const document = new JSDOM(read("sidepanel.html")).window.document;
  const copy = document.getElementById("copyTranscriptBtn");
  const retry = copy.previousElementSibling;

  assert.equal(retry.id, "retryFailedTranslationsBtn");
  assert.equal(retry.hidden, true);
  assert.match(retry.textContent, /Retry failed/);
});

test("semantic segmentation rebuilds sentences across caption boundaries", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "Caption boundaries should" },
      { start: 2, text: "not break a complete sentence." },
      { start: 5, text: "The next thought also" },
      { start: 7, text: "stays together!" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(
    segments[0].text,
    "Caption boundaries should not break a complete sentence.",
  );
  assert.equal(segments[0].start, 0);
  assert.equal(segments[1].text, "The next thought also stays together!");
  assert.equal(segments[1].start, 5);
});

test("a huge raw Supadata entry is split into seekable bounded segments", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const text = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");
  const segments = groupTranscriptEntries([
    { start: 12, duration: 90, text },
  ]);
  assert.ok(segments.length > 8);
  assert.ok(segments.every((segment) => segment.text.length <= 384));
  assert.equal(segments[0].start, 12);
  assert.ok(segments.at(-1).start > segments[0].start);
  assert.ok(segments.every((segment) => /^segment-\d+-\d+$/.test(segment.id)));
});

test("Chinese sentence and clause punctuation creates semantic guardrails", () => {
  const { groupTranscriptEntries } = loadSidepanelHelpers();
  const segments = groupTranscriptEntries(
    [
      { start: 0, text: "这是一个被字幕切开的" },
      { start: 2, text: "完整句子。这是第二个想法，" },
      { start: 5, text: "也应该保持语义完整！" },
    ],
    { minChars: 1, idealChars: 100, maxChars: 320, maxSeconds: 20 },
  );
  assert.equal(segments.length, 2);
  assert.equal(segments[0].text, "这是一个被字幕切开的完整句子。");
  assert.equal(segments[1].text, "这是第二个想法，也应该保持语义完整！");
});

test("structured translation batches align by stable ID and expose missing fallback", () => {
  const sidepanel = loadSidepanelHelpers();
  const source = [
    { id: "segment-0-0", text: "A complete first sentence." },
    { id: "segment-1-5000", text: "A complete second sentence." },
  ];
  const aligned = sidepanel.alignTranslatedSegmentBatch(
    source,
    [
      { id: "unknown", english: "Ignored" },
      { id: "segment-1-5000", english: "A complete second sentence." },
    ],
  );
  assert.equal(aligned[0].id, source[0].id);
  assert.equal(aligned[0].text, "");
  assert.match(aligned[0].error, /unavailable/i);
  assert.equal(aligned[1].text, "A complete second sentence.");
});

test("structured translation batches reject blank-first duplicate IDs as ambiguous", () => {
  const [aligned] = loadSidepanelHelpers().alignTranslatedSegmentBatch(
    [{ id: "segment-1", text: "Original sentence." }],
    [
      { id: "segment-1", english: " " },
      { id: "segment-1", english: "A later translation." },
    ],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(aligned)), {
    id: "segment-1",
    text: "",
    error: "Translation unavailable.",
  });
});

test("structured translation batches reject malformed-first duplicate IDs as ambiguous", () => {
  const [aligned] = loadSidepanelHelpers().alignTranslatedSegmentBatch(
    [{ id: "segment-1", text: "Original sentence." }],
    [
      { id: "segment-1", english: null },
      { id: "segment-1", english: "A later translation." },
    ],
  );

  assert.deepEqual(JSON.parse(JSON.stringify(aligned)), {
    id: "segment-1",
    text: "",
    error: "Translation unavailable.",
  });
});

test("Retry failed submits more than four failed rows once and maps the one result by stable ID", async () => {
  const ids = ["a", "b", "c", "d", "e"].map((value) => value.repeat(64));
  const dom = new JSDOM(`
    <button id="retryFailedTranslationsBtn" hidden>Retry failed</button>
    <span id="langSpinner"></span>
    <div id="transcriptList">
      ${ids.map((id, index) => `
        <div class="transcript-entry translation-failed" data-segment-id="${id}" data-segment-index="${index}">
          <span class="transcript-copy"><span class="transcript-translation translation-error">Old failure</span></span>
        </div>
      `).join("")}
    </div>
  `);
  const sent = [];
  const helpers = loadSidepanelHelpers({
    documentImpl: dom.window.document,
    windowImpl: dom.window,
    cryptoImpl: { randomUUID: () => "70000000-0000-4000-8000-000000000001" },
    sendMessage(message) {
      sent.push({ ...message });
      const rows = [...dom.window.document.querySelectorAll(".transcript-entry")];
      assert.ok(rows.every((row) => row.classList.contains("translating")));
      assert.equal(dom.window.document.getElementById("retryFailedTranslationsBtn").disabled, true);
      return Promise.resolve({
        success: true,
        content: {
          segments: [...ids].reverse().map((id) => ({ id, english: `English ${id[0]}` })),
        },
      });
    },
  });
  helpers.evaluateInSidepanel(`
    currentVideoId = "abc123XYZ00";
    currentSnapshotId = "40000000-0000-4000-8000-000000000001";
    currentTranscriptMode = "en";
    translationGeneration = 9;
    currentTranscript = ${JSON.stringify(ids.map((id, index) => ({
      stableId: id,
      text: `Chinese ${index}`,
      start: index,
      duration: 1,
    })))};
  `);

  await helpers.retryFailedTranslations();

  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0])), {
    action: "translateSegments",
    videoId: "abc123XYZ00",
    snapshotId: "40000000-0000-4000-8000-000000000001",
    segmentIds: ids,
    retryId: "70000000-0000-4000-8000-000000000001",
  });
  ids.forEach((id) => {
    const row = dom.window.document.querySelector(`[data-segment-id="${id}"]`);
    assert.equal(row.querySelector(".transcript-translation").textContent, `English ${id[0]}`);
    assert.equal(row.classList.contains("translated"), true);
  });
  assert.equal(dom.window.document.getElementById("retryFailedTranslationsBtn").hidden, true);
});

test("Retry failed leaves partial malformed IDs explicit and ignores a stale result", async () => {
  const ids = ["a", "b", "c"].map((value) => value.repeat(64));
  const dom = new JSDOM(`
    <button id="retryFailedTranslationsBtn">Retry failed (3)</button>
    <span id="langSpinner"></span>
    <div id="transcriptList">
      ${ids.map((id, index) => `
        <div class="transcript-entry translation-failed" data-segment-id="${id}" data-segment-index="${index}">
          <span class="transcript-copy"><span class="transcript-translation translation-error">Old failure</span></span>
        </div>
      `).join("")}
    </div>
  `);
  let resolveRequest;
  const helpers = loadSidepanelHelpers({
    documentImpl: dom.window.document,
    windowImpl: dom.window,
    cryptoImpl: { randomUUID: () => "70000000-0000-4000-8000-000000000002" },
    sendMessage: () => new Promise((resolve) => { resolveRequest = resolve; }),
  });
  helpers.evaluateInSidepanel(`
    currentVideoId = "abc123XYZ00";
    currentSnapshotId = "40000000-0000-4000-8000-000000000001";
    currentTranscriptMode = "bilingual";
    translationGeneration = 4;
    currentTranscript = ${JSON.stringify(ids.map((id, index) => ({
      stableId: id,
      text: `Chinese ${index}`,
      start: index,
      duration: 1,
    })))};
  `);

  const retry = helpers.retryFailedTranslations();
  dom.window.document.getElementById("transcriptList").innerHTML = `
    <div class="transcript-entry translated" data-segment-id="${"f".repeat(64)}" data-segment-index="0">
      <span class="transcript-copy"><span class="transcript-translation">New video translation</span></span>
    </div>
  `;
  helpers.evaluateInSidepanel(`
    currentVideoId = "newVideo000";
    currentSnapshotId = "40000000-0000-4000-8000-000000000099";
    currentTranscriptMode = "en";
    translationGeneration += 1;
  `);
  resolveRequest({
    success: true,
    content: {
      segments: [
        { id: ids[0], english: "Old video English" },
        { id: ids[1], english: "First duplicate" },
        { id: ids[1], english: "Second duplicate" },
        { segmentIndex: 2, english: "Positional guess" },
      ],
    },
  });
  await retry;

  const newRow = dom.window.document.querySelector(".transcript-entry");
  assert.equal(newRow.dataset.segmentId, "f".repeat(64));
  assert.equal(newRow.querySelector(".transcript-translation").textContent, "New video translation");

  const aligned = helpers.alignTranslatedSegmentBatch(
    ids.map((id) => ({ id })),
    [
      { id: ids[0], english: "Mapped by ID" },
      { id: ids[1], english: "First duplicate" },
      { id: ids[1], english: "Second duplicate" },
      { segmentIndex: 2, english: "Positional guess" },
    ],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(aligned)), [
    { id: ids[0], text: "Mapped by ID", error: "" },
    { id: ids[1], text: "", error: "Translation unavailable." },
    { id: ids[2], text: "", error: "Translation unavailable." },
  ]);
});

test("a same-video digest refresh clears old retry busy state without letting it clear a new retry", async () => {
  const oldId = "a".repeat(64);
  const freshId = "b".repeat(64);
  const dom = new JSDOM(`
    <div id="welcomeState"></div>
    <div id="loadingState"></div>
    <div id="errorState"></div>
    <div id="resultsState"></div>
    <div id="tabsNav"></div>
    <div id="loadingText"></div>
    <div id="loadingSubtext"></div>
    <button id="followPlaybackBtn"></button>
    <div id="contentArea"><div id="transcriptList">
      <div class="transcript-entry translation-failed" data-segment-id="${oldId}" data-segment-index="0">
        <span class="transcript-copy"><span class="transcript-translation translation-error">Old failure</span></span>
      </div>
    </div></div>
    <button id="retryFailedTranslationsBtn">Retry failed (1)</button>
    <span id="langSpinner"></span>
  `);
  let resolveOldRetry;
  let resolveRefresh;
  let resolveFreshRetry;
  let translationRequests = 0;
  const helpers = loadSidepanelHelpers({
    documentImpl: dom.window.document,
    windowImpl: dom.window,
    cryptoImpl: { randomUUID: () => "70000000-0000-4000-8000-000000000003" },
    sendMessage(message) {
      if (message.action === "fetchTranscript") {
        return new Promise((resolve) => { resolveRefresh = resolve; });
      }
      if (message.action !== "translateSegments") return Promise.resolve({ success: true });
      translationRequests += 1;
      if (translationRequests === 1) {
        return new Promise((resolve) => { resolveOldRetry = resolve; });
      }
      if (translationRequests === 2) {
        return Promise.resolve({ success: false, error: "Fresh failure" });
      }
      return new Promise((resolve) => { resolveFreshRetry = resolve; });
    },
  });
  helpers.evaluateInSidepanel(`
    currentVideoId = "abc123XYZ00";
    currentVideoUrl = "https://www.youtube.com/watch?v=abc123XYZ00";
    currentSnapshotId = "40000000-0000-4000-8000-000000000001";
    currentTranscriptMode = "en";
    translationGeneration = 7;
    currentAnalysis = null;
    currentTranscript = [{ stableId: "${oldId}", text: "Old Chinese.", start: 0, duration: 1 }];
  `);

  const oldRetry = helpers.retryFailedTranslations();
  assert.equal(dom.window.document.getElementById("retryFailedTranslationsBtn").disabled, true);

  const refresh = helpers.evaluateInSidepanel(
    'startDigest("abc123XYZ00", "https://www.youtube.com/watch?v=abc123XYZ00")',
  );
  await Promise.resolve();
  resolveRefresh({
    success: true,
    transcript: [{ stableId: freshId, text: "Fresh Chinese.", start: 0, duration: 1 }],
    transcriptText: "Fresh Chinese.",
    transcriptTextTimestamped: "0:00 Fresh Chinese.",
    language: "zh",
    snapshotId: "40000000-0000-4000-8000-000000000002",
    transcriptHash: "c".repeat(64),
  });
  await refresh;
  await new Promise((resolve) => setImmediate(resolve));

  const button = dom.window.document.getElementById("retryFailedTranslationsBtn");
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Retry failed (1)");

  const freshRetry = helpers.retryFailedTranslations();
  assert.equal(button.disabled, true);
  resolveOldRetry({
    success: true,
    content: { segments: [{ id: oldId, english: "Old result" }] },
  });
  await oldRetry;
  assert.equal(button.disabled, true);

  resolveFreshRetry({
    success: true,
    content: { segments: [{ id: freshId, english: "Fresh result" }] },
  });
  await freshRetry;
  assert.equal(button.hidden, true);
});

test("an individual row retry immediately updates the Retry failed count", () => {
  const firstId = "a".repeat(64);
  const secondId = "b".repeat(64);
  const dom = new JSDOM(`
    <button id="retryFailedTranslationsBtn">Retry failed (2)</button>
    <div id="transcriptList">
      <div class="transcript-entry translation-failed" data-segment-id="${firstId}" data-segment-index="0">
        <span class="transcript-translation translation-error">Old failure</span>
      </div>
      <div class="transcript-entry translation-failed" data-segment-id="${secondId}" data-segment-index="1">
        <span class="transcript-translation translation-error">Other failure</span>
      </div>
    </div>
  `);
  const helpers = loadSidepanelHelpers({ documentImpl: dom.window.document, windowImpl: dom.window });
  helpers.evaluateInSidepanel("translationGeneration = 3; activeTranslationQueue = { enqueue() {} };");

  helpers.retryTranslationSegment(0, 3);

  const button = dom.window.document.getElementById("retryFailedTranslationsBtn");
  assert.equal(button.textContent, "Retry failed (1)");
  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
});

test("English-only omits Chinese while bilingual renders aligned Chinese and English", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const segment = { id: "segment-0-0", text: "原始中文句子。" };
  const translatedOnly = renderTranscriptSegmentContent(
    segment,
    "en",
    "Natural English translation.",
    "",
  );
  const bilingual = renderTranscriptSegmentContent(
    segment,
    "bilingual",
    "Natural English translation.",
    "",
  );
  assert.doesNotMatch(translatedOnly, /原始中文句子/);
  assert.match(translatedOnly, /Natural English translation/);
  assert.match(bilingual, /transcript-original/);
  assert.match(bilingual, /原始中文句子/);
  assert.match(bilingual, /Natural English translation/);
});

test("subtitle formatting tags render in original and translated segment text", () => {
  const { renderTranscriptSegmentContent } = loadSidepanelHelpers();
  const html = renderTranscriptSegmentContent(
    {
      id: "segment-0-0",
      text: "Think <i>deeply</i>, <b>carefully</b>, and <u>clearly</u>.<br>Next line.",
    },
    "bilingual",
    "\u5b57\u5730<i>\u601d\u8003</i>\u7684\u3002<strong>\u91cd\u70b9</strong>",
    "",
  );

  assert.match(html, /Think <i>deeply<\/i>/);
  assert.match(html, /<b>carefully<\/b>/);
  assert.match(html, /<u>clearly<\/u>\.<br>Next line/);
  assert.match(html, /\u5b57\u5730<i>\u601d\u8003<\/i>\u7684\u3002<strong>\u91cd\u70b9<\/strong>/);
});

test("subtitle markup renderer keeps attributed and arbitrary HTML escaped", () => {
  const { renderSubtitleInlineMarkup } = loadSidepanelHelpers();
  const html = renderSubtitleInlineMarkup(
    '<img src=x onerror="alert(1)"><i onclick="alert(2)">unsafe</i><script>alert(3)</script>',
  );

  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;i onclick=&quot;alert\(2\)&quot;&gt;unsafe<\/i>/);
  assert.match(html, /&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<img\b|<i\s+onclick|<script\b/);
});

test("background exposes only fixed Popcorn learning-artifact actions", () => {
  const source = read("background.js");
  const helpers = loadBackgroundHelpers();
  assert.equal(typeof helpers.requestOverview, "function");
  assert.equal(typeof helpers.translateSegments, "function");
  assert.equal(typeof helpers.explainSelection, "function");
  assert.doesNotMatch(source, /requestAiCompletion|callAiTranslation|providerHost|chat\/completions/);
});

test("all AI product requests use authenticated fixed Popcorn routes", async () => {
  const requests = [];
  const helpers = loadBackgroundHelpers({
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return { status: 202, json: async () => ({ ok: true, data: { jobId: "job-1", status: "pending" } }) };
    },
  });
  await helpers.requestOverview({ videoId: "abc123XYZ00", snapshotId: "snapshot-1" });
  await helpers.translateSegments({ videoId: "abc123XYZ00", snapshotId: "snapshot-1", segmentIds: ["segment-1"] });
  await helpers.explainSelection({
    videoId: "abc123XYZ00", snapshotId: "snapshot-1", selectedChinese: "你好",
    segmentIds: ["segment-1"], utf16Start: 0, utf16End: 2,
    startSeconds: 0, endSeconds: 1, context: "你好",
  });
  assert.deepEqual(requests.map(({ url }) => url), [
    "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/overview",
    "https://app.popcorn.local/api/v1/youtube/abc123XYZ00/translations",
    "https://app.popcorn.local/api/v1/explanations",
  ]);
  assert.ok(requests.every(({ options }) => options.headers.Authorization === "Bearer popcorn-access-token"));
});

test("a registration response returns pending without in-process provider polling", async () => {
  let fetches = 0;
  const helpers = loadBackgroundHelpers({ fetchImpl: async () => {
    fetches += 1;
    return { status: 202, json: async () => ({ ok: true, data: { jobId: "job-1", status: "pending" } }) };
  } });
  assert.deepEqual(JSON.parse(JSON.stringify(await helpers.requestOverview({ videoId: "abc123XYZ00", snapshotId: "snapshot-1" }))), {
    success: true, pending: true, jobId: "job-1", status: "pending",
  });
  assert.equal(fetches, 1);
});

test("one status poll is one independent short Popcorn request", async () => {
  const paths = [];
  const helpers = loadBackgroundHelpers({ fetchImpl: async (url) => {
    paths.push(url);
    return { status: 200, json: async () => ({ ok: true, data: { status: "retryable_failed" } }) };
  } });
  assert.deepEqual(await helpers.pollTranscriptJob("job-1"), { status: "retryable_failed" });
  assert.deepEqual(paths, ["https://app.popcorn.local/api/v1/jobs/job-1"]);
});

test("a succeeded transcript job resumes the returned snapshot without starting another transcript job", async () => {
  const paths = [];
  const snapshotId = "40000000-0000-4000-8000-000000000001";
  const helpers = loadBackgroundHelpers({ fetchImpl: async (url) => {
    paths.push(url);
    if (url.endsWith("/api/v1/jobs/job-1")) {
      return {
        status: 200,
        json: async () => ({ ok: true, data: { status: "succeeded", result: { snapshotId } } }),
      };
    }
    return {
      status: 200,
      json: async () => ({
        ok: true,
        data: {
          kind: "ready",
          snapshotId,
          snapshot: {
            language: "zh-CN",
            transcriptHash: "a".repeat(64),
            plainText: "你好",
            timestampedText: "[0:00] 你好",
            segments: [{
              stableId: "b".repeat(64), originalChinese: "你好",
              startSeconds: 0, endSeconds: 1, language: "zh-CN",
            }],
          },
        },
      }),
    };
  } });

  const result = await helpers.handleFetchTranscript("abc123XYZ00", "job-1");

  assert.equal(result.success, true);
  assert.deepEqual(paths, [
    "https://app.popcorn.local/api/v1/jobs/job-1",
    `https://app.popcorn.local/api/v1/youtube/abc123XYZ00/transcript?snapshotId=${snapshotId}`,
  ]);
});

test("a rejected transcript fetch produces a bounded local-service recovery instead of a no-transcript presentation", async () => {
  const background = loadBackgroundHelpers({ fetchImpl: async () => {
    throw new TypeError("fetch failed: ECONNREFUSED 127.0.0.1:3000");
  } });

  const result = await background.handleFetchTranscript("abc123XYZ00");

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: false,
    code: "LOCAL_SERVICE_UNAVAILABLE",
    error: "The local Popcorn service is not running or reachable. Start Popcorn and try again.",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(loadSidepanelHelpers().getTranscriptErrorPresentation(result))), {
    title: "Popcorn service unavailable",
    message: "The local Popcorn service is not running or reachable. Start Popcorn and try again.",
  });
});

test("a native-Chinese transcript server error retains the transcript-specific presentation", async () => {
  const background = loadBackgroundHelpers({ fetchImpl: async () => ({
    status: 422,
    json: async () => ({
      ok: false,
      error: {
        code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
        message: "The provider's English-only response must not be shown.",
        retryable: false,
      },
    }),
  }) });

  const result = await background.handleFetchTranscript("abc123XYZ00");

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: false,
    code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
    error: "No native Chinese transcript is available for this video.",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(loadSidepanelHelpers().getTranscriptErrorPresentation(result))), {
    title: "No transcript found",
    message: "No native Chinese transcript is available for this video.",
  });
});

test("a malformed successful transcript response does not receive local-service guidance", async () => {
  const background = loadBackgroundHelpers({ fetchImpl: async () => ({
    status: 200,
    json: async () => ({ ok: true, data: { kind: "ready" } }),
  }) });

  const result = await background.handleFetchTranscript("abc123XYZ00");

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: false,
    code: "TRANSCRIPT_REQUEST_FAILED",
    error: "The transcript could not be fetched. Please try again.",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(loadSidepanelHelpers().getTranscriptErrorPresentation(result))), {
    title: "Transcript unavailable",
    message: "The transcript could not be fetched. Please try again.",
  });
});

test("a server-supplied local-service code does not receive local-service guidance", async () => {
  const background = loadBackgroundHelpers({ fetchImpl: async () => ({
    status: 503,
    json: async () => ({
      ok: false,
      error: {
        code: "LOCAL_SERVICE_UNAVAILABLE",
        message: "Server-controlled detail must not change the recovery guidance.",
        retryable: true,
      },
    }),
  }) });

  const result = await background.handleFetchTranscript("abc123XYZ00");

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: false,
    code: "TRANSCRIPT_REQUEST_FAILED",
    error: "The transcript could not be fetched. Please try again.",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(loadSidepanelHelpers().getTranscriptErrorPresentation(result))), {
    title: "Transcript unavailable",
    message: "The transcript could not be fetched. Please try again.",
  });
});

test("artifact polling never accepts a Provider URL from the message", async () => {
  const paths = [];
  const helpers = loadBackgroundHelpers({ fetchImpl: async (url) => {
    paths.push(url);
    return { status: 202, json: async () => ({ ok: true, data: { jobId: "job-1", status: "pending" } }) };
  } });
  await helpers.translateSegments({
    videoId: "abc123XYZ00", snapshotId: "snapshot-1", segmentIds: ["segment-1"],
    url: "https://attacker.example", provider: "attacker", apiKey: "secret",
  });
  assert.deepEqual(paths, ["https://app.popcorn.local/api/v1/youtube/abc123XYZ00/translations"]);
});

test("a terminal learning-artifact failure gives a safe model-gateway settings recovery message", async () => {
  const helpers = loadBackgroundHelpers({ fetchImpl: async () => ({
    status: 200,
    json: async () => ({
      ok: true,
      data: {
        status: "failed",
        lastErrorCode: "PRIVATE_PROVIDER_RESPONSE_DO_NOT_DISPLAY",
      },
    }),
  }) });

  const result = await helpers.translateSegments({
    videoId: "abc123XYZ00",
    snapshotId: "snapshot-1",
    segmentIds: ["segment-1"],
    jobId: "translation-job-42",
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: false,
    error: "The learning artifact could not be completed. Check your model gateway settings and retry.",
  });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_PROVIDER_RESPONSE_DO_NOT_DISPLAY/);
});

test("Popcorn API errors expose only bounded public error fields", async () => {
  const helpers = loadBackgroundHelpers({ fetchImpl: async () => ({
    status: 503,
    json: async () => ({ ok: false, error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true } }),
  }) });
  await assert.rejects(
    helpers.requestOverview({ videoId: "abc123XYZ00", snapshotId: "snapshot-1" }),
    (error) => error.code === "PROVIDER_UNAVAILABLE" && error.retryable === true,
  );
});

test("extension background contains no Provider response reader or byte stream parser", () => {
  const source = read("background.js");
  assert.doesNotMatch(source, /readBoundedAiResponse|getReader\(\)|AI_PROVIDER_MAX_RESPONSE_BYTES/);
});

test("translation sends stable IDs once and leaves retry policy to durable jobs", async () => {
  const bodies = [];
  const helpers = loadBackgroundHelpers({ fetchImpl: async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { status: 202, json: async () => ({ ok: true, data: { jobId: "job-1", status: "pending" } }) };
  } });
  await helpers.translateSegments({
    videoId: "abc123XYZ00", snapshotId: "snapshot-1", segmentIds: ["segment-a", "segment-b"],
  });
  assert.deepEqual(bodies, [{ snapshotId: "snapshot-1", segmentIds: ["segment-a", "segment-b"] }]);
});

test("explicit translation retry forwards one UUID identity and no Provider controls", async () => {
  const bodies = [];
  const helpers = loadBackgroundHelpers({ fetchImpl: async (_url, options) => {
    bodies.push(JSON.parse(options.body));
    return { status: 202, json: async () => ({ ok: true, data: { jobId: "job-1", status: "pending" } }) };
  } });
  await helpers.translateSegments({
    videoId: "abc123XYZ00",
    snapshotId: "snapshot-1",
    segmentIds: ["segment-a", "segment-b"],
    retryId: "70000000-0000-4000-8000-000000000001",
    providerUrl: "https://attacker.example",
    apiKey: "secret",
    model: "attacker-model",
  });

  assert.deepEqual(bodies, [{
    snapshotId: "snapshot-1",
    segmentIds: ["segment-a", "segment-b"],
    retryId: "70000000-0000-4000-8000-000000000001",
  }]);
});

test("translation message watchdog rejects, clears its timer, and ignores late replies", async () => {
  let timeoutCallback;
  let timeoutDelay;
  let resolveMessage;
  let clearCount = 0;
  const helpers = loadSidepanelHelpers({
    sendMessage: () =>
      new Promise((resolve) => {
        resolveMessage = resolve;
      }),
    setTimeoutImpl(callback, delay) {
      timeoutCallback = callback;
      timeoutDelay = delay;
      return 73;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 73);
      clearCount += 1;
    },
  });

  const request = helpers.sendTranslationMessage({
    action: "translateContent",
  });
  assert.equal(timeoutDelay, 130_000);
  timeoutCallback();
  await assert.rejects(request, /timed out after 130 seconds.*Retry/i);
  assert.equal(clearCount, 1);

  resolveMessage({ success: true });
  await Promise.resolve();
  assert.equal(clearCount, 1);

  let successTimeoutCallback;
  let successClearCount = 0;
  const successfulHelpers = loadSidepanelHelpers({
    sendMessage: () => Promise.resolve({ success: true }),
    setTimeoutImpl(callback) {
      successTimeoutCallback = callback;
      return 91;
    },
    clearTimeoutImpl(id) {
      assert.equal(id, 91);
      successClearCount += 1;
    },
  });
  assert.deepEqual(
    await successfulHelpers.sendTranslationMessage({
      action: "translateContent",
    }),
    { success: true },
  );
  assert.equal(successClearCount, 1);
  successTimeoutCallback();
  assert.equal(successClearCount, 1);
});

test("translation recovery keeps polling one job until a delayed real result succeeds", async () => {
  const sent = [];
  const responses = [
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    { success: true, pending: true, jobId: "translation-job-42", status: "pending" },
    {
      success: true,
      content: { segments: [{ id: "segment-1", english: "Recovered translation." }] },
    },
  ];
  let nextTimerId = 0;
  const helpers = loadSidepanelHelpers({
    sendMessage(message) {
      sent.push({ ...message });
      return Promise.resolve(responses.shift());
    },
    setTimeoutImpl(callback, delay) {
      const timerId = ++nextTimerId;
      if (delay === 500) Promise.resolve().then(callback);
      return timerId;
    },
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(await helpers.sendTranslationMessage({
      action: "translateSegments",
      videoId: "abc123XYZ00",
      snapshotId: "snapshot-1",
      segmentIds: ["segment-1"],
    }))),
    {
      success: true,
      content: { segments: [{ id: "segment-1", english: "Recovered translation." }] },
    },
  );
  assert.equal(sent.length, 7);
  assert.equal(sent[0].jobId, undefined);
  assert.ok(sent.slice(1).every((message) => message.jobId === "translation-job-42"));
  assert.ok(sent.every((message) => !Object.hasOwn(message, "providerUrl") && !Object.hasOwn(message, "apiKey")));
  assert.equal(nextTimerId, 7);
});

test("an exhausted translation poll window returns a processing state before watchdog timeout", async () => {
  const sent = [];
  const pollDelays = [];
  const watchdogDelays = [];
  const responses = Array.from(
    { length: 241 },
    () => ({ success: true, pending: true, jobId: "translation-job-42", status: "pending" }),
  );
  let nextTimerId = 0;
  const sidepanel = loadSidepanelHelpers({
    sendMessage(message) {
      sent.push({ ...message });
      return Promise.resolve(responses.shift());
    },
    setTimeoutImpl(callback, delay) {
      const timerId = ++nextTimerId;
      if (delay === 500) {
        pollDelays.push(delay);
        Promise.resolve().then(callback);
      } else {
        watchdogDelays.push(delay);
      }
      return timerId;
    },
  });
  const result = await sidepanel.sendTranslationMessage({
    action: "translateSegments",
    videoId: "abc123XYZ00",
    snapshotId: "snapshot-1",
    segmentIds: ["segment-1"],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    success: true,
    pending: true,
    jobId: "translation-job-42",
    status: "pending",
  });
  assert.equal(sent.length, 121);
  assert.ok(sent.slice(1).every((message) => message.jobId === "translation-job-42"));
  assert.deepEqual(pollDelays, Array(120).fill(500));
  assert.deepEqual(watchdogDelays, [130_000]);
  assert.equal(pollDelays.reduce((total, delay) => total + delay, 0), 60_000);

  const segment = { id: "segment-1", text: "仍在处理中。" };
  const [pending] = sidepanel.alignTranslatedSegmentBatch(
    [segment],
    result.content?.segments,
    { pending: result.success && result.pending },
  );
  const html = sidepanel.renderTranscriptSegmentContent(
    segment,
    "en",
    pending.text,
    pending.error,
  );

  assert.match(html, /still processing/i);
  assert.match(html, /Retry/);
  assert.doesNotMatch(html, /Translation unavailable/i);
});

test("a real two-row Range projects exact UTF-16 cross-line explanation evidence", () => {
  const dom = new JSDOM(`
    <div id="transcriptList">
      <div class="transcript-entry" data-segment-id="${"a".repeat(64)}" data-seconds="10" data-end-seconds="16">
        <span class="transcript-time">0:10</span><span class="transcript-text">甲乙第一行结尾</span>
      </div>
      <div class="transcript-entry" data-segment-id="${"b".repeat(64)}" data-seconds="18" data-end-seconds="24">
        <span class="transcript-time">0:18</span><span class="transcript-text">第二行开头丙丁</span>
      </div>
    </div>
  `);
  const helpers = loadSidepanelHelpers({
    documentImpl: dom.window.document,
    windowImpl: dom.window,
  });
  const transcriptList = dom.window.document.getElementById("transcriptList");
  const nativeTexts = transcriptList.querySelectorAll(".transcript-text");
  const range = dom.window.document.createRange();
  range.setStart(nativeTexts[0].firstChild, 2);
  range.setEnd(nativeTexts[1].firstChild, 5);

  const evidence = helpers.projectTranscriptSelection(range, transcriptList);
  assert.deepEqual(JSON.parse(JSON.stringify(evidence)), {
    selectedChinese: "第一行结尾\n第二行开头",
    segmentIds: ["a".repeat(64), "b".repeat(64)],
    utf16Start: 2,
    utf16End: 13,
    startSeconds: 10,
    endSeconds: 24,
    context: "甲乙第一行结尾\n第二行开头丙丁",
  });
});

test("cross-line projection rejects incomplete row evidence instead of guessing", () => {
  const dom = new JSDOM(`
    <div id="transcriptList">
      <div class="transcript-entry" data-segment-id="${"a".repeat(64)}" data-seconds="10" data-end-seconds="16"><span class="transcript-text">第一行</span></div>
      <div class="transcript-entry" data-segment-id="bad" data-seconds="18"><span class="transcript-text">第二行</span></div>
    </div>
  `);
  const helpers = loadSidepanelHelpers({
    documentImpl: dom.window.document,
    windowImpl: dom.window,
  });
  const transcriptList = dom.window.document.getElementById("transcriptList");
  const texts = transcriptList.querySelectorAll(".transcript-text");
  const range = dom.window.document.createRange();
  range.setStart(texts[0].firstChild, 1);
  range.setEnd(texts[1].firstChild, 2);
  assert.equal(helpers.projectTranscriptSelection(range, transcriptList), null);
});

test("translation prompt preserves Chinese-to-English learning direction", () => {
  const prompt = read("prompts/translation.md");
  assert.match(prompt, /Simplified Chinese/i);
  assert.match(prompt, /English/i);
  assert.match(prompt, /stable ID/i);
  assert.doesNotMatch(prompt, /DeepSeek|API key|provider/i);
});
