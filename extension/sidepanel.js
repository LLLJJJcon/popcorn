/**
 * SIDE PANEL LOGIC
 *
 * Handles the pinned YouTube Digest UI adapted for Popcorn cloud learning.
 */

const DEBUG = false;
const debugLog = (...args) => {
  if (DEBUG) console.log(...args);
};

const SAVE_LIMITS = Object.freeze({
  maxSeconds: 604_800,
  maxOffset: 100_000,
  maxSegments: 32,
  maxContextItems: 3,
});
const SAVE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SAVE_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createSaveIdentity() {
  return {
    clientEventId: crypto.randomUUID(),
    capturedAt: new Date().toISOString(),
  };
}

function failSave(message) {
  throw new Error(message);
}

function boundedString(value, name, maximum, { chinese = false, english = false, blank = false } = {}) {
  if (typeof value !== "string" || value.length > maximum) {
    return failSave(`Invalid ${name}`);
  }
  if (!blank && !value.trim()) return failSave(`Invalid ${name}`);
  if (chinese && !/\p{Script=Han}/u.test(value)) return failSave(`Invalid ${name}`);
  if (
    english &&
    (!/[A-Za-z]/.test(value) ||
      [...value].some((character) => {
        const code = character.codePointAt(0);
        return !(
          (code >= 0x09 && code <= 0x0d) ||
          (code >= 0x20 && code <= 0x7e)
        );
      }))
  ) {
    return failSave(`Invalid ${name}`);
  }
  return value;
}

function boundedSecond(value, name) {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > SAVE_LIMITS.maxSeconds
  ) {
    return failSave(`Invalid ${name}`);
  }
  return value;
}

function boundedOffset(value, name) {
  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > SAVE_LIMITS.maxOffset
  ) {
    return failSave(`Invalid ${name}`);
  }
  return value;
}

function stableSegmentIds(value) {
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > SAVE_LIMITS.maxSegments ||
    new Set(value).size !== value.length ||
    value.some(
      (id) =>
        typeof id !== "string" ||
        id.length < 1 ||
        id.length > 200 ||
        id.trim() !== id,
    )
  ) {
    return failSave("Invalid segment IDs");
  }
  return [...value];
}

function boundedContext(value, name) {
  if (
    !Array.isArray(value) ||
    value.length > SAVE_LIMITS.maxContextItems
  ) {
    return failSave(`Invalid ${name}`);
  }
  return value.map((text) =>
    boundedString(text, name, 2_000, { chinese: true }),
  );
}

function saveBase(videoId, identity) {
  if (!SAVE_VIDEO_ID_PATTERN.test(videoId || "")) {
    return failSave("Invalid YouTube video ID");
  }
  if (
    !identity ||
    !SAVE_UUID_PATTERN.test(identity.clientEventId || "") ||
    typeof identity.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(identity.capturedAt))
  ) {
    return failSave("Invalid save identity");
  }
  return {
    clientEventId: identity.clientEventId,
    youtubeVideoId: videoId,
    capturedAt: identity.capturedAt,
  };
}

function optionalEnglish(value, name) {
  return value === undefined || value === null || value === ""
    ? undefined
    : boundedString(value, name, 10_000, { english: true });
}

function buildVideoSaveInput(details, identity = createSaveIdentity()) {
  const base = saveBase(details?.videoId, identity);
  const canonicalUrl = `https://www.youtube.com/watch?v=${details.videoId}`;
  const thumbnailUrl = `https://i.ytimg.com/vi/${details.videoId}/hqdefault.jpg`;
  if (details.url !== undefined) {
    let supplied;
    try {
      supplied = new URL(details.url);
    } catch {
      return failSave("Invalid YouTube URL");
    }
    if (
      supplied.protocol !== "https:" ||
      supplied.hostname !== "www.youtube.com" ||
      supplied.pathname !== "/watch" ||
      supplied.searchParams.get("v") !== details.videoId
    ) {
      return failSave("Invalid YouTube URL");
    }
  }
  if (
    details.thumbnailUrl !== undefined &&
    details.thumbnailUrl !== thumbnailUrl
  ) {
    return failSave("Invalid YouTube thumbnail");
  }
  return {
    ...base,
    kind: "video",
    canonicalUrl,
    title: boundedString(details.title, "title", 300),
    channel: boundedString(details.channelName, "channel", 200),
    thumbnailUrl,
    durationSeconds: boundedSecond(Number(details.duration), "duration"),
    description: boundedString(details.description || "", "description", 5_000, {
      blank: true,
    }),
    currentTimeSeconds: boundedSecond(
      Number(details.currentTime),
      "current time",
    ),
    requestNativeSnapshot: true,
  };
}

function buildSubtitleRowSaveInput(values, identity = createSaveIdentity()) {
  const { segment } = values || {};
  const startSeconds = boundedSecond(Number(segment?.start), "start time");
  const endSeconds = boundedSecond(Number(segment?.end), "end time");
  if (endSeconds < startSeconds) return failSave("Invalid segment time range");
  const englishTranslation = optionalEnglish(
    values.englishTranslation,
    "English translation",
  );
  return {
    ...saveBase(values.videoId, identity),
    kind: "subtitle_row",
    segmentId: stableSegmentIds([segment?.id])[0],
    originalChinese: boundedString(segment?.text, "Chinese subtitle", 10_000, {
      chinese: true,
    }),
    ...(englishTranslation ? { englishTranslation } : {}),
    startSeconds,
    endSeconds,
    contextBefore: boundedContext(values.contextBefore, "context before"),
    contextAfter: boundedContext(values.contextAfter, "context after"),
  };
}

function assertCompleteSelection(evidence) {
  if (!evidence || evidence.complete === false) {
    return failSave("Incomplete selection evidence");
  }
  const start = boundedOffset(evidence.utf16Start, "selection start");
  const end = boundedOffset(evidence.utf16End, "selection end");
  const context = boundedString(evidence.context, "selection context", 16_000, {
    chinese: true,
  });
  const selected = boundedString(
    evidence.selectedChinese,
    "selected Chinese",
    2_000,
    { chinese: true },
  );
  if (end <= start || context.slice(start, end) !== selected) {
    return failSave("Incomplete selection evidence");
  }
  const ids = stableSegmentIds(evidence.segmentIds);
  if (selected.includes("\n") && ids.length < 2) {
    return failSave("Incomplete cross-line evidence");
  }
  return { start, end, selected, ids };
}

function buildSubtitleSelectionSaveInput(
  values,
  identity = createSaveIdentity(),
) {
  const projected = assertCompleteSelection(values?.evidence);
  const startSeconds = boundedSecond(
    Number(values.evidence.startSeconds),
    "start time",
  );
  const endSeconds = boundedSecond(
    Number(values.evidence.endSeconds),
    "end time",
  );
  if (endSeconds < startSeconds) return failSave("Invalid selection time range");
  const englishTranslation = optionalEnglish(
    values.englishTranslation,
    "English translation",
  );
  return {
    ...saveBase(values.videoId, identity),
    kind: "subtitle_selection",
    originalChinese: projected.selected,
    ...(englishTranslation ? { englishTranslation } : {}),
    segmentIds: projected.ids,
    startSeconds,
    endSeconds,
    startOffset: projected.start,
    endOffset: projected.end,
    contextBefore: boundedContext(values.contextBefore, "context before"),
    contextAfter: boundedContext(values.contextAfter, "context after"),
  };
}

function buildKeyQuoteSaveInput(values, identity = createSaveIdentity()) {
  return {
    ...saveBase(values?.videoId, identity),
    kind: "key_quote",
    exactQuote: boundedString(values?.quote?.quote, "key quote", 10_000, {
      chinese: true,
    }),
    quoteSeconds: boundedSecond(
      Number(values?.quote?.timestampSeconds),
      "quote time",
    ),
    segmentIds: stableSegmentIds(values?.quote?.sourceSegmentIds),
  };
}

function buildAiExplanationSaveInput(values, identity = createSaveIdentity()) {
  const evidence = values?.evidence;
  if (!evidence || evidence.complete === false) {
    return failSave("Incomplete explanation evidence");
  }
  const startSeconds = boundedSecond(Number(evidence.startSeconds), "start time");
  const endSeconds = boundedSecond(Number(evidence.endSeconds), "end time");
  if (endSeconds < startSeconds) return failSave("Invalid explanation time range");
  return {
    ...saveBase(values.videoId, identity),
    kind: "ai_explanation",
    selectedChinese: boundedString(
      evidence.selectedChinese,
      "selected Chinese",
      10_000,
      { chinese: true },
    ),
    englishExplanation: boundedString(
      values.englishExplanation,
      "English explanation",
      10_000,
      { english: true },
    ),
    segmentIds: stableSegmentIds(evidence.segmentIds),
    startSeconds,
    endSeconds,
    contextBefore: boundedContext(values.contextBefore, "context before"),
    contextAfter: boundedContext(values.contextAfter, "context after"),
  };
}

const EXACT_SAVE_KEYS = Object.freeze({
  video: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "canonicalUrl", "title", "channel", "thumbnailUrl", "durationSeconds", "description", "currentTimeSeconds", "requestNativeSnapshot"],
  player_moment: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "capturedSecond"],
  subtitle_row: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "segmentId", "originalChinese", "englishTranslation", "startSeconds", "endSeconds", "contextBefore", "contextAfter"],
  subtitle_selection: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "originalChinese", "englishTranslation", "segmentIds", "startSeconds", "endSeconds", "startOffset", "endOffset", "contextBefore", "contextAfter"],
  key_quote: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "exactQuote", "quoteSeconds", "segmentIds"],
  ai_explanation: ["clientEventId", "youtubeVideoId", "capturedAt", "kind", "selectedChinese", "englishExplanation", "segmentIds", "startSeconds", "endSeconds", "contextBefore", "contextAfter"],
});

function assertExactSavedItemInput(input) {
  const allowed = EXACT_SAVE_KEYS[input?.kind];
  if (!allowed) return failSave("Unsupported save kind");
  const expected = new Set(allowed);
  const keys = Object.keys(input);
  if (keys.some((key) => !expected.has(key))) return failSave("Unexpected save field");
  const required = allowed.filter((key) => key !== "englishTranslation");
  if (required.some((key) => !(key in input))) return failSave("Missing save field");
  saveBase(input.youtubeVideoId, input);
  return input;
}

function createSaveController(enqueueSavedItem) {
  if (typeof enqueueSavedItem !== "function") return failSave("Queue unavailable");
  return {
    async save(input) {
      assertExactSavedItemInput(input);
      return enqueueSavedItem(input);
    },
  };
}

async function enqueueSavedItem(input) {
  const response = await chrome.runtime.sendMessage({
    action: "enqueueSavedItem",
    input,
  });
  if (!response?.success) {
    throw new Error(response?.code || response?.error || "SAVE_RETRY");
  }
  return response;
}

const saveController = createSaveController((input) => enqueueSavedItem(input));

// ============================================================
// STATE
// ============================================================

let currentVideoId = null;
let currentVideoUrl = null;
let currentAnalysis = null;
let currentTranscript = null;
let currentTranscriptText = null; // Plain text (for display/export)
let currentTranscriptTimestamped = null; // With timestamps for AI analysis
let currentTranscriptLanguage = null;
let currentSnapshotId = null;
let currentTranscriptHash = null;
let currentVideoTitle = "";
let currentChannelName = "";
let currentVideoDescription = "";
let currentVideoDuration = 0;
let isAnalysisLoading = false; // Track if analysis is in progress
let overviewRetryAvailable = false;
let overviewGeneration = 0;
let overviewRequest = null;
const OVERVIEW_PROGRESS_COPY = "Generating overview — this can take about two minutes.";
const OVERVIEW_RESUME_STORAGE_KEY = "popcorn:overview-resume:v1";
const OVERVIEW_RESUME_FIELDS = new Set(["videoId", "snapshotId", "retryId", "jobId"]);
let youtubeTabId = null; // Store the YouTube tab ID for reliable messaging
let errorAction = null;
let savedLibrarySummaries = [];
let savedLibraryShowAll = false;
let savedLibraryLoadGeneration = 0;

// --- Translation state ---
// Native Chinese is immediate; English is requested only when explicitly shown.
let currentTranscriptMode = "zh";
let translationGeneration = 0; // Invalidates responses from older UI modes/videos.
let translationWorkCount = 0;
let retryFailedTranslationsInFlight = false;
let retryFailedTranslationsCount = 0;
let transcriptScrollObserver = null;
// Stable keys include the video, source mode, language, and semantic segment ID.
let transcriptParagraphCache = new Map();
const TRANSLATION_MESSAGE_TIMEOUT_MS = 130_000;
const TRANSLATION_POLL_INTERVAL_MS = 500;
const TRANSLATION_POLLING_WINDOW_MS = 60_000;

/**
 * Prevent a stopped service worker or dead message channel from leaving the
 * transcript queue stuck forever. The underlying Chrome message cannot be
 * cancelled, so settled guards deliberately ignore any late response.
 */
