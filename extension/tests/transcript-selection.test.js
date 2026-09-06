const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const source = fs.readFileSync(
  path.resolve(__dirname, "..", "sidepanel.js"),
  "utf8",
);

test("all timestamped transcript row clicks use the selection-aware seek helper", () => {
  assert.match(
    source,
    /function hasNonCollapsedTextSelection\(\)[\s\S]*?selection\.rangeCount > 0 && !selection\.isCollapsed/,
  );
  assert.match(
    source,
    /function seekFromTranscriptEntryClick\(event, seconds\)[\s\S]*?if \(hasNonCollapsedTextSelection\(\)\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?event\.stopPropagation\(\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?seekTo\(seconds\);/,
  );

  const guardedRowHandlers = source.match(
    /div\.addEventListener\("click", \(event\) =>\s+seekFromTranscriptEntryClick\(event, group\.start\),\s+\);/g,
  );
  assert.equal(
    guardedRowHandlers?.length,
    1,
    "raw transcript rows must use the guard",
  );
  assert.match(
    source,
    /div\.addEventListener\("click", \(event\) =>\s+seekFromTranscriptEntryClick\(event, segment\.start\),\s+\);/,
    "translated-only and bilingual rows must use the guard",
  );
  assert.doesNotMatch(
    source,
    /div\.addEventListener\("click", \(\) => seekTo\(group\.start\)\);/,
  );
});

test("the Explain tooltip preserves selection and contains pointer events", () => {
  assert.match(
    source,
    /tooltip\.addEventListener\("mousedown", \(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);/,
  );
  assert.match(
    source,
    /tooltip\.addEventListener\("mouseup", \(event\) => \{\s+event\.stopPropagation\(\);/,
  );
  assert.match(
    source,
    /\.addEventListener\("click", async \(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);/,
  );
});

test("selection capture retains projected cross-line evidence and never substitutes one active row", () => {
  assert.match(source, /function projectTranscriptSelection\(range, transcriptList\)/);
  assert.match(
    source,
    /function createExplanationMessage\(selectionEvidence, identity, retryId\)/,
  );
  assert.match(source, /selectedEvidence = projectTranscriptSelection\(range, transcriptList\)/);
  assert.match(source, /await showExplanation\(selectedEvidence\)/);
  assert.doesNotMatch(
    source,
    /getActiveTranscriptSegments\(\)\.find\(\(segment\) =>\s+segment\.text\.includes\(selectedText\)/,
  );
  assert.match(source, /div\.dataset\.endSeconds =/);
});

function loadSelectionProjector(document, window) {
  const passiveListener = { addListener() {} };
  const injectedDocument = new Proxy(document, {
    get(target, property) {
      if (property === "addEventListener") return () => {};
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const sandbox = {
    console,
    URL,
    TextDecoder,
    TextEncoder,
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval() {},
    clearInterval() {},
    IntersectionObserver: class {},
    CSS: { escape: (value) => value },
    window,
    document: injectedDocument,
    chrome: {
      runtime: { onMessage: passiveListener, sendMessage: async () => ({}) },
      windows: { getCurrent: async () => ({ id: 1 }) },
      tabs: { onUpdated: passiveListener, onActivated: passiveListener },
    },
    YTD_SETTINGS: {},
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox);
  return sandbox.__YTD_TRANSCRIPT_TESTING__.projectTranscriptSelection;
}

test("bilingual English selection fails closed instead of projecting the whole Chinese row", () => {
  const dom = new JSDOM(`
    <div id="transcriptList">
      <div class="transcript-entry" data-segment-id="${"a".repeat(64)}" data-seconds="10" data-end-seconds="16">
        <span class="transcript-copy">
          <span class="transcript-original">这个表达很自然。</span>
          <span class="transcript-translation">This expression sounds natural.</span>
        </span>
      </div>
    </div>
  `);
  const transcriptList = dom.window.document.getElementById("transcriptList");
  const english = transcriptList.querySelector(".transcript-translation").firstChild;
  const range = dom.window.document.createRange();
  range.setStart(english, 0);
  range.setEnd(english, 15);

  const project = loadSelectionProjector(dom.window.document, dom.window);
  assert.equal(project(range, transcriptList), null);
});

test("native Chinese single-line and cross-line UTF-16 selections remain exact", () => {
  const dom = new JSDOM(`
    <div id="transcriptList">
      <div class="transcript-entry" data-segment-id="${"a".repeat(64)}" data-seconds="10" data-end-seconds="16"><span class="transcript-original">甲乙第一行结尾</span></div>
      <div class="transcript-entry" data-segment-id="${"b".repeat(64)}" data-seconds="18" data-end-seconds="24"><span class="transcript-original">第二行开头丙丁</span></div>
    </div>
  `);
  const transcriptList = dom.window.document.getElementById("transcriptList");
  const native = transcriptList.querySelectorAll(".transcript-original");
  const project = loadSelectionProjector(dom.window.document, dom.window);

  const single = dom.window.document.createRange();
  single.setStart(native[0].firstChild, 2);
  single.setEnd(native[0].firstChild, 5);
  assert.equal(project(single, transcriptList).selectedChinese, "第一行");

  const crossLine = dom.window.document.createRange();
  crossLine.setStart(native[0].firstChild, 2);
  crossLine.setEnd(native[1].firstChild, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(project(crossLine, transcriptList))), {
    selectedChinese: "第一行结尾\n第二行开头",
    segmentIds: ["a".repeat(64), "b".repeat(64)],
    utf16Start: 2,
    utf16End: 13,
    startSeconds: 10,
    endSeconds: 24,
    context: "甲乙第一行结尾\n第二行开头丙丁",
  });
});