function sendTranslationMessage(message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      callback(value);
    };

    timeoutId = setTimeout(() => {
      finish(
        reject,
        new Error(
          "Translation request timed out after 130 seconds. Please Retry.",
        ),
      );
    }, TRANSLATION_MESSAGE_TIMEOUT_MS);

    let messagePromise;
    try {
      messagePromise = sendCloudAction(message);
    } catch (error) {
      finish(reject, error);
      return;
    }

    Promise.resolve(messagePromise).then(
      (result) => finish(resolve, result),
      (error) => finish(reject, error),
    );
  });
}

async function sendCloudAction(
  message,
  maxPolls = Math.floor(TRANSLATION_POLLING_WINDOW_MS / TRANSLATION_POLL_INTERVAL_MS),
  onPending,
) {
  let result = await chrome.runtime.sendMessage(message);
  const jobId = result?.jobId;
  if (result?.success && result.pending && jobId && onPending) {
    await onPending(jobId);
  }
  for (let poll = 0; result?.success && result.pending && jobId && poll < maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, TRANSLATION_POLL_INTERVAL_MS));
    result = await chrome.runtime.sendMessage({ ...message, jobId });
    if (result?.success && result.pending && onPending) {
      await onPending(result.jobId || jobId);
    }
  }
  return result;
}

const LEARNING_ARTIFACT_FAILURE_COPY = Object.freeze({
  model_output: "The model response could not be read. Retry this learning artifact.",
  model_unavailable: "The model is unavailable right now. Check your model gateway and retry.",
  internal: "Popcorn could not finish this learning artifact. Retry.",
});

function learningArtifactStatusCopy(result, artifactName) {
  if (result?.pending) {
    return `${artifactName} is still processing. Please Retry shortly.`;
  }
  if (Object.hasOwn(LEARNING_ARTIFACT_FAILURE_COPY, result?.failureCategory)) {
    return LEARNING_ARTIFACT_FAILURE_COPY[result.failureCategory];
  }
  return typeof result?.error === "string" && result.error.trim()
    ? result.error.trim()
    : `${artifactName} could not be completed. Retry.`;
}

// --- Auto-scroll state (follow video playback in transcript) ---
let autoScrollEnabled = true; // True = scroll transcript to follow video playback
let autoScrollInterval = null; // setInterval ID for polling video time
let lastAutoScrollTime = 0; // Timestamp of last programmatic scroll (ignores scroll events within 1s)

// ============================================================
// TRANSCRIPT GROUPING
// ============================================================

const TRANSCRIPT_SEGMENT_LIMITS = Object.freeze({
  minChars: 60,
  idealChars: 180,
  maxChars: 320,
  maxSeconds: 20,
});

function normalizeCaptionText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/g, "$1$2")
    .replace(/([，。；：！？])\s+(?=[\u3400-\u9fff])/g, "$1")
    .replace(/\s+([,.;:!?，。；：！？])/g, "$1")
    .trim();
}

/**
 * Splits a single oversized thought at the strongest nearby punctuation.
 * Word boundaries are the final safety valve for captions with no punctuation.
 */
function splitOversizedThought(text, maxChars) {
  const parts = [];
  let rest = normalizeCaptionText(text);

  while (rest.length > maxChars) {
    const windowText = rest.slice(0, maxChars + 1);
    const lowerBound = Math.floor(maxChars * 0.55);
    let cut = -1;

    for (const pattern of [/[;:；：]\s*/g, /[,，]\s*/g, /\s/g]) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(windowText))) {
        if (match.index >= lowerBound) cut = match.index + match[0].length;
      }
      if (cut > 0) break;
    }

    if (cut <= 0) cut = maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  if (rest) parts.push(rest);
  return parts;
}

/**
 * Reconstructs complete sentences across raw caption boundaries. Each segment
 * keeps the timestamp of the first caption that contributed text. Character
 * and time limits prevent a malformed Supadata entry from becoming one giant
 * row while punctuation remains the preferred boundary.
 */
function groupTranscriptEntries(entries, limits = TRANSCRIPT_SEGMENT_LIMITS) {
  if (Array.isArray(entries) && entries.length > 0 && entries.every((entry) =>
    typeof (entry.stableId || entry.id) === "string" &&
    /^[a-f0-9]{64}$/.test(entry.stableId || entry.id))) {
    return entries.map((entry) => ({
      id: entry.stableId || entry.id,
      sourceStableIds: [entry.stableId || entry.id],
      start: Number(entry.start) || 0,
      end:
        (Number(entry.start) || 0) + Math.max(0, Number(entry.duration) || 0),
      text: normalizeCaptionText(entry.text),
      texts: [normalizeCaptionText(entry.text)],
    }));
  }
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const pieces = [];
  entries.forEach((entry, entryIndex) => {
    const text = normalizeCaptionText(entry?.text);
    if (!text) return;
    const start = Number.isFinite(Number(entry.start)) ? Number(entry.start) : 0;
    const duration = Math.max(0, Number(entry.duration) || 0);
    const sentenceParts =
      text.match(/[^.!?;:,。！？；：，]+(?:[.!?;:,。！？；：，]+["')\]”’）】」』]*|$)/g) ||
      [text];
    let consumedChars = 0;

    sentenceParts.forEach((sentencePart) => {
      const cleanPart = normalizeCaptionText(sentencePart);
      if (!cleanPart) return;
      const oversizedParts = splitOversizedThought(cleanPart, limits.maxChars);
      oversizedParts.forEach((part, partIndex) => {
        const ratio = text.length ? Math.min(1, consumedChars / text.length) : 0;
        pieces.push({
          text: part,
          start: start + duration * ratio,
          semanticEnd:
            /[.!?。！？]["')\]”’）】」』]*$/.test(part) ||
            oversizedParts.length > 1,
          clauseEnd: /[;:,；：，]["')\]”’）】」』]*$/.test(part),
          sourceOrder: `${entryIndex}:${partIndex}`,
        });
        consumedChars += part.length + 1;
      });
    });
  });

  const grouped = [];
  let current = null;

  const flush = () => {
    if (!current || !current.text.trim()) return;
    const index = grouped.length;
    const text = normalizeCaptionText(current.text);
    grouped.push({
      id: `segment-${index}-${Math.round(current.start * 1000)}`,
      start: current.start,
      text,
      texts: [text],
    });
    current = null;
  };

  pieces.forEach((piece) => {
    if (!current) current = { start: piece.start, text: "" };
    current.text = normalizeCaptionText(`${current.text} ${piece.text}`);
    const elapsed = Math.max(0, piece.start - current.start);
    const comfortablySized = current.text.length >= limits.minChars;
    const reachedIdeal = current.text.length >= limits.idealChars;
    const atNaturalBoundary =
      piece.semanticEnd ||
      (piece.clauseEnd &&
        (reachedIdeal ||
          current.text.length >= limits.maxChars ||
          elapsed >= limits.maxSeconds));
    const reachedGuardrail =
      atNaturalBoundary &&
      (current.text.length >= limits.maxChars || elapsed >= limits.maxSeconds);
    const reachedHardGuardrail =
      current.text.length >= Math.round(limits.maxChars * 1.2) ||
      elapsed >= limits.maxSeconds + 5;

    if (
      (atNaturalBoundary && (comfortablySized || elapsed >= 8)) ||
      (atNaturalBoundary && reachedIdeal) ||
      reachedGuardrail ||
      reachedHardGuardrail
    ) {
      flush();
    }
  });
  flush();

  return grouped;
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await evictOldCacheEntries(20);
  await checkCurrentTab();
});

// Listen for messages from the Digest button on YouTube page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === "playerMomentSaved") {
    if (
      Object.keys(message).length !== 3 ||
      typeof message.youtubeVideoId !== "string" ||
      !SAVE_VIDEO_ID_PATTERN.test(message.youtubeVideoId) ||
      !Number.isInteger(message.capturedSecond) ||
      message.capturedSecond < 0 ||
      message.capturedSecond > SAVE_LIMITS.maxSeconds ||
      message.youtubeVideoId !== currentVideoId
    ) {
      return false;
    }
    recordSavedTranscriptMarker({
      videoId: message.youtubeVideoId,
      capturedSecond: message.capturedSecond,
    });
    updateTranscriptSavedButtons();
    return false;
  }
  if (message.action === "startDigestFromButton") {
    // Load the digest for the current video. Served from cache when we've
    // seen this video before (no API calls); fetched fresh otherwise.
    // (This used to force-clear the cache on every click, which silently
    // burned a transcript credit + analysis tokens per click.)
    checkCurrentTab();
    sendResponse({ success: true });
  }
  if (message.action === "transcriptProgress") {
    // Background is telling us the transcript fetch status changed
    updateLoading(message.title, message.subtitle);
    sendResponse({ success: true });
  }
  return false;
});

// ============================================================
// FOLLOW THE ACTIVE TAB
// ============================================================
// The panel watches which tab is in front of it and reacts:
//   - Front tab is NOT YouTube  -> the panel closes itself (window.close()).
//     We do this OURSELVES rather than relying only on the background
//     script's per-tab enable/disable, because Chrome doesn't reliably
//     apply per-tab panel state to tabs spawned in unusual ways (e.g. a
//     link opened from another app) — which let the panel linger on
//     non-YouTube pages.
//   - Front tab IS YouTube but on a different video -> refresh the digest.
//     YouTube is a single-page app (clicking a video swaps content without
//     a reload), so we track URL changes; startDigest() caches per video,
//     making re-checks instant and free for already-digested videos.
//
// Everything is scoped to the window this panel lives in: tab switches in
// OTHER browser windows must not close this panel or hijack its content.

let navigationRefreshTimer = null;
let panelWindowId = null;
chrome.windows.getCurrent().then((w) => {
  panelWindowId = w.id;
});

function scheduleDigestRefresh() {
  // Small delay lets YouTube finish rendering the new video's title and
  // description before we read them. Also collapses rapid-fire URL events
  // into a single refresh.
  clearTimeout(navigationRefreshTimer);
  navigationRefreshTimer = setTimeout(() => {
    checkCurrentTab();
  }, 600);
}

function panelIsShowingResults() {
  const results = document.getElementById("resultsState");
  return results && results.style.display !== "none";
}

/**
 * Reacts to the URL now in front of the panel: close on non-YouTube,
 * refresh the digest when the video changed.
 */
function handleFrontTabUrl(url) {
  if (!(url || "").startsWith("https://www.youtube.com")) {
    // Panel is a YouTube-only tool — remove itself from non-YouTube tabs.
    window.close();
    return;
  }

  const newVideoId = extractVideoId(url);
  // Refresh when the video changed, or when we're not currently showing
  // results (e.g. user went home, then clicked back into the same video).
  if (newVideoId !== currentVideoId || !panelIsShowingResults()) {
    scheduleDigestRefresh();
  }
}

// Fires when a tab's URL changes — including YouTube's no-reload navigation.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url || !tab.active) return;
  if (panelWindowId !== null && tab.windowId !== panelWindowId) return;
  handleFrontTabUrl(changeInfo.url);
});

// Fires when a different tab comes to the front — switching tabs, or a new
// tab being opened (including ones opened by clicking links in other apps).
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  if (panelWindowId !== null && windowId !== panelWindowId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    // Brand-new tabs may not have committed their URL yet — fall back to
    // the pending one so we judge where the tab is actually going.
    handleFrontTabUrl(tab.url || tab.pendingUrl || "");
  } catch (e) {
    // Tab closed before we could read it — nothing to do.
  }
});

function saveSuccessLabel(result) {
  if (result?.code === "AUTH_REQUIRED" && result?.pending) {
    return "Saved locally; sign in to retry";
  }
  return result?.synced ? "Saved to Popcorn" : "Saved locally";
}

const SAVE_STATUS_COPY = Object.freeze({
  saving: "Saving this learning moment…",
  saved: "Saved locally. Queued to sync.",
  retrying: "Saved locally. Popcorn is temporarily unavailable; queued and retrying automatically.",
  "sign-in-required": "Saved locally. Your save stays queued; sign in to retry.",
  organizing: "Saved to Popcorn. Organizing your learning material…",
  "save-failed": "This save was not completed. Try again when Popcorn is ready.",
  unsupported: "Popcorn works only with the YouTube video you are currently watching.",
});

function savedRawText(input) {
  for (const key of ["originalChinese", "selectedChinese", "exactQuote", "title"]) {
    if (typeof input?.[key] === "string" && input[key].trim()) return input[key];
  }
  return "";
}

function createSaveStatusPresenter(doc, appUrl = "") {
  const surface = doc?.getElementById("saveStatus");
  const message = doc?.getElementById("saveStatusMessage");
  const raw = doc?.getElementById("saveRawText");
  const retryButton = doc?.getElementById("saveRetryBtn");
  const recoveryLink = doc?.getElementById("saveRecoveryLink");
  let retryAction = null;

  recoveryLink?.addEventListener("click", (event) => {
    if (recoveryLink.dataset.action !== "openOptions") return;
    event.preventDefault();
    void chrome.runtime.sendMessage({ action: "openOptions" });
  });

  retryButton?.addEventListener("click", async () => {
    if (!retryAction) return;
    const action = retryAction;
    retryButton.disabled = true;
    try {
      await action();
    } catch (_error) {
      // The retry action restores the fixed failed state without exposing details.
    } finally {
      retryButton.disabled = false;
    }
  });

  function show({ state, rawText = "", retry = null }) {
    if (!surface || !message || !(state in SAVE_STATUS_COPY)) return;
    surface.hidden = false;
    surface.dataset.state = state;
    message.textContent = SAVE_STATUS_COPY[state];
    retryAction = typeof retry === "function" ? retry : null;

    if (raw) {
      const showsRawText = state === "retrying" && Boolean(rawText);
      raw.hidden = !showsRawText;
      raw.textContent = showsRawText ? rawText : "";
    }
    if (retryButton) {
      retryButton.hidden = !["retrying", "save-failed"].includes(state) || !retryAction;
    }
    if (recoveryLink) {
      recoveryLink.hidden = true;
      recoveryLink.removeAttribute("href");
      recoveryLink.removeAttribute("data-action");
      recoveryLink.textContent = "Open Saved in Popcorn";
      if (state === "retrying" && appUrl) {
        try {
          recoveryLink.href = new URL("/saved", appUrl).href;
          recoveryLink.hidden = false;
        } catch (_error) {
          // Invalid build-time public configuration leaves the link absent.
        }
      } else if (state === "sign-in-required") {
        recoveryLink.href = "#extension-connection";
        recoveryLink.dataset.action = "openOptions";
        recoveryLink.textContent = "Sign in to sync";
        recoveryLink.hidden = false;
      }
    }
  }

  return { show };
}

function saveStateForResult(result) {
  if (result?.code === "AUTH_REQUIRED" && result?.pending) {
    return "sign-in-required";
  }
  if (result?.code === "SYNC_RETRYING" && result?.pending) return "retrying";
  if (result?.synced) return "organizing";
  return "saved";
}

const saveStatusPresenter = createSaveStatusPresenter(
  document,
  globalThis.POPCORN_RUNTIME_CONFIG?.appUrl || "",
);

async function saveWithFeedback({
  input,
  button,
  idleLabel = "Save",
  save,
  presenter,
  scheduleReset = setTimeout,
  persistentSuccess = false,
  resetGuard = { generation: 0 },
  reconcilePersistentState = null,
}) {
  if (!button) return save(input);
  const generation = ++resetGuard.generation;
  button.disabled = true;
  button.textContent = "Saving…";
  presenter.show({ state: "saving" });
  const retry = () => saveWithFeedback({
    input,
    button,
    idleLabel,
    save,
    presenter,
    scheduleReset,
    persistentSuccess,
    resetGuard,
    reconcilePersistentState,
  });
  let succeeded = false;
  try {
    const result = await save(input);
    succeeded = true;
    const state = saveStateForResult(result);
    button.textContent = persistentSuccess ? "Saved" : saveSuccessLabel(result);
    presenter.show({
      state,
      rawText: savedRawText(input),
      retry: state === "retrying" ? retry : null,
    });
    return result;
  } catch (error) {
    button.textContent = "Retry save";
    presenter.show({ state: "save-failed", retry });
    if (typeof reconcilePersistentState === "function") {
      reconcilePersistentState();
    }
    throw error;
  } finally {
    scheduleReset(() => {
      if (resetGuard.generation !== generation) return;
      if (!(persistentSuccess && succeeded)) {
        button.textContent = idleLabel;
        button.disabled = false;
      }
      if (typeof reconcilePersistentState === "function") {
        reconcilePersistentState();
      }
    }, 1800);
  }
}

async function saveWithButton(
  input,
  button,
  idleLabel = "Save",
  {
    persistentSuccess = false,
    onSuccess = null,
    reconcilePersistentState = null,
  } = {},
) {
  return saveWithFeedback({
    input,
    button,
    idleLabel,
    save: async (savedInput) => {
      const result = await saveController.save(savedInput);
      if (result?.success === true && typeof onSuccess === "function") {
        await onSuccess(savedInput, result);
      }
      return result;
    },
    presenter: saveStatusPresenter,
    persistentSuccess,
    reconcilePersistentState,
  });
}

function showUnsupportedYouTube() {
  showState("welcome");
  const title = document.getElementById("welcomeTitle");
  const description = document.getElementById("welcomeDescription");
  if (title) title.textContent = "Open a YouTube video";
  if (description) {
    description.textContent = "Popcorn supports the video on a youtube.com/watch page. Open one to continue.";
  }
  saveStatusPresenter.show({ state: "unsupported" });
}

async function saveCurrentVideo(button) {
  if (!currentVideoId) return;
  const playback = await chrome.runtime.sendMessage({
    action: "relayToContent",
    payload: { action: "getCurrentTime" },
  });
  if (!playback?.success || !playback.response) {
    throw new Error("Player unavailable");
  }
  const input = buildVideoSaveInput({
    videoId: currentVideoId,
    url: currentVideoUrl,
    title: currentVideoTitle,
    channelName: currentChannelName,
    duration: currentVideoDuration,
    description: currentVideoDescription,
    currentTime: Number(playback.response.currentTime),
  });
  return saveWithButton(input, button, "Save Video");
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // Error retry
  document.getElementById("errorBtn").addEventListener("click", () => {
    if (errorAction) {
      errorAction();
      return;
    }
    if (currentVideoId) {
      startDigest(currentVideoId, currentVideoUrl);
    }
  });

  document.getElementById("settingsBtn")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "openPopcorn" });
  });
  document.getElementById("saveVideoBtn")?.addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      await saveCurrentVideo(event.currentTarget);
    } catch (error) {
      console.error("[Popcorn] Save Video failed:", error);
    }
  });

  // Transcript actions
  document
    .getElementById("copyTranscriptBtn")
    ?.addEventListener("click", copyTranscript);
  document
    .getElementById("retryFailedTranslationsBtn")
    ?.addEventListener("click", retryFailedTranslations);
  document
    .getElementById("retryOverviewBtn")
    ?.addEventListener("click", retryOverview);
  document.querySelectorAll(".transcript-mode-btn").forEach((button) => {
    button.addEventListener("click", () => {
      handleTranscriptModeChange(button.dataset.transcriptMode);
    });
  });

  // Follow playback button — re-enables auto-scroll after user scrolled away
  document
    .getElementById("followPlaybackBtn")
    ?.addEventListener("click", () => {
      autoScrollEnabled = true;
      document.getElementById("followPlaybackBtn").style.display = "none";
      // Jump straight back to the line currently being spoken. We scroll
      // directly (not via playbackTrackingTick) because the tick skips
      // entries that are already highlighted — and the current line almost
      // always IS highlighted, which made this button appear to do nothing.
      if (!scrollToActiveEntry()) {
        playbackTrackingTick(); // No highlight yet — let a tick establish one
      }
    });

  document.getElementById("savedFilterThis")?.addEventListener("click", () => {
    setSavedFilter(false);
    renderSavedLibrary();
  });
  document.getElementById("savedFilterAll")?.addEventListener("click", () => {
    setSavedFilter(true);
    renderSavedLibrary();
  });
  document.getElementById("savedRetryBtn")?.addEventListener("click", () => {
    void loadSavedLibrary();
  });
  document.getElementById("openSavedLibraryBtn")?.addEventListener("click", () => {
    const recovery = document.getElementById("openSavedLibraryBtn");
    const action = recovery?.dataset.action === "openOptions" ? "openOptions" : "openSavedLibrary";
    void chrome.runtime.sendMessage({ action });
  });
}

function setSavedFilter(showAll) {
  savedLibraryShowAll = showAll;
  const thisVideoButton = document.getElementById("savedFilterThis");
  const allSavedButton = document.getElementById("savedFilterAll");
  thisVideoButton?.classList.toggle("active", !showAll);
  thisVideoButton?.setAttribute("aria-pressed", String(!showAll));
  allSavedButton?.classList.toggle("active", showAll);
  allSavedButton?.setAttribute("aria-pressed", String(showAll));
}

// ============================================================
// VIDEO DETECTION
// ============================================================

let currentTabCheckGeneration = 0;

async function checkCurrentTab() {
  const tabCheckGeneration = ++currentTabCheckGeneration;
  const isStaleTabCheck = () => tabCheckGeneration !== currentTabCheckGeneration;
  try {
    const tabs = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (isStaleTabCheck()) return;
    const tab = tabs[0] || null;

    debugLog("[YouTube Digest Panel] Found tab:", tab?.id, tab?.url);

    const videoId = youtubeWatchVideoId(tab?.url);
    if (!videoId) {
      youtubeTabId = null;
      currentVideoId = null;
      currentVideoUrl = null;
      document.getElementById("saveVideoBtn").style.display = "none";
      showUnsupportedYouTube();
      return;
    }

    // Store the tab ID for reliable messaging later
    youtubeTabId = tab.id;
    currentVideoUrl = tab.url;
    document.getElementById("saveVideoBtn").style.display = "inline-flex";

    try {
      // Route through background script for reliable message passing
      const result = await chrome.runtime.sendMessage({
        action: "relayToContent",
        payload: { action: "getVideoInfo" },
      });
      if (isStaleTabCheck()) return;
      debugLog("[YouTube Digest Panel] getVideoInfo result:", result);
      if (result.success && result.response) {
        currentVideoTitle = result.response.title || "";
        currentChannelName = result.response.channelName || "";
        currentVideoDescription = result.response.description || "";
        currentVideoDuration = result.response.duration || 0;
      }
    } catch (e) {
      if (isStaleTabCheck()) return;
      console.error("[YouTube Digest Panel] getVideoInfo error:", e);
      currentVideoTitle = "";
      currentChannelName = "";
      currentVideoDescription = "";
      currentVideoDuration = 0;
    }

    if (isStaleTabCheck()) return;
    startDigest(videoId, tab.url);
  } catch (error) {
    if (isStaleTabCheck()) return;
    console.error("Tab check error:", error);
    showState("welcome");
  }
}

function youtubeWatchVideoId(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "www.youtube.com" ||
      url.pathname !== "/watch"
    ) {
      return null;
    }
    const videoId = url.searchParams.get("v") || "";
    return SAVE_VIDEO_ID_PATTERN.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

function extractVideoId(url) {
  try {
    const urlObj = new URL(url);

    if (
      urlObj.hostname.includes("youtube.com") &&
      urlObj.searchParams.has("v")
    ) {
      return urlObj.searchParams.get("v");
    }

    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }

    if (urlObj.pathname.startsWith("/embed/")) {
      return urlObj.pathname.split("/")[2];
    }

    return null;
  } catch {
    return null;
  }
}

// ============================================================
// DIGEST PIPELINE
// ============================================================

async function startDigest(videoId, videoUrl) {
  // Check if we already have this video loaded in memory
  if (videoId === currentVideoId && currentAnalysis) {
    showState("results");
    return;
  }

  // Every actual digest refresh replaces the transcript view, even for the
  // same video after an error. Advance the generation so a previous retry
  // cannot clear the refreshed view or a retry started from it.
  translationGeneration += 1;
  overviewGeneration += 1;
  overviewRequest = null;
  isAnalysisLoading = false;
  const digestGeneration = translationGeneration;
  const isStaleDigest = () =>
    digestGeneration !== translationGeneration || videoId !== currentVideoId;
  retryFailedTranslationsInFlight = false;
  retryFailedTranslationsCount = 0;
  overviewRetryAvailable = false;
  updateOverviewRetryButton();
  if (transcriptScrollObserver) transcriptScrollObserver.disconnect();
  transcriptScrollObserver = null;

  currentVideoId = videoId;
  currentVideoUrl = videoUrl;

  // Check cache for this video
  const cached = await loadFromCache(videoId);
  if (isStaleDigest()) return;
  if (cached) {
    debugLog("Loading from cache:", videoId);
    currentAnalysis = cached.analysis || null;
    currentTranscript = cached.transcript;
    currentTranscriptText = cached.transcriptText;
    currentTranscriptTimestamped = cached.transcriptTimestamped;
    currentTranscriptLanguage = cached.transcriptLanguage || null;
    currentSnapshotId = cached.snapshotId;
    currentTranscriptHash = cached.transcriptHash;
    isAnalysisLoading = false;

    // Restore semantic-segment translations from persistent storage.
    if (cached.paragraphCache) {
      for (const [key, value] of Object.entries(cached.paragraphCache)) {
        transcriptParagraphCache.set(key, value);
      }
    }

    if (currentVideoTitle || currentChannelName) {
      const videoInfo = document.getElementById("videoInfo");
      document.getElementById("videoTitle").textContent = currentVideoTitle;
      document.getElementById("videoChannel").textContent = currentChannelName;
      videoInfo.style.display = "block";
    }

    // Always render transcript first
    renderTranscript();

    // Render analysis if we have it cached
    if (currentAnalysis) {
      renderAnalysisResults(currentAnalysis);
      highlightMomentsOnPage(currentAnalysis.keyMoments);
    }

    showState("results");
    document.getElementById("tabsNav").style.display = "flex";

    // Setup explain feature
    setupExplainFeature();
    if (currentTranscriptMode !== "zh") translateTranscript();
    return;
  }

  currentAnalysis = null;
  currentTranscript = null;
  currentTranscriptText = null;
  currentTranscriptTimestamped = null;
  currentTranscriptLanguage = null;
  currentSnapshotId = null;
  currentTranscriptHash = null;
  isAnalysisLoading = false;

  if (currentVideoTitle || currentChannelName) {
    const videoInfo = document.getElementById("videoInfo");
    document.getElementById("videoTitle").textContent = currentVideoTitle;
    document.getElementById("videoChannel").textContent = currentChannelName;
    videoInfo.style.display = "block";
  }

  showState("loading");
  updateLoading("Fetching transcript", "");

  const transcriptResult = await sendCloudAction({
    action: "fetchTranscript",
    videoId: videoId,
  });
  if (isStaleDigest()) return;

  if (!transcriptResult.success) {
    const presentation = getTranscriptErrorPresentation(transcriptResult);
    showError(presentation.title, presentation.message);
    return;
  }
  if (transcriptResult.pending) {
    showError("Transcript is still processing", "Try again shortly; Popcorn will resume the durable job.");
    errorAction = () => startDigest(videoId, videoUrl);
    return;
  }

  currentTranscript = transcriptResult.transcript;
  currentTranscriptText = transcriptResult.transcriptText;
  currentTranscriptTimestamped = transcriptResult.transcriptTextTimestamped;
  currentTranscriptLanguage = transcriptResult.language || null;
  currentSnapshotId = transcriptResult.snapshotId;
  currentTranscriptHash = transcriptResult.transcriptHash;

  // These cloud-supplied values are render-only: do not persist them locally.
  // Both English modes consume this one cache before lazy misses are queued.
  clearTranscriptParagraphCache(videoId);
  primeTranscriptParagraphCache(currentTranscript, videoId);

  // Render transcript immediately (no LLM needed)
  renderTranscript();
  showState("results");
  document.getElementById("tabsNav").style.display = "flex";

  // Setup explain feature for text selection
  setupExplainFeature();
  if (currentTranscriptMode !== "zh") translateTranscript();

  // Save transcript to cache (without analysis)
  await saveToCache(videoId);

  // DON'T run LLM analysis automatically - wait for user to click Overview tab
  // This saves tokens when user just wants to see the transcript
}

// ============================================================
// RENDERING
// ============================================================

/**
 * Renders the analysis results into the Overview tab.
 * Shows complete prose, chapters, and key quotes.
 */
function formatTimestampSeconds(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function renderAnalysisResults(analysis) {
  const overviewText = document.getElementById("overviewText");
  if (overviewText) overviewText.textContent = analysis.overview || "";

  // Chapters
  const chapters = analysis.chapters || [];
  const chaptersSection = document.getElementById("chaptersSection");
  if (chaptersSection) chaptersSection.hidden = chapters.length === 0;
  const chapterList = document.getElementById("chapterList");
  chapterList.innerHTML = "";
  chapters.forEach((chapter) => {
    const li = document.createElement("li");
    li.className = "chapter-item";
    li.dataset.seconds = chapter.timestampSeconds;
    li.innerHTML = `
      <span class="chapter-timestamp">${formatTimestampSeconds(chapter.timestampSeconds)}</span>
      <div class="chapter-content">
        <span class="chapter-title">${escapeHtml(chapter.title)}</span>
        <span class="chapter-summary">${escapeHtml(chapter.summary || "")}</span>
      </div>
    `;
    li.addEventListener("click", () => {
      debugLog(
        "[YouTube Digest Panel] Chapter clicked:",
        formatTimestampSeconds(chapter.timestampSeconds),
        chapter.timestampSeconds,
      );
      seekTo(chapter.timestampSeconds);
    });
    chapterList.appendChild(li);
  });

  // Quotes - sort by timestamp (chronological order)
  const keyQuotes = analysis.keyQuotes || [];
  const keyQuotesSection = document.getElementById("keyQuotesSection");
  if (keyQuotesSection) keyQuotesSection.hidden = keyQuotes.length === 0;
  const quotesList = document.getElementById("quotesList");
  quotesList.innerHTML = "";
  const sortedQuotes = [...keyQuotes].sort(
    (a, b) => (a.timestampSeconds || 0) - (b.timestampSeconds || 0),
  );
  sortedQuotes.forEach((quote) => {
    const div = document.createElement("div");
    div.className = "quote-item";
    div.dataset.seconds = quote.timestampSeconds;
    div.innerHTML = `
      <div class="quote-text">${escapeHtml(quote.quote)}</div>
      <div class="quote-meaning">${escapeHtml(quote.englishMeaning)}</div>
      <div class="quote-meta">
        <span class="quote-timestamp">${formatTimestampSeconds(quote.timestampSeconds)}</span>
        <div class="quote-actions">
          <button class="quote-save-note-btn" title="Save this exact quote">Save</button>
          <button class="quote-copy-btn" title="Copy this quote">⧉ Copy</button>
        </div>
      </div>
    `;
    div.addEventListener("click", () => {
      debugLog(
        "[YouTube Digest Panel] Quote clicked:",
        formatTimestampSeconds(quote.timestampSeconds),
        quote.timestampSeconds,
      );
      seekTo(quote.timestampSeconds);
    });

    const quoteCopyBtn = div.querySelector(".quote-copy-btn");
    quoteCopyBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(quote.quote);
        quoteCopyBtn.textContent = "✓ Copied";
        setTimeout(() => {
          quoteCopyBtn.textContent = "⧉ Copy";
        }, 1500);
      } catch (err) {
        console.error("Copy failed:", err);
      }
    });

    const quoteSaveNoteBtn = div.querySelector(".quote-save-note-btn");
    quoteSaveNoteBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await saveQuoteAsNote(quote, quoteSaveNoteBtn);
    });

    quotesList.appendChild(div);
  });
}

/**
 * Saves the exact displayed key quote and its server-grounded evidence.
 */
async function saveQuoteAsNote(quote, btn) {
  if (!currentVideoId) return;
  try {
    const input = buildKeyQuoteSaveInput({ videoId: currentVideoId, quote });
    await saveWithButton(input, btn, "Save");
  } catch (error) {
    console.error("[Popcorn] Save key quote failed:", error);
  }
}

/**
 * Legacy function for backwards compatibility with cached data.
 * Renders both transcript and analysis.
 */
function renderResults(analysis) {
  renderAnalysisResults(analysis);

  renderTranscript();

  document.getElementById("tabsNav").style.display = "flex";

  // Setup explain feature for text selection
  setupExplainFeature();
}

/**
 * Returns true while the user has a range of text selected.
 * Transcript row clicks must not seek in that state: the click emitted after
 * selection mouseup belongs to the selection/explain interaction, not playback.
 */
function hasNonCollapsedTextSelection() {
  const selection = window.getSelection();
  return Boolean(
    selection && selection.rangeCount > 0 && !selection.isCollapsed,
  );
}

/**
 * Preserves normal row-click seeking while keeping text selection inert.
 */
function seekFromTranscriptEntryClick(event, seconds) {
  if (hasNonCollapsedTextSelection()) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  seekTo(seconds);
}

function saveContextForSegmentIds(segmentIds) {
  const segments = getActiveTranscriptSegments();
  const indices = segmentIds
    .map((id) => segments.findIndex((segment) => segment.id === id))
    .filter((index) => index >= 0);
  if (indices.length !== segmentIds.length) return failSave("Missing transcript evidence");
  const first = Math.min(...indices);
  const last = Math.max(...indices);
  return {
    contextBefore: segments
      .slice(Math.max(0, first - SAVE_LIMITS.maxContextItems), first)
      .map((segment) => segment.text),
    contextAfter: segments
      .slice(last + 1, last + 1 + SAVE_LIMITS.maxContextItems)
      .map((segment) => segment.text),
  };
}

function shownEnglishForSegment(segment) {
  if (currentTranscriptMode === "zh") return undefined;
  return transcriptParagraphCache.get(transcriptTranslationCacheKey(segment));
}

function shownEnglishForSelection(segmentIds) {
  if (currentTranscriptMode !== "bilingual" || !Array.isArray(segmentIds)) {
    return undefined;
  }
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return undefined;
  const selectedIds = new Set(segmentIds);
  const rows = [...transcriptList.querySelectorAll(".transcript-entry")].filter(
    (row) => selectedIds.has(row.dataset.segmentId),
  );
  if (
    rows.length !== segmentIds.length ||
    rows.some((row, index) => row.dataset.segmentId !== segmentIds[index])
  ) {
    return undefined;
  }

  const translations = rows.map((row) => {
    if (!row.classList.contains("translated")) return "";
    return row.querySelector(".transcript-translation")?.textContent?.trim() || "";
  });
  return translations.every(Boolean) ? translations.join("\n") : undefined;
}

async function saveTranscriptRow(segment, button) {
  const input = buildSubtitleRowSaveInput({
    videoId: currentVideoId,
    segment,
    englishTranslation: shownEnglishForSegment(segment),
    ...saveContextForSegmentIds([segment.id]),
  });
  return saveWithButton(input, button, "Save", {
    persistentSuccess: true,
    onSuccess: (savedInput) => {
      recordSavedTranscriptMarker({
        videoId: savedInput.youtubeVideoId,
        segmentId: savedInput.segmentId,
      });
      updateTranscriptSavedButtons();
    },
    reconcilePersistentState: updateTranscriptSavedButtons,
  });
}

function renderTranscript() {
  if (!currentTranscript) return;

  const transcriptList = document.getElementById("transcriptList");
  transcriptList.innerHTML = "";

  // Show a small badge indicating the transcript came from the video's
  // existing subtitles. (We no longer AI-transcribe audio, so subtitles
  // are the only source.)
  const existingBadge = document.getElementById("transcriptSourceBadge");
  if (existingBadge) existingBadge.remove();

  const badge = document.createElement("div");
  badge.id = "transcriptSourceBadge";
  badge.className = "transcript-source-badge";
  badge.innerHTML = `<span class="source-dot source-dot--subs"></span> From video subtitles · ${escapeHtml(getOriginalTranscriptLabel())}`;
  transcriptList.parentElement.insertBefore(badge, transcriptList);

  // Group entries using smart sentence-boundary + time-guardrail logic
  const grouped = groupTranscriptEntries(currentTranscript);

  grouped.forEach((group) => {
    const div = document.createElement("div");
    div.className = "transcript-entry";
    div.dataset.seconds = group.start;
    div.dataset.endSeconds = group.end;
    div.dataset.segmentId = group.id;

    const minutes = Math.floor(group.start / 60);
    const seconds = Math.floor(group.start % 60);
    const timestamp = `${minutes}:${String(seconds).padStart(2, "0")}`;

    const saved = isTranscriptSegmentSaved(group, grouped.indexOf(group), grouped);
    div.innerHTML = `
      <span class="transcript-time">${timestamp}</span>
      <span class="transcript-text">${renderSubtitleInlineMarkup(group.text)}</span>
      <button class="transcript-save-btn" type="button"${saved ? " disabled" : ""}>${saved ? "Saved" : "Save"}</button>
    `;

    div.addEventListener("click", (event) =>
      seekFromTranscriptEntryClick(event, group.start),
    );
    const saveButton = div.querySelector(".transcript-save-btn");
    saveButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await saveTranscriptRow(group, saveButton);
      } catch (error) {
        console.error("[Popcorn] Save subtitle row failed:", error);
      }
    });
    transcriptList.appendChild(div);
  });

  // Start tracking video playback for auto-scroll
  startPlaybackTracking();
  updateRetryFailedTranslationsButton();
}

function copyTranscript() {
  copyToClipboardWithFeedback(currentTranscriptText || "", "copyTranscriptBtn");
}

// ============================================================
// UI STATE MANAGEMENT
// ============================================================

function showState(state) {
  document.getElementById("welcomeState").style.display =
    state === "welcome" ? "flex" : "none";
  document.getElementById("loadingState").style.display =
    state === "loading" ? "block" : "none";
  document.getElementById("errorState").style.display =
    state === "error" ? "block" : "none";
  const uploadEl = document.getElementById("uploadState");
  if (uploadEl) uploadEl.style.display = "none"; // Upload state removed — always hidden
  document.getElementById("resultsState").style.display =
    state === "results" ? "block" : "none";

  // The tab bar only belongs on the results view. We toggle it HERE, in one
  // place, so it tracks the view automatically. Previously each caller had to
  // remember to re-show it after showState("results"), and one path forgot —
  // which is why the tabs could vanish when re-opening an already-analyzed video.
  document.getElementById("tabsNav").style.display =
    state === "results" ? "flex" : "none";

  if (state !== "results") {
    stopPlaybackTracking();
  }
}

function updateLoading(title, subtitle) {
  document.getElementById("loadingText").textContent = title;
  document.getElementById("loadingSubtext").textContent = subtitle;
}

function showError(title, message) {
  errorAction = null;
  showState("error");
  document.getElementById("errorTitle").textContent = title;
  document.getElementById("errorMessage").textContent = message;
  document.getElementById("errorBtn").textContent = "Try Again";
}

function getTranscriptErrorPresentation(result) {
  if (result?.code === "LOCAL_SERVICE_UNAVAILABLE") {
    return {
      title: "Popcorn service unavailable",
      message: "The local Popcorn service is not running or reachable. Start Popcorn and try again.",
    };
  }
  if (result?.code === "NATIVE_CHINESE_TRANSCRIPT_REQUIRED") {
    return {
      title: "No transcript found",
      message: "No native Chinese transcript is available for this video.",
    };
  }
  if (result?.code === "TRANSCRIPT_EMPTY") {
    return {
      title: "No transcript found",
      message: "No transcript is available for this video.",
    };
  }
  return {
    title: "Transcript unavailable",
    message: "The transcript could not be fetched. Please try again.",
  };
}

// ============================================================
// TAB SWITCHING
// ============================================================

function switchTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabName);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  });

  // Start/stop playback tracking based on which tab is active
  if (tabName === "transcript") {
    startPlaybackTracking();
  } else {
    stopPlaybackTracking();
  }

  // Lazy-load LLM analysis when user switches to Overview tab
  if (tabName === "overview" && !currentAnalysis && !isAnalysisLoading && !overviewRetryAvailable) {
    triggerAnalysis();
  }
  if (tabName === "saved") {
    void loadSavedLibrary();
  }
}

/**
 * Triggers the LLM analysis (lazy-loaded when user clicks Overview or Quotes tab).
 * This saves tokens by not running analysis until needed.
 */
function updateOverviewRetryButton() {
  const button = document.getElementById("retryOverviewBtn");
  if (!button) return;
  button.hidden = !overviewRetryAvailable || isAnalysisLoading;
  button.disabled = isAnalysisLoading;
}

function validatedOverviewResumeRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fields = Object.keys(value);
  if (
    fields.length < 3 ||
    fields.length > OVERVIEW_RESUME_FIELDS.size ||
    fields.some((field) => !OVERVIEW_RESUME_FIELDS.has(field)) ||
    !SAVE_VIDEO_ID_PATTERN.test(value.videoId || "") ||
    !SAVE_UUID_PATTERN.test(value.snapshotId || "")
  ) {
    return null;
  }
  const record = {
    videoId: value.videoId,
    snapshotId: value.snapshotId,
  };
  for (const field of ["retryId", "jobId"]) {
    if (value[field] === undefined) continue;
    if (!SAVE_UUID_PATTERN.test(value[field])) return null;
    record[field] = value[field];
  }
  return record.retryId || record.jobId ? record : null;
}

function overviewResumeRecordFor(request) {
  return validatedOverviewResumeRecord({
    videoId: request.videoId,
    snapshotId: request.snapshotId,
    ...(request.retryId ? { retryId: request.retryId } : {}),
    ...(request.jobId ? { jobId: request.jobId } : {}),
  });
}

function matchingOverviewResumeRecord(left, right) {
  const leftRecord = validatedOverviewResumeRecord(left);
  const rightRecord = overviewResumeRecordFor(right);
  return Boolean(leftRecord && rightRecord) &&
    Object.keys(leftRecord).length === Object.keys(rightRecord).length &&
    Object.entries(leftRecord).every(([field, value]) => rightRecord[field] === value);
}

async function loadOverviewResumeRecord(videoId, snapshotId) {
  try {
    const stored = await chrome.storage.local.get(OVERVIEW_RESUME_STORAGE_KEY);
    const rawRecord = stored?.[OVERVIEW_RESUME_STORAGE_KEY];
    if (rawRecord === undefined) return null;
    const record = validatedOverviewResumeRecord(rawRecord);
    if (!record) {
      await chrome.storage.local.remove(OVERVIEW_RESUME_STORAGE_KEY);
      return null;
    }
    return record.videoId === videoId && record.snapshotId === snapshotId
      ? record
      : null;
  } catch {
    return null;
  }
}

async function persistOverviewResumeRecord(request) {
  const record = overviewResumeRecordFor(request);
  if (!record) return false;
  try {
    await chrome.storage.local.set({ [OVERVIEW_RESUME_STORAGE_KEY]: record });
    return true;
  } catch {
    return false;
  }
}

async function clearMatchingOverviewResumeRecord(request) {
  try {
    const stored = await chrome.storage.local.get(OVERVIEW_RESUME_STORAGE_KEY);
    if (matchingOverviewResumeRecord(stored?.[OVERVIEW_RESUME_STORAGE_KEY], request)) {
      await chrome.storage.local.remove(OVERVIEW_RESUME_STORAGE_KEY);
    }
  } catch {
    // Resume state is best-effort only; server ownership remains authoritative.
  }
}

function retryOverview() {
  if (!overviewRetryAvailable || isAnalysisLoading) return;
  return triggerAnalysis(crypto.randomUUID());
}

function isCurrentOverviewRequest(request) {
  return overviewRequest === request &&
    request.generation === overviewGeneration &&
    request.videoId === currentVideoId &&
    request.snapshotId === currentSnapshotId;
}

function isCurrentOverviewOwner(owner) {
  return overviewRequest === owner.request &&
    owner.generation === overviewGeneration &&
    owner.videoId === currentVideoId &&
    owner.snapshotId === currentSnapshotId;
}

function showOverviewRetryPersistenceFailure() {
  const overviewText = document.getElementById("overviewText");
  if (overviewText) overviewText.textContent = "Could not save retry state. Please retry overview again.";
  hideOverviewOptionalSections();
}

function showOverviewOptionalSections() {
  const chaptersSection = document.getElementById("chaptersSection");
  const keyQuotesSection = document.getElementById("keyQuotesSection");
  if (chaptersSection) chaptersSection.hidden = false;
  if (keyQuotesSection) keyQuotesSection.hidden = false;
}

function hideOverviewOptionalSections() {
  const chaptersSection = document.getElementById("chaptersSection");
  const keyQuotesSection = document.getElementById("keyQuotesSection");
  if (chaptersSection) chaptersSection.hidden = true;
  if (keyQuotesSection) keyQuotesSection.hidden = true;
}

async function triggerAnalysis(retryId) {
  if (!currentTranscriptTimestamped || isAnalysisLoading || currentAnalysis)
    return;

  const owner = {
    request: overviewRequest,
    generation: overviewGeneration,
    videoId: currentVideoId,
    snapshotId: currentSnapshotId,
  };
  isAnalysisLoading = true;
  overviewRetryAvailable = false;
  updateOverviewRetryButton();

  const memoryRequest = !retryId && owner.request?.jobId &&
    owner.request.generation === owner.generation &&
    owner.request.videoId === owner.videoId &&
    owner.request.snapshotId === owner.snapshotId
    ? owner.request
    : null;
  const storedRecord = !retryId && !memoryRequest
    ? await loadOverviewResumeRecord(owner.videoId, owner.snapshotId)
    : null;
  if (!isCurrentOverviewOwner(owner)) return;
  const request = memoryRequest
    || (storedRecord
      ? {
        videoId: storedRecord.videoId,
        snapshotId: storedRecord.snapshotId,
        generation: overviewGeneration,
        retryId: storedRecord.retryId,
        jobId: storedRecord.jobId,
      }
    : {
      videoId: currentVideoId,
      snapshotId: currentSnapshotId,
      generation: overviewGeneration,
      retryId,
      jobId: undefined,
    });
  if (retryId && !(await persistOverviewResumeRecord(request))) {
    if (!isCurrentOverviewOwner(owner)) return;
    isAnalysisLoading = false;
    overviewRetryAvailable = true;
    updateOverviewRetryButton();
    showOverviewRetryPersistenceFailure();
    return;
  }
  if (!isCurrentOverviewOwner(owner)) return;
  overviewRequest = request;
  let clearRequest = false;

  // Show loading indicators in the Overview tab
  const overviewText = document.getElementById("overviewText");
  const chapterList = document.getElementById("chapterList");
  const quotesList = document.getElementById("quotesList");

  showOverviewOptionalSections();
  if (overviewText) overviewText.textContent = OVERVIEW_PROGRESS_COPY;
  if (chapterList)
    chapterList.innerHTML =
      '<li class="chapter-item" style="color: var(--text-muted); border: none;">Loading chapters...</li>';
  if (quotesList)
    quotesList.innerHTML =
      '<div class="quote-item" style="color: var(--text-muted); border-left-color: var(--border);">Loading quotes...</div>';

  try {
    const analysisResult = await sendCloudAction({
      action: "requestOverview",
      videoId: request.videoId,
      snapshotId: request.snapshotId,
      ...(request.retryId ? { retryId: request.retryId } : {}),
      ...(request.jobId ? { jobId: request.jobId } : {}),
    }, undefined, async (jobId) => {
      if (!isCurrentOverviewRequest(request)) return;
      request.jobId = jobId;
      await persistOverviewResumeRecord(request);
    });
    if (!isCurrentOverviewRequest(request)) return;

    if (!analysisResult.success) {
      if (overviewText)
        overviewText.textContent = `Analysis failed: ${learningArtifactStatusCopy(analysisResult, "Overview")}`;
      hideOverviewOptionalSections();
      overviewRetryAvailable = true;
      if (analysisResult.terminal === true) {
        await clearMatchingOverviewResumeRecord(request);
        clearRequest = true;
      }
      return;
    }
    if (analysisResult.pending) {
      if (chapterList) chapterList.innerHTML = '<li class="chapter-item" style="color: var(--text-muted); border: none;">Overview is still processing. Reopen this tab shortly.</li>';
      request.jobId = analysisResult.jobId || request.jobId;
      await persistOverviewResumeRecord(request);
      return;
    }

    currentAnalysis = analysisResult.content;
    renderAnalysisResults(currentAnalysis);
    highlightMomentsOnPage(currentAnalysis.keyMoments);

    // Save to cache now that we have analysis
    await saveToCache(request.videoId);
    if (!isCurrentOverviewRequest(request)) return;
    await clearMatchingOverviewResumeRecord(request);
    clearRequest = true;
  } catch (error) {
    if (!isCurrentOverviewRequest(request)) return;
    console.error("[YouTube Digest Panel] Analysis error:", error);
    if (overviewText) overviewText.textContent = `Error: ${error.message}`;
    hideOverviewOptionalSections();
    overviewRetryAvailable = true;
    clearRequest = true;
  } finally {
    if (!isCurrentOverviewRequest(request)) return;
    isAnalysisLoading = false;
    updateOverviewRetryButton();
    if (clearRequest) overviewRequest = null;
  }
}

// ============================================================
// TIMESTAMP / SEEK
// ============================================================

async function seekTo(seconds) {
  debugLog("[YouTube Digest Panel] seekTo called with:", seconds);
  if (seconds === undefined || seconds === null) {
    debugLog("[YouTube Digest Panel] seekTo aborted - no seconds value");
    return;
  }

  const payload = {
    action: "seekTo",
    seconds: Number(seconds),
  };

  try {
    // Try direct messaging to the stored YouTube tab first (fastest/reliable)
    if (youtubeTabId) {
      try {
        await chrome.tabs.sendMessage(youtubeTabId, payload);
        debugLog("[YouTube Digest Panel] seekTo direct success");
        return;
      } catch (directErr) {
        debugLog(
          "[YouTube Digest Panel] Direct seekTo failed, falling back to relay:",
          directErr.message,
        );
      }
    }

    // Fallback: route through background script
    const result = await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload,
    });
    debugLog("[YouTube Digest Panel] seekTo relay result:", result);
  } catch (error) {
    console.error("[YouTube Digest Panel] seekTo error:", error);
  }
}

async function highlightMomentsOnPage(moments) {
  if (!moments || !moments.length) return;

  try {
    // Route through background script for reliable message passing
    await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload: {
        action: "highlightMoments",
        moments: moments,
        videoDuration: currentVideoDuration,
      },
    });
  } catch (error) {
    console.error("Highlight error:", error);
  }
}

// ============================================================
// UTILITY
// ============================================================

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

/**
 * Renders the small subset of inline formatting commonly present in subtitle
 * tracks and model translations. Everything is escaped first; only exact,
 * attribute-free allowlisted tags are restored as markup afterwards.
 */
function renderSubtitleInlineMarkup(text) {
  return escapeHtml(text).replace(
    /&lt;(\/?)(i|em|b|strong|u)&gt;|&lt;br(?:\s*\/)?&gt;/gi,
    (_match, closing, tagName) =>
      tagName ? `<${closing}${tagName.toLowerCase()}>` : "<br>",
  );
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Copy failed:", error);
    return false;
  }
}

async function copyToClipboardWithFeedback(text, buttonId) {
  const btn = document.getElementById(buttonId);
  const original = btn.textContent;

  const success = await copyToClipboard(text);
  if (success) {
    btn.textContent = "✓ Copied";
    setTimeout(() => {
      btn.textContent = original;
    }, 2000);
  }
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(str) {
  return (str || "untitled")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 50)
    .toLowerCase();
}

// ============================================================
// TEXT SELECTION — EXPLAIN FEATURE
// ============================================================

/**
 * Sets up text selection handling in the transcript.
 * When user selects text, shows an "Explain" button.
 */
function setupExplainFeature() {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return;

  // Remove existing tooltip if any
  const existingTooltip = document.getElementById("explainTooltip");
  if (existingTooltip) existingTooltip.remove();

  // Create the explain tooltip/button
  const tooltip = document.createElement("div");
  tooltip.id = "explainTooltip";
  tooltip.className = "explain-tooltip";
  tooltip.innerHTML = `
    <button class="explain-btn">💡 Explain</button>
    <button class="selection-save-btn" type="button">Save</button>
  `;
  tooltip.style.display = "none";
  document.body.appendChild(tooltip);

  let selectedEvidence = null;

  // Interacting with Explain must preserve the transcript selection and stay
  // isolated from document/row click behavior.
  tooltip.addEventListener("mousedown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  tooltip.addEventListener("mouseup", (event) => {
    event.stopPropagation();
  });
  tooltip.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  // Listen for text selection
  document.addEventListener("mouseup", (e) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim() || "";

    // Only show if selecting within transcript
    const isInTranscript = selection && transcriptList.contains(selection.anchorNode);

    // Allow any selection length (removed 10+ char requirement)
    if (text.length > 0 && isInTranscript) {
      // Position the tooltip near the selection
      const range = selection.getRangeAt(0);
      selectedEvidence = projectTranscriptSelection(range, transcriptList);
      if (!selectedEvidence) {
        tooltip.style.display = "none";
        return;
      }
      const rect = range.getBoundingClientRect();

      tooltip.style.display = "block";
      tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tooltip.style.left = `${rect.left + rect.width / 2}px`;
    } else {
      selectedEvidence = null;
      tooltip.style.display = "none";
    }
  });

  // Hide tooltip when clicking elsewhere
  document.addEventListener("mousedown", (e) => {
    if (!tooltip.contains(e.target)) {
      tooltip.style.display = "none";
    }
  });

  // Handle explain button click
  tooltip
    .querySelector(".explain-btn")
    .addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedEvidence) return;

      tooltip.style.display = "none";
      await showExplanation(selectedEvidence);
    });

  tooltip
    .querySelector(".selection-save-btn")
    .addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!selectedEvidence) return;
      const button = event.currentTarget;
      try {
        const input = buildSubtitleSelectionSaveInput({
          videoId: currentVideoId,
          evidence: selectedEvidence,
          englishTranslation: shownEnglishForSelection(
            selectedEvidence.segmentIds,
          ),
          ...saveContextForSegmentIds(selectedEvidence.segmentIds),
        });
        await saveWithButton(input, button, "Save");
        tooltip.style.display = "none";
      } catch (error) {
        console.error("[Popcorn] Save subtitle selection failed:", error);
      }
    });
}

function nativeTextElement(row) {
  return row.querySelector(".transcript-text, .transcript-original");
}

function utf16OffsetWithin(element, container, offset) {
  if (!element.contains(container)) return null;
  const prefix = element.ownerDocument.createRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(container, offset);
  return prefix.toString().length;
}

/**
 * Projects a DOM Range onto persisted transcript rows. Context joins complete
 * native rows with one newline, so UTF-16 offsets remain deterministic across
 * DOM wrappers and across line boundaries.
 */
function projectTranscriptSelection(range, transcriptList) {
  if (!range || range.collapsed || !transcriptList) return null;
  const rows = [...transcriptList.querySelectorAll(".transcript-entry")].filter(
    (row) => range.intersectsNode(row),
  );
  if (rows.length === 0 || rows.length > 32) return null;

  const projectedRows = rows.map((row) => {
    const nativeText = nativeTextElement(row);
    const stableId = row.dataset.segmentId || "";
    const startSeconds = Number(row.dataset.seconds);
    const endSeconds = Number(row.dataset.endSeconds);
    if (
      !nativeText ||
      !/^[a-f0-9]{64}$/.test(stableId) ||
      !Number.isFinite(startSeconds) ||
      !Number.isFinite(endSeconds) ||
      endSeconds < startSeconds
    ) {
      return null;
    }
    return {
      stableId,
      startSeconds,
      endSeconds,
      nativeText: nativeText.textContent || "",
      element: nativeText,
    };
  });
  if (projectedRows.some((row) => row === null)) return null;

  const completeRows = projectedRows;
  const first = completeRows[0];
  const last = completeRows[completeRows.length - 1];
  let localStart = utf16OffsetWithin(
    first.element,
    range.startContainer,
    range.startOffset,
  );
  let localEnd = utf16OffsetWithin(
    last.element,
    range.endContainer,
    range.endOffset,
  );
  if (localStart === null || localEnd === null) return null;

  const context = completeRows.map((row) => row.nativeText).join("\n");
  const utf16Start = localStart;
  const utf16End = completeRows
    .slice(0, -1)
    .reduce((length, row) => length + row.nativeText.length + 1, 0) + localEnd;
  if (context.length > 16_000 || utf16End <= utf16Start) return null;

  let adjustedStart = utf16Start;
  let adjustedEnd = utf16End;
  while (/\s/u.test(context.charAt(adjustedStart))) adjustedStart += 1;
  while (/\s/u.test(context.charAt(adjustedEnd - 1))) adjustedEnd -= 1;
  const selectedChinese = context.slice(adjustedStart, adjustedEnd);
  if (!selectedChinese || selectedChinese.length > 2_000) return null;

  return {
    selectedChinese,
    segmentIds: [...new Set(completeRows.map((row) => row.stableId))],
    utf16Start: adjustedStart,
    utf16End: adjustedEnd,
    startSeconds: Math.min(...completeRows.map((row) => row.startSeconds)),
    endSeconds: Math.max(...completeRows.map((row) => row.endSeconds)),
    context,
  };
}

function createExplanationMessage(selectionEvidence, identity) {
  return {
    action: "explainSelection",
    videoId: identity.videoId,
    snapshotId: identity.snapshotId,
    ...selectionEvidence,
  };
}

/**
 * Shows the explanation modal and fetches it from the configured AI provider.
 */
async function showExplanation(selectionEvidence) {
  const selectedText = selectionEvidence.selectedChinese;
  // Create modal
  const modal = document.createElement("div");
  modal.id = "explainModal";
  modal.className = "explain-modal-overlay";
  modal.innerHTML = `
    <div class="explain-modal">
      <div class="explain-modal-header">
        <div class="explain-modal-title">Explain</div>
        <button class="explain-modal-close" id="closeExplain">✕</button>
      </div>
      <div class="explain-selected-text">"${escapeHtml(selectedText.substring(0, 200))}${selectedText.length > 200 ? "..." : ""}"</div>
      <div class="explain-modal-content" id="explanationContent">
        <div class="explain-loading">
          <div class="loading-bar"></div>
          <span>Analyzing...</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  document
    .getElementById("closeExplain")
    .addEventListener("click", () => modal.remove());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });

  // Fetch explanation
  try {
    const result = await sendCloudAction(createExplanationMessage(selectionEvidence, {
      videoId: currentVideoId,
      snapshotId: currentSnapshotId,
    }));

    const contentDiv = document.getElementById("explanationContent");
    if (result.success && !result.pending) {
      const explanation = result.content;
      const text = [
        `Meaning: ${explanation.meaning}`,
        `Tone: ${explanation.tone}`,
        `Communicative function: ${explanation.communicativeFunction}`,
        `Contextual fit: ${explanation.contextualFit}`,
      ].join("\n\n");
      contentDiv.innerHTML = `
        <div class="explain-text">${escapeHtml(text).replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</div>
        <button class="explanation-save-btn" type="button">Save Explanation</button>
      `;
      const saveButton = contentDiv.querySelector(".explanation-save-btn");
      saveButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          const input = buildAiExplanationSaveInput({
            videoId: currentVideoId,
            evidence: selectionEvidence,
            englishExplanation: text,
            ...saveContextForSegmentIds(selectionEvidence.segmentIds),
          });
          await saveWithButton(input, saveButton, "Save Explanation");
        } catch (saveError) {
          console.error("[Popcorn] Save explanation failed:", saveError);
        }
      });
    } else if (result.pending) {
      contentDiv.innerHTML = `<div class="explain-loading">${escapeHtml(learningArtifactStatusCopy(result, "Explanation"))}</div>`;
    } else {
      contentDiv.innerHTML = `<div class="explain-error">${escapeHtml(learningArtifactStatusCopy(result, "Explanation"))}</div>`;
    }
  } catch (error) {
    const contentDiv = document.getElementById("explanationContent");
    contentDiv.innerHTML = `<div class="explain-error">Error: ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Gets surrounding context from the transcript for the selected text.
 */
function getTranscriptContext(selectedText) {
  const fullText = currentTranscriptText || "";
  const index = fullText.indexOf(selectedText);

  if (index === -1) return "";

  // Get 200 chars before and after
  const start = Math.max(0, index - 200);
  const end = Math.min(fullText.length, index + selectedText.length + 200);

  return fullText.substring(start, end);
}

// ============================================================
// CACHING
// ============================================================

async function saveToCache() {
  // Cloud transcript/artifact payloads are intentionally not persisted locally.
}

/**
 * Keeps the cache from growing unbounded.
 * Removes the oldest entries when we exceed maxEntries videos.
 *
 * @param {number} maxEntries - Maximum number of cached videos to keep
 */
async function evictOldCacheEntries(maxEntries) {
  try {
    const allData = await chrome.storage.local.get(null);
    let digestKeys = Object.keys(allData).filter((k) =>
      k.startsWith("digest_"),
    );
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const expired = digestKeys.filter((key) => {
      const timestamp = Number(allData[key]?.timestamp) || 0;
      return Date.now() - timestamp > THIRTY_DAYS;
    });
    if (expired.length) {
      await chrome.storage.local.remove(expired);
      const expiredSet = new Set(expired);
      digestKeys = digestKeys.filter((key) => !expiredSet.has(key));
    }

    if (digestKeys.length <= maxEntries) return;

    // Sort by timestamp (oldest first) and remove excess
    const sorted = digestKeys
      .map((k) => ({ key: k, ts: allData[k]?.timestamp || 0 }))
      .sort((a, b) => a.ts - b.ts);

    const toRemove = sorted
      .slice(0, sorted.length - maxEntries)
      .map((e) => e.key);
    if (toRemove.length > 0) {
      await chrome.storage.local.remove(toRemove);
      debugLog(`[YouTube Digest] Evicted ${toRemove.length} old cache entries`);
    }
  } catch (error) {
    console.error("Cache eviction error:", error);
  }
}

/**
 * Loads digest results from persistent local storage.
 * Returns null if not cached or expired (30-day expiry).
 */
async function loadFromCache(videoId) {
  void videoId;
  return null;
}

/**
 * Updates the cache after enhance or translation operations.
 */
async function updateCache() {
  await saveToCache();
}

// ============================================================
// SAVED LIBRARY
// ============================================================

const SAVED_PROCESSING_LABELS = Object.freeze({
  saved: "Waiting to organize",
  resolving_source: "Organizing",
  organizing: "Organizing",
  ready: "Ready",
  unsupported: "Needs attention",
  failed: "Could not organize",
});

function boundedSavedText(value, maximum, fallback = "") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maximum) : fallback;
}

function normalizeSavedSummary(value) {
  if (!value || typeof value !== "object") return null;
  if (!SAVE_UUID_PATTERN.test(value.sourceId || "")) return null;
  if (!SAVE_VIDEO_ID_PATTERN.test(value.youtubeVideoId || "")) return null;
  if (!Number.isInteger(value.savedCount) || value.savedCount < 1) return null;
  if (!(value.processingState in SAVED_PROCESSING_LABELS)) return null;
  return {
    sourceId: value.sourceId,
    youtubeVideoId: value.youtubeVideoId,
    title: boundedSavedText(value.title, 200, "Saved YouTube video"),
    channel: boundedSavedText(value.channel, 120),
    savedCount: Math.min(value.savedCount, 99_999),
    processingState: value.processingState,
  };
}

function showSavedLibraryState(message, { loading = false, recoveryAction = "openSavedLibrary" } = {}) {
  const state = document.getElementById("savedLibraryState");
  const messageElement = document.getElementById("savedLibraryMessage");
  const list = document.getElementById("savedList");
  const retry = document.getElementById("savedRetryBtn");
  const recovery = document.getElementById("openSavedLibraryBtn");
  if (!state || !messageElement || !list || !retry || !recovery) return;
  messageElement.textContent = message;
  state.hidden = false;
  list.hidden = true;
  retry.hidden = loading;
  retry.disabled = loading;
  recovery.dataset.action = recoveryAction;
  recovery.textContent = recoveryAction === "openOptions" ? "Sign in to Popcorn" : "Open Saved in Popcorn";
}

function showSavedLibraryFailure(result) {
  if (result?.code === "AUTH_REQUIRED") {
    showSavedLibraryState("Sign in to Popcorn to view your Saved library.", { recoveryAction: "openOptions" });
    return;
  }
  if (result?.code === "SESSION_EXPIRED") {
    showSavedLibraryState("Your Popcorn session expired. Sign in again to view Saved.", { recoveryAction: "openOptions" });
    return;
  }
  showSavedLibraryState("Saved is temporarily unavailable. Try again.");
}

async function loadSavedLibrary() {
  const generation = ++savedLibraryLoadGeneration;
  showSavedLibraryState("Loading your Saved library…", { loading: true });
  try {
    const result = await chrome.runtime.sendMessage({
      action: "getSavedLibrary",
    });
    if (generation !== savedLibraryLoadGeneration) return;
    if (!result?.success) {
      showSavedLibraryFailure(result);
      return;
    }
    savedLibrarySummaries = Array.isArray(result.summaries)
      ? result.summaries.map(normalizeSavedSummary).filter(Boolean)
      : [];
    renderSavedLibrary();
  } catch (_error) {
    if (generation === savedLibraryLoadGeneration) {
      showSavedLibraryState("Saved is temporarily unavailable. Try again.");
    }
  }
}

function renderSavedLibrary() {
  const state = document.getElementById("savedLibraryState");
  const list = document.getElementById("savedList");
  if (!state || !list) return;
  list.textContent = "";
  const visible = savedLibraryShowAll
    ? savedLibrarySummaries
    : savedLibrarySummaries.filter(({ youtubeVideoId }) => youtubeVideoId === currentVideoId);
  if (visible.length === 0) {
    const scope = savedLibraryShowAll ? "your library" : "this video";
    showSavedLibraryState(
      `No synced saves in ${scope} yet. A save queued locally may appear after sync.`,
    );
    return;
  }
  state.hidden = true;
  list.hidden = false;
  visible.forEach((summary) => {
    const item = document.createElement("article");
    item.className = "saved-library-item";
    const title = document.createElement("h3");
    title.className = "saved-library-title";
    title.textContent = summary.title;
    item.appendChild(title);
    if (summary.channel) {
      const channel = document.createElement("p");
      channel.className = "saved-library-channel";
      channel.textContent = summary.channel;
      item.appendChild(channel);
    }
    const meta = document.createElement("div");
    meta.className = "saved-library-meta";
    const count = document.createElement("span");
    count.textContent = `${summary.savedCount} ${summary.savedCount === 1 ? "save" : "saves"}`;
    const processing = document.createElement("span");
    processing.className = `saved-processing saved-processing-${summary.processingState}`;
    processing.textContent = SAVED_PROCESSING_LABELS[summary.processingState];
    meta.append(count, processing);
    item.appendChild(meta);
    const open = document.createElement("button");
    open.className = "saved-library-open";
    open.type = "button";
    open.textContent = "Open in Popcorn";
    open.addEventListener("click", () => {
      void chrome.runtime.sendMessage({
        action: "openSavedDetail",
        sourceId: summary.sourceId,
      });
    });
    item.appendChild(open);
    list.appendChild(item);
  });
}

// ============================================================
// AUTO-SCROLL — Follow video playback in transcript
// ============================================================
// While a video plays, the transcript automatically scrolls to show which
// 30-second chunk is currently being spoken. If the user manually scrolls
// (e.g., to read ahead), auto-scroll pauses and a "Follow playback" button
// appears so they can resume it. Highlight always stays active regardless.

/**
 * Starts polling the video's current time and highlighting/scrolling
 * to the matching transcript entry.
 */
function startPlaybackTracking() {
  if (!currentTranscript || !currentTranscript.length) return;

  // Don't restart if already tracking (preserves user's auto-scroll state)
  if (autoScrollInterval) return;

  autoScrollEnabled = true;
  document.getElementById("followPlaybackBtn").style.display = "none";

  // Poll video time every 500ms
  autoScrollInterval = setInterval(() => playbackTrackingTick(), 500);

  // Listen for manual scrolls on the content area
  const contentArea = document.getElementById("contentArea");
  contentArea.removeEventListener("scroll", onContentAreaScroll);
  contentArea.addEventListener("scroll", onContentAreaScroll);
}

/**
 * Stops playback tracking entirely. Called when leaving transcript tab,
 * starting a new digest, or leaving results state.
 */
function stopPlaybackTracking() {
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
  }
  autoScrollEnabled = true; // Reset for next time
  lastAutoScrollTime = 0;
  document.getElementById("followPlaybackBtn").style.display = "none";

  // Remove active highlights
  document
    .querySelectorAll(".transcript-entry.active-playback")
    .forEach((el) => {
      el.classList.remove("active-playback");
    });
}

/**
 * One tick of the playback tracker. Gets current video time from the
 * YouTube tab and highlights + scrolls to the matching transcript entry.
 */
async function playbackTrackingTick() {
  try {
    const result = await chrome.runtime.sendMessage({
      action: "relayToContent",
      payload: { action: "getCurrentTime" },
    });

    if (!result.success || !result.response) return;

    const currentTime = result.response.currentTime || 0;
    highlightActiveEntry(currentTime);
  } catch (error) {
    // Silently ignore — YouTube tab might be closed or navigated away
  }
}

/**
 * Scrolls the transcript to the entry currently being spoken (the one
 * carrying the active-playback highlight). Returns false if nothing is
 * highlighted yet. Stamps lastAutoScrollTime BEFORE scrolling so the scroll
 * events from our own smooth animation aren't mistaken for the user
 * scrolling away (which would re-disable auto-scroll immediately).
 */
function scrollToActiveEntry() {
  const activeEntry = document.querySelector(
    "#transcriptList .transcript-entry.active-playback",
  );
  if (!activeEntry) return false;

  lastAutoScrollTime = Date.now();
  activeEntry.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

/**
 * Finds the transcript entry matching the current playback time,
 * highlights it, and scrolls to it (if auto-scroll is enabled).
 *
 * @param {number} currentSeconds - Current video playback time in seconds
 */
function highlightActiveEntry(currentSeconds) {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return;

  const entries = transcriptList.querySelectorAll(".transcript-entry");
  if (entries.length === 0) return;

  // Find the entry whose time range contains the current playback time
  let activeEntry = null;
  entries.forEach((entry, index) => {
    const entrySeconds = parseInt(entry.dataset.seconds);
    const nextEntry = entries[index + 1];
    const nextSeconds = nextEntry
      ? parseInt(nextEntry.dataset.seconds)
      : Infinity;

    if (currentSeconds >= entrySeconds && currentSeconds < nextSeconds) {
      activeEntry = entry;
    }
  });

  if (!activeEntry) return;

  // Skip if this entry is already highlighted (no DOM thrashing)
  if (activeEntry.classList.contains("active-playback")) return;

  // Remove old highlight, add new one
  entries.forEach((e) => e.classList.remove("active-playback"));
  activeEntry.classList.add("active-playback");

  // Only scroll if auto-scroll is enabled
  if (autoScrollEnabled) {
    lastAutoScrollTime = Date.now();
    activeEntry.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Scroll event handler for the content area.
 * Detects manual scrolling and disables auto-scroll so the user
 * can read at their own pace without being yanked back.
 */
function onContentAreaScroll() {
  // Ignore scroll events within 1 second of a programmatic scroll
  // (smooth scroll animations can last longer than a simple boolean flag)
  if (Date.now() - lastAutoScrollTime < 1000) return;

  // User scrolled manually — disable auto-scroll and show the button
  if (autoScrollEnabled && autoScrollInterval) {
    autoScrollEnabled = false;
    document.getElementById("followPlaybackBtn").style.display = "block";
  }
}

// ============================================================
// TRANSCRIPT MODE UI — Original / Chinese / aligned bilingual
// ============================================================

const savedTranscriptMarkers = new Map();

function savedMarkerState(videoId) {
  let state = savedTranscriptMarkers.get(videoId);
  if (!state) {
    state = { capturedSeconds: new Set(), segmentIds: new Set() };
    savedTranscriptMarkers.set(videoId, state);
  }
  return state;
}

function recordSavedTranscriptMarker({ videoId, capturedSecond, segmentId } = {}) {
  if (!SAVE_VIDEO_ID_PATTERN.test(videoId || "")) return;
  const state = savedMarkerState(videoId);
  if (Number.isInteger(capturedSecond) && capturedSecond >= 0 && capturedSecond <= SAVE_LIMITS.maxSeconds) {
    state.capturedSeconds.add(capturedSecond);
  }
  if (typeof segmentId === "string" && segmentId) state.segmentIds.add(segmentId);
}

function isTranscriptSegmentSaved(segment, index, segments, videoId = currentVideoId) {
  const state = savedTranscriptMarkers.get(videoId);
  if (!state || !segment) return false;
  if (state.segmentIds.has(segment.id)) return true;
  const start = parseInt(segment.start);
  const nextStart = segments[index + 1]
    ? parseInt(segments[index + 1].start)
    : Infinity;
  return Number.isFinite(start) && [...state.capturedSeconds].some((second) =>
    second >= start && second < nextStart,
  );
}

function updateTranscriptSavedButtons() {
  const rows = [...document.querySelectorAll("#transcriptList .transcript-entry")];
  if (!rows.length) return;
  const segments = getActiveTranscriptSegments();
  rows.forEach((row, index) => {
    const button = row.querySelector(".transcript-save-btn");
    const segment = segments.find(({ id }) => id === row.dataset.segmentId) || segments[index];
    if (!button || !segment) return;
    if (isTranscriptSegmentSaved(segment, segments.indexOf(segment), segments)) {
      button.textContent = "Saved";
      button.disabled = true;
    } else if (button.textContent === "Saved") {
      button.textContent = "Save";
      button.disabled = false;
    }
  });
}

function getOriginalTranscriptLabel() {
  return "Native Simplified Chinese";
}

function getActiveTranscriptSegments() {
  return groupTranscriptEntries(currentTranscript || []);
}

function transcriptTranslationCacheKey(segment, videoId = currentVideoId) {
  return `${videoId}:en:semantic:${segment.id}`;
}

function clearTranscriptParagraphCache(videoId) {
  const prefix = `${videoId}:en:semantic:`;
  for (const key of transcriptParagraphCache.keys()) {
    if (key.startsWith(prefix)) transcriptParagraphCache.delete(key);
  }
}

function primeTranscriptParagraphCache(transcript, videoId) {
  if (!Array.isArray(transcript)) return;
  transcript.forEach((segment) => {
    const id = segment?.stableId || segment?.id;
    const english = typeof segment?.englishTranslation === "string"
      ? segment.englishTranslation.trim()
      : "";
    if (!id || !english) return;
    transcriptParagraphCache.set(transcriptTranslationCacheKey({ id }, videoId), english);
  });
}

function setTranscriptModeButtons(mode) {
  document.querySelectorAll(".transcript-mode-btn").forEach((button) => {
    const active = button.dataset.transcriptMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

async function handleTranscriptModeChange(mode) {
  if (!["zh", "en", "bilingual"].includes(mode)) return;
  if (mode === currentTranscriptMode) return;

  currentTranscriptMode = mode;
  translationGeneration += 1;
  translationWorkCount = 0;
  retryFailedTranslationsInFlight = false;
  retryFailedTranslationsCount = 0;
  setTranslatingSpinner(false);
  if (transcriptScrollObserver) transcriptScrollObserver.disconnect();
  transcriptScrollObserver = null;
  setTranscriptModeButtons(mode);

  if (mode === "zh") {
    renderTranscript();
    return;
  }

  await translateTranscript();
}

function renderTranscriptSegmentContent(segment, mode, translated, error) {
  const original = renderSubtitleInlineMarkup(segment.text);
  let translationHtml = "";
  if (translated) {
    translationHtml = renderSubtitleInlineMarkup(translated);
  } else if (error) {
    translationHtml = `${escapeHtml(error)}<button class="translation-retry-btn" type="button">Retry</button>`;
  } else {
    translationHtml = "Waiting for translation…";
  }

  if (mode === "zh") {
    return `<span class="transcript-copy"><span class="transcript-original">${original}</span></span>`;
  }
  if (mode === "bilingual") {
    return `<span class="transcript-copy"><span class="transcript-original">${original}</span><span class="transcript-translation ${translated ? "" : error ? "translation-error" : "translation-pending"}">${translationHtml}</span></span>`;
  }

  return `<span class="transcript-copy"><span class="transcript-translation ${translated ? "" : error ? "translation-error" : "translation-pending"}">${translationHtml}</span></span>`;
}

function renderTranscriptModeRows(segments, mode) {
  const transcriptList = document.getElementById("transcriptList");
  if (!transcriptList) return [];
  transcriptList.innerHTML = "";

  const existingBadge = document.getElementById("transcriptSourceBadge");
  if (existingBadge) existingBadge.remove();
  const badge = document.createElement("div");
  badge.id = "transcriptSourceBadge";
  badge.className = "transcript-source-badge";
  const originalLabel = getOriginalTranscriptLabel();
  const modeLabel =
    mode === "bilingual"
      ? `${originalLabel} + English`
      : `English · translated from ${originalLabel}`;
  badge.innerHTML = `<span class="source-dot source-dot--subs"></span> From video subtitles · ${modeLabel}`;
  transcriptList.parentElement.insertBefore(badge, transcriptList);

  const rows = [];
  segments.forEach((segment, index) => {
    const div = document.createElement("div");
    const cached = transcriptParagraphCache.get(
      transcriptTranslationCacheKey(segment),
    );
    div.className = `transcript-entry ${cached ? "translated" : "translating"}`;
    div.dataset.seconds = segment.start;
    div.dataset.endSeconds = segment.end;
    div.dataset.segmentId = segment.id;
    div.dataset.segmentIndex = index;

    const minutes = Math.floor(segment.start / 60);
    const seconds = Math.floor(segment.start % 60);
    const timestamp = `${minutes}:${String(seconds).padStart(2, "0")}`;
    const saved = isTranscriptSegmentSaved(segment, index, segments);
    div.innerHTML = `
      <span class="transcript-time">${timestamp}</span>
      ${renderTranscriptSegmentContent(segment, mode, cached, "")}
      <button class="transcript-save-btn" type="button"${saved ? " disabled" : ""}>${saved ? "Saved" : "Save"}</button>
    `;
    div.addEventListener("click", (event) =>
      seekFromTranscriptEntryClick(event, segment.start),
    );
    const saveButton = div.querySelector(".transcript-save-btn");
    saveButton.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await saveTranscriptRow(segment, saveButton);
      } catch (saveError) {
        console.error("[Popcorn] Save subtitle row failed:", saveError);
      }
    });
    transcriptList.appendChild(div);
    rows.push(div);
  });

  startPlaybackTracking();
  updateRetryFailedTranslationsButton();
  return rows;
}

/**
 * Rebuilds a provider response in source order. Unknown IDs are ignored and
 * missing IDs remain explicit errors, never positional guesses.
 */
function alignTranslatedSegmentBatch(sourceSegments, responseSegments, { pending = false } = {}) {
  const translatedById = new Map();
  const duplicateIds = new Set();
  const seenIds = new Set();
  if (Array.isArray(responseSegments)) {
    responseSegments.forEach((item) => {
      if (!item || typeof item.id !== "string") return;
      if (seenIds.has(item.id)) duplicateIds.add(item.id);
      seenIds.add(item.id);
      if (typeof item.english !== "string") return;
      const text = item.english.trim();
      if (text) {
        translatedById.set(item.id, text);
      }
    });
  }
  duplicateIds.forEach((id) => translatedById.delete(id));

  return sourceSegments.map((segment) => ({
    id: segment.id,
    text: translatedById.get(segment.id) || "",
    error: translatedById.has(segment.id)
      ? ""
      : pending
        ? "Translation is still processing. Please Retry."
        : "Translation unavailable.",
  }));
}

function updateTranslatedRow(segment, index, alignedItem, generation) {
  if (generation !== translationGeneration) return;
  const row = document.querySelector(
    `.transcript-entry[data-segment-id="${CSS.escape(segment.id)}"]`,
  );
  if (!row) return;

  if (alignedItem.text) {
    transcriptParagraphCache.set(
      transcriptTranslationCacheKey(segment),
      alignedItem.text,
    );
  }

  const copy = row.querySelector(".transcript-copy");
  if (copy) {
    copy.outerHTML = renderTranscriptSegmentContent(
      segment,
      currentTranscriptMode,
      alignedItem.text,
      alignedItem.error,
    );
  }
  row.classList.toggle("translated", !!alignedItem.text);
  row.classList.toggle("translating", false);
  row.classList.toggle("translation-failed", !alignedItem.text);
  updateRetryFailedTranslationsButton();

  const retry = row.querySelector(".translation-retry-btn");
  if (retry) {
    ["mousedown", "mouseup"].forEach((eventName) => {
      retry.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    retry.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      retryTranslationSegment(index, generation);
    });
  }
}

let activeTranslationQueue = null;

async function requestTranscriptTranslationBatch(
  indices,
  segments,
  generation,
  videoId,
  mode,
) {
  const sourceBatch = indices.map((index) => segments[index]);
  setTranslatingSpinner(true);
  try {
    const result = await sendTranslationMessage({
      action: "translateSegments",
      videoId: currentVideoId,
      snapshotId: currentSnapshotId,
      segmentIds: sourceBatch.map(({ id }) => id),
    });

    const isStale =
      generation !== translationGeneration ||
      videoId !== currentVideoId ||
      mode !== currentTranscriptMode;
    if (isStale) return;

    const responseSegments = result?.success
      ? result.content?.segments
      : [];
    const aligned = alignTranslatedSegmentBatch(sourceBatch, responseSegments, {
      pending: result?.success && result.pending,
    });
    aligned.forEach((item, batchIndex) => {
      if (!result?.success) {
        item.error = learningArtifactStatusCopy(result, "Translation");
      }
      updateTranslatedRow(
        sourceBatch[batchIndex],
        indices[batchIndex],
        item,
        generation,
      );
    });
    await updateCache();
  } catch (error) {
    if (generation !== translationGeneration) return;
    sourceBatch.forEach((segment, batchIndex) => {
      updateTranslatedRow(
        segment,
        indices[batchIndex],
        { id: segment.id, text: "", error: error.message || "Translation failed." },
        generation,
      );
    });
  } finally {
    setTranslatingSpinner(false);
  }
}

function retryTranslationSegment(index, generation) {
  if (generation !== translationGeneration || !activeTranslationQueue) return;
  const row = document.querySelector(
    `.transcript-entry[data-segment-index="${index}"]`,
  );
  if (row) {
    row.classList.add("translating");
    row.classList.remove("translation-failed");
    const translation = row.querySelector(".transcript-translation");
    if (translation) {
      translation.className = "transcript-translation translation-pending";
      translation.textContent = "Retrying…";
    }
  }
  updateRetryFailedTranslationsButton();
  activeTranslationQueue.enqueue(index, true);
}

function failedTranslationRows() {
  return [...document.querySelectorAll(".transcript-entry.translation-failed")];
}

function updateRetryFailedTranslationsButton() {
  const button = document.getElementById("retryFailedTranslationsBtn");
  if (!button) return;
  const count = failedTranslationRows().length;
  const visibleCount = retryFailedTranslationsInFlight
    ? retryFailedTranslationsCount
    : count;
  button.hidden = !retryFailedTranslationsInFlight && count === 0;
  button.disabled = retryFailedTranslationsInFlight || count === 0;
  button.textContent = `Retry failed (${visibleCount})`;
}

function markTranscriptRowRetrying(row) {
  row.classList.add("translating");
  row.classList.remove("translation-failed");
  const translation = row.querySelector(".transcript-translation");
  if (translation) {
    translation.className = "transcript-translation translation-pending";
    translation.textContent = "Retrying…";
  }
}

async function retryFailedTranslations() {
  if (retryFailedTranslationsInFlight || currentTranscriptMode === "zh") return;
  const rows = failedTranslationRows();
  if (!rows.length || !currentVideoId || !currentSnapshotId) return;

  const segments = getActiveTranscriptSegments();
  const indexById = new Map(segments.map((segment, index) => [segment.id, index]));
  const selected = rows.map((row) => {
    const id = row.dataset.segmentId || "";
    const index = indexById.get(id);
    return index === undefined ? null : { row, segment: segments[index], index };
  });
  if (selected.some((item) => item === null)) return;

  const selectedRows = selected;
  const ids = selectedRows.map(({ segment }) => segment.id);
  if (new Set(ids).size !== ids.length) return;

  const generation = translationGeneration;
  const videoId = currentVideoId;
  const snapshotId = currentSnapshotId;
  const mode = currentTranscriptMode;
  retryFailedTranslationsInFlight = true;
  retryFailedTranslationsCount = selectedRows.length;
  selectedRows.forEach(({ row }) => markTranscriptRowRetrying(row));
  updateRetryFailedTranslationsButton();

  const isStale = () =>
    generation !== translationGeneration ||
    videoId !== currentVideoId ||
    snapshotId !== currentSnapshotId ||
    mode !== currentTranscriptMode;

  try {
    const result = await sendTranslationMessage({
      action: "translateSegments",
      videoId,
      snapshotId,
      segmentIds: ids,
      retryId: crypto.randomUUID(),
    });
    if (isStale()) return;

    const aligned = alignTranslatedSegmentBatch(
      selectedRows.map(({ segment }) => segment),
      result?.success ? result.content?.segments : [],
      { pending: result?.success && result.pending },
    );
    aligned.forEach((item, selectedIndex) => {
      if (!result?.success) {
        item.error = learningArtifactStatusCopy(result, "Translation");
      }
      const selectedRow = selectedRows[selectedIndex];
      updateTranslatedRow(selectedRow.segment, selectedRow.index, item, generation);
    });
    await updateCache();
  } catch (error) {
    if (isStale()) return;
    selectedRows.forEach(({ segment, index }) => {
      updateTranslatedRow(
        segment,
        index,
        { id: segment.id, text: "", error: error.message || "Translation failed." },
        generation,
      );
    });
  } finally {
    if (!isStale()) {
      retryFailedTranslationsInFlight = false;
      retryFailedTranslationsCount = 0;
      updateRetryFailedTranslationsButton();
    }
  }
}

/**
 * Renders immediately, translates the first small batch, then observes the
 * remaining rows. Batches are sequential so the provider is never flooded.
 */
async function translateTranscript() {
  const segments = getActiveTranscriptSegments();
  if (!segments.length || currentTranscriptMode === "zh") return;

  translationGeneration += 1;
  const generation = translationGeneration;
  const videoId = currentVideoId;
  const mode = currentTranscriptMode;
  if (transcriptScrollObserver) transcriptScrollObserver.disconnect();

  const rows = renderTranscriptModeRows(segments, mode);
  const queue = [];
  const queued = new Set();
  let processing = false;

  const processNext = async () => {
    if (processing || queue.length === 0 || generation !== translationGeneration)
      return;
    processing = true;
    const indices = queue.splice(0, 3);
    indices.forEach((index) => queued.delete(index));
    try {
      await requestTranscriptTranslationBatch(
        indices,
        segments,
        generation,
        videoId,
        mode,
      );
    } finally {
      processing = false;
      if (queue.length && generation === translationGeneration) processNext();
    }
  };

  const enqueue = (index, force = false) => {
    if (!Number.isInteger(index) || !segments[index]) return;
    const cached = transcriptParagraphCache.has(
      transcriptTranslationCacheKey(segments[index]),
    );
    if ((!force && cached) || queued.has(index)) return;
    queue.push(index);
    queued.add(index);
    // Let all entries reported in the same viewport turn collect before the
    // worker starts, producing one small contextual multi-segment request.
    Promise.resolve().then(processNext);
  };
  activeTranslationQueue = { enqueue };

  transcriptScrollObserver = new IntersectionObserver(
    (observerEntries) => {
      observerEntries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (a, b) =>
            Number(a.target.dataset.segmentIndex) -
            Number(b.target.dataset.segmentIndex),
        )
        .forEach((entry) => enqueue(Number(entry.target.dataset.segmentIndex)));
    },
    {
      root: document.getElementById("contentArea"),
      rootMargin: "320px 0px",
      threshold: 0,
    },
  );

  rows.forEach((row, index) => {
    if (!row.classList.contains("translated")) transcriptScrollObserver.observe(row);
    if (index < 3) enqueue(index);
  });
}

function setTranslatingSpinner(show) {
  if (show) translationWorkCount += 1;
  else translationWorkCount = Math.max(0, translationWorkCount - 1);
  const isTranslating = translationWorkCount > 0;
  const spinner = document.getElementById("langSpinner");
  if (spinner) spinner.classList.toggle("visible", isTranslating);
}

// Pure helpers are exposed for the repository's Node tests. The extension does
// not read this object at runtime.
globalThis.__YTD_TRANSCRIPT_TESTING__ = {
  sendTranslationMessage,
  groupTranscriptEntries,
  splitOversizedThought,
  alignTranslatedSegmentBatch,
  retryFailedTranslations,
  retryTranslationSegment,
  renderSubtitleInlineMarkup,
  renderTranscriptSegmentContent,
  projectTranscriptSelection,
  createExplanationMessage,
  renderAnalysisResults,
  formatTimestampSeconds,
  getTranscriptErrorPresentation,
  triggerAnalysis,
  retryOverview,
};

globalThis.__YTD_SAVE_TESTING__ = {
  buildVideoSaveInput,
  buildSubtitleRowSaveInput,
  buildSubtitleSelectionSaveInput,
  buildKeyQuoteSaveInput,
  buildAiExplanationSaveInput,
  assertExactSavedItemInput,
  createSaveController,
  createSaveStatusPresenter,
  saveWithFeedback,
  showUnsupportedYouTube,
};
