/**
 * YouTube Digest's classic MV3 message router, adapted for Popcorn cloud work.
 * Authentication remains service-worker-owned; Side Panel/content messages
 * never receive access or refresh tokens.
 */
importScripts("runtime-config.js");
importScripts("settings.js", "auth.js");
importScripts("sync-queue.js");

const debugLog = () => {};
const popcornRuntimeConfig = globalThis.POPCORN_RUNTIME_CONFIG;
const POPCORN_API_ORIGIN = popcornRuntimeConfig?.appUrl;
const LOCAL_SERVICE_FETCH_FAILURE = Symbol("local-service-fetch-failure");

const popcornAuthClient = POPCORN_AUTH.createAuthClient({
  chrome,
  supabaseUrl: popcornRuntimeConfig?.supabaseUrl,
  anonKey: popcornRuntimeConfig?.supabaseAnonKey,
  boundedCachePrefix: YTD_SETTINGS.DEFAULTS.boundedCachePrefix,
});
const popcornAuthMessages = POPCORN_AUTH.createAuthMessageHandler({
  chrome,
  authClient: popcornAuthClient,
});

function ensurePopcornAuthReady() {
  return popcornAuthClient.initialize();
}

async function getPopcornAccessToken() {
  await ensurePopcornAuthReady();
  return popcornAuthClient.getAccessToken();
}

function isTrustedExtensionPageSender(sender, page) {
  const pageUrl = chrome.runtime.getURL(page);
  return !!sender &&
    sender.id === chrome.runtime.id &&
    sender.url === pageUrl &&
    (sender.tab === undefined ||
      (Number.isInteger(sender.tab?.id) && sender.tab.url === pageUrl));
}

function isPopcornAuthSender(sender) {
  return isTrustedExtensionPageSender(sender, "options.html");
}

function isTrustedSidePanelSender(sender) {
  return isTrustedExtensionPageSender(sender, "sidepanel.html");
}

function isYoutubeWatchUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      url.hostname === "www.youtube.com" &&
      url.pathname === "/watch" &&
      /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get("v") || "");
  } catch {
    return false;
  }
}

function youtubeVideoIdFromWatchUrl(value) {
  if (!isYoutubeWatchUrl(value)) return null;
  return new URL(value).searchParams.get("v");
}

function isTrustedYoutubeContentSender(sender) {
  return !!sender &&
    sender.id === chrome.runtime.id &&
    Number.isInteger(sender.tab?.id) &&
    isYoutubeWatchUrl(sender.url) &&
    isYoutubeWatchUrl(sender.tab?.url);
}

async function apiFetch(path, options = {}) {
  const token = await getPopcornAccessToken();
  let response;
  try {
    response = await fetch(`${POPCORN_API_ORIGIN}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    const error = new Error("The local Popcorn service is unavailable.");
    error[LOCAL_SERVICE_FETCH_FAILURE] = true;
    error.code = "LOCAL_SERVICE_UNAVAILABLE";
    throw error;
  }
  const body = await response.json().catch(() => null);
  if (!body || body.ok !== true) {
    const error = new Error(body?.error?.message || "Popcorn request failed.");
    error.code = body?.error?.code || "INTERNAL_ERROR";
    error.retryable = !!body?.error?.retryable;
    throw error;
  }
  return { status: response.status, data: body.data };
}

let popcornSyncQueue;
function getPopcornSyncQueue() {
  if (!popcornSyncQueue && globalThis.POPCORN_SYNC_QUEUE?.createSyncQueue) {
    popcornSyncQueue = globalThis.POPCORN_SYNC_QUEUE.createSyncQueue({
      chrome,
      authClient: popcornAuthClient,
      apiFetch,
    });
  }
  return popcornSyncQueue || null;
}

/** One independent bounded status lookup; no long service-worker poll loop. */
async function pollTranscriptJob(jobId) {
  const result = await apiFetch(`/api/v1/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
  return result.data;
}

const LEARNING_ARTIFACT_FAILURE_COPY = Object.freeze({
  model_output: "The model response could not be read. Retry this learning artifact.",
  model_unavailable: "The model is unavailable right now. Check your model gateway and retry.",
  internal: "Popcorn could not finish this learning artifact. Retry.",
});

function publicLearningArtifactFailure(status) {
  const failureCategory = Object.hasOwn(
    LEARNING_ARTIFACT_FAILURE_COPY,
    status?.failureCategory,
  )
    ? status.failureCategory
    : null;
  return {
    success: false,
    ...(status?.status === "terminal_failed" ? { terminal: true } : {}),
    ...(failureCategory ? { failureCategory } : {}),
    error: failureCategory
      ? LEARNING_ARTIFACT_FAILURE_COPY[failureCategory]
      : "The learning artifact could not be completed. Retry.",
  };
}

function normalizeTranscriptResult(data) {
  const snapshot = data?.snapshot;
  if (!snapshot || snapshot.language !== "zh-CN" || !Array.isArray(snapshot.segments)) {
    throw new Error("Popcorn returned an invalid native Chinese transcript.");
  }
  const transcript = snapshot.segments.map((segment) => ({
    id: segment.stableId,
    stableId: segment.stableId,
    text: segment.originalChinese,
    ...(typeof segment.englishTranslation === "string"
      ? { englishTranslation: segment.englishTranslation }
      : {}),
    start: segment.startSeconds,
    duration: Math.max(0, segment.endSeconds - segment.startSeconds),
    language: "zh-CN",
  }));
  return {
    success: true,
    snapshotId: data.snapshotId,
    transcriptHash: snapshot.transcriptHash,
    transcript,
    transcriptText: snapshot.plainText,
    transcriptTextTimestamped: snapshot.timestampedText,
    language: "zh-CN",
  };
}

function publicTranscriptFailure(error) {
  if (error?.code === "NATIVE_CHINESE_TRANSCRIPT_REQUIRED") {
    return {
      success: false,
      code: error.code,
      error: "No native Chinese transcript is available for this video.",
    };
  }
  if (error?.code === "TRANSCRIPT_EMPTY") {
    return {
      success: false,
      code: error.code,
      error: "No transcript is available for this video.",
    };
  }
  if (error?.[LOCAL_SERVICE_FETCH_FAILURE]) {
    return {
      success: false,
      code: "LOCAL_SERVICE_UNAVAILABLE",
      error: "The local Popcorn service is not running or reachable. Start Popcorn and try again.",
    };
  }
  return {
    success: false,
    code: "TRANSCRIPT_REQUEST_FAILED",
    error: "The transcript could not be fetched. Please try again.",
  };
}

/** Adapted from pinned handleFetchTranscript: canonical ID in, normalized rows out. */
async function handleFetchTranscript(videoId, jobId) {
  try {
    if (jobId) {
      const status = await pollTranscriptJob(jobId);
      if (["pending", "leased", "retryable_failed"].includes(status.status)) {
        return { success: true, pending: true, jobId, status: status.status };
      }
      if (status.status !== "succeeded" || !status.result?.snapshotId) {
        return publicTranscriptFailure({ code: status.lastErrorCode || "TRANSCRIPT_UNAVAILABLE" });
      }
      const result = await apiFetch(
        `/api/v1/youtube/${encodeURIComponent(videoId)}/transcript?snapshotId=${encodeURIComponent(status.result.snapshotId)}`,
        { method: "GET" },
      );
      return normalizeTranscriptResult(result.data);
    }
    const result = await apiFetch(`/api/v1/youtube/${encodeURIComponent(videoId)}/transcript`, { method: "GET" });
    if (result.status === 202) {
      return { success: true, pending: true, jobId: result.data.jobId, status: "pending" };
    }
    return normalizeTranscriptResult(result.data);
  } catch (error) {
    return publicTranscriptFailure(error);
  }
}

async function submitArtifact(path, payload, jobId) {
  if (jobId) {
    const status = await pollTranscriptJob(jobId);
    if (["pending", "leased", "retryable_failed"].includes(status.status)) {
      return { success: true, pending: true, jobId, status: status.status };
    }
    if (status.status !== "succeeded" || !status.result?.artifactId) {
      return publicLearningArtifactFailure(status);
    }
  }
  const result = await apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
  if (result.status === 202) {
    return { success: true, pending: true, jobId: result.data.jobId, status: result.data.status };
  }
  return { success: true, artifactId: result.data.artifactId, content: result.data.content };
}

async function requestOverview(message) {
  const payload = { snapshotId: message.snapshotId };
  if (typeof message.retryId === "string") payload.retryId = message.retryId;
  return submitArtifact(
    `/api/v1/youtube/${encodeURIComponent(message.videoId)}/overview`,
    payload,
    message.jobId,
  );
}

async function translateSegments(message) {
  const payload = {
    snapshotId: message.snapshotId,
    segmentIds: message.segmentIds,
  };
  if (typeof message.retryId === "string") payload.retryId = message.retryId;
  return submitArtifact(
    `/api/v1/youtube/${encodeURIComponent(message.videoId)}/translations`,
    payload,
    message.jobId,
  );
}

async function explainSelection(message) {
  const payload = {
    videoId: message.videoId,
    snapshotId: message.snapshotId,
    selectedChinese: message.selectedChinese,
    segmentIds: message.segmentIds,
    utf16Start: message.utf16Start,
    utf16End: message.utf16End,
    startSeconds: message.startSeconds,
    endSeconds: message.endSeconds,
    context: message.context,
  };
  return submitArtifact("/api/v1/explanations", payload, message.jobId);
}

async function getSavedLibrary() {
  await ensurePopcornAuthReady();
  const session = await popcornAuthClient.getSession();
  if (!session?.user?.id) {
    const error = new Error("Sign in to view Saved.");
    error.code = "AUTH_REQUIRED";
    error.retryable = false;
    throw error;
  }
  let result;
  try {
    result = await apiFetch("/api/v1/extension/saved", { method: "GET" });
  } catch (error) {
    if (!error.code && /session (?:refresh failed|was invalidated)/i.test(error.message || "")) {
      error.message = "Your session expired. Sign in again.";
      error.code = "SESSION_EXPIRED";
      error.retryable = false;
    }
    throw error;
  }
  if (!Array.isArray(result.data)) {
    throw new Error("Popcorn returned an invalid Saved library.");
  }
  return { success: true, summaries: result.data };
}

function isSavedSourceId(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Pinned MAIN-world player metadata read, retained for exact video identity. */
async function getPlayerVideoDetails(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: () => {
        try {
          const details = document.getElementById("movie_player")
            ?.getPlayerResponse?.()?.videoDetails;
          if (!details) return null;
          return {
            title: details.title || "",
            channelName: details.author || "",
            description: details.shortDescription || "",
            duration: Number(details.lengthSeconds) || 0,
          };
        } catch {
          return null;
        }
      },
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

function respondFrom(promise, sendResponse) {
  promise.then(sendResponse).catch((error) => sendResponse({
    success: false,
    error: error.message || "Popcorn request failed.",
    code: error.code,
    retryable: !!error.retryable,
  }));
  return true;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (typeof message?.command === "string" && message.command.startsWith("popcorn-auth:")) {
    if (!isPopcornAuthSender(sender)) {
      sendResponse({ ok: false, error: "forbidden" });
      return false;
    }
    const request = ensurePopcornAuthReady()
      .then(() => popcornAuthMessages(message, sender))
      .then(async (result) => {
        const regainedAuthentication = ![
          "popcorn-auth:session",
          "popcorn-auth:sign-out",
          "popcorn-auth:clear-cache",
        ].includes(message.command);
        if (regainedAuthentication && result?.ok) {
          await getPopcornSyncQueue()?.flushPendingEvents("regained-auth");
        }
        return result;
      });
    return respondFrom(request, sendResponse);
  }

  if (message?.action === "openSidePanel") {
    if (!isTrustedYoutubeContentSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    const tabId = sender.tab.id;
    chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
    chrome.sidePanel.open({ tabId }).then(() => {
      void getPopcornSyncQueue()?.flushPendingEvents("panel-open");
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: "startDigestFromButton" }).catch(() => {});
      }, 300);
    }).catch(() => {});
    sendResponse({ success: true });
    return false;
  }

  if (message?.action === "enqueueSavedItem") {
    const trustedPlayerMoment = isTrustedYoutubeContentSender(sender) &&
      message.input?.kind === "player_moment" &&
      message.input?.youtubeVideoId === youtubeVideoIdFromWatchUrl(sender.url) &&
      message.input?.youtubeVideoId === youtubeVideoIdFromWatchUrl(sender.tab?.url);
    if (!isTrustedSidePanelSender(sender) && !trustedPlayerMoment) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    const queue = getPopcornSyncQueue();
    if (!queue) {
      sendResponse({ success: false, error: "Sync queue unavailable." });
      return false;
    }
    const queued = queue.enqueueSavedItem(message.input);
    if (!trustedPlayerMoment) return respondFrom(queued, sendResponse);
    return respondFrom(queued.then((result) => {
      if (result?.success === true) {
        try {
          void Promise.resolve(chrome.runtime.sendMessage({
            action: "playerMomentSaved",
            youtubeVideoId: message.input.youtubeVideoId,
            capturedSecond: message.input.capturedSecond,
          })).catch(() => {});
        } catch (_error) {
          // Durable queue admission already succeeded; notification is best effort.
        }
      }
      return result;
    }), sendResponse);
  }

  if (message?.action === "flushPendingEvents") {
    if (!isTrustedSidePanelSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    const queue = getPopcornSyncQueue();
    if (!queue) {
      sendResponse({ success: false, error: "Sync queue unavailable." });
      return false;
    }
    return respondFrom(queue.flushPendingEvents("panel-open"), sendResponse);
  }

  if (["getSyncSummary", "discardPendingEvents"].includes(message?.action)) {
    if (!isPopcornAuthSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    if (message.action === "getSyncSummary") {
      const queue = getPopcornSyncQueue();
      if (!queue) {
        sendResponse({ success: false, error: "Sync queue unavailable." });
        return false;
      }
      return respondFrom(queue.getSyncSummary(), sendResponse);
    }
    return respondFrom((async () => {
      const session = await popcornAuthClient.getSession();
      if (!session?.user?.id) throw new Error("No signed-in queue owner.");
      const queue = getPopcornSyncQueue();
      if (!queue) throw new Error("Sync queue unavailable.");
      return queue.discardPendingEvents(session.user.id);
    })(), sendResponse);
  }

  if (["fetchTranscript", "requestOverview", "translateSegments", "explainSelection"].includes(message?.action)) {
    if (!isTrustedSidePanelSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    if (message.action === "fetchTranscript") {
      return respondFrom(handleFetchTranscript(message.videoId, message.jobId), sendResponse);
    }
    if (message.action === "requestOverview") return respondFrom(requestOverview(message), sendResponse);
    if (message.action === "translateSegments") return respondFrom(translateSegments(message), sendResponse);
    if (message.action === "explainSelection") return respondFrom(explainSelection(message), sendResponse);
  }

  if (message?.action === "getSavedLibrary") {
    if (!isTrustedSidePanelSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    return respondFrom(getSavedLibrary(), sendResponse);
  }

  if (message?.action === "openPopcorn") {
    if (!isTrustedSidePanelSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    const url = new URL("/", POPCORN_API_ORIGIN).toString();
    return respondFrom(
      chrome.tabs.create({ url }).then(() => ({ success: true })),
      sendResponse,
    );
  }

  if (["openSavedLibrary", "openSavedDetail"].includes(message?.action)) {
    if (!isTrustedSidePanelSender(sender)) {
      sendResponse({ success: false, error: "forbidden" });
      return false;
    }
    if (message.action === "openSavedDetail" && !isSavedSourceId(message.sourceId)) {
      sendResponse({ success: false, error: "invalid saved source" });
      return false;
    }
    const suffix = message.action === "openSavedDetail" ? `/saved/${message.sourceId}` : "/saved";
    return respondFrom(
      chrome.tabs.create({ url: `${POPCORN_API_ORIGIN}${suffix}` })
        .then(() => ({ success: true })),
      sendResponse,
    );
  }

  if (message?.action === "relayToContent" && isTrustedSidePanelSender(sender)) {
    return respondFrom((async () => {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const tab = tabs.find((candidate) => candidate.url?.startsWith("https://www.youtube.com/watch"));
      if (!tab?.id) return { success: false, error: "No active YouTube video." };
      try {
        let response = await chrome.tabs.sendMessage(tab.id, message.payload);
        if (message.payload?.action === "getVideoInfo") {
          const player = await getPlayerVideoDetails(tab.id);
          if (player) response = {
            title: player.title || response?.title || "",
            channelName: player.channelName || response?.channelName || "",
            description: player.description || response?.description || "",
            duration: player.duration || response?.duration || 0,
          };
        }
        return { success: true, response };
      } catch (error) {
        return { success: false, error: error.message };
      }
    })(), sendResponse);
  }

  if (message?.action === "openOptions" && isTrustedSidePanelSender(sender)) {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }
  return false;
});

chrome.runtime.onStartup?.addListener(() => getPopcornSyncQueue()?.recoverOnStartup("startup"));
chrome.runtime.onInstalled?.addListener(() => getPopcornSyncQueue()?.recoverOnStartup("installed"));
chrome.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm?.name === "popcorn-sync-retry") return getPopcornSyncQueue()?.flushPendingEvents("alarm");
});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.setOptions({ tabId: tab.id, path: "sidepanel.html", enabled: true });
  chrome.sidePanel.open({ tabId: tab.id });
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

function updatePanelForTab(tabId, url) {
  chrome.sidePanel.setOptions({
    tabId,
    path: "sidepanel.html",
    enabled: (url || "").startsWith("https://www.youtube.com"),
  }).catch(() => {});
}
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) updatePanelForTab(tabId, changeInfo.url);
});
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    updatePanelForTab(tabId, tab.url);
  } catch {}
});

globalThis.__POPCORN_CLOUD_TESTING__ = {
  apiFetch,
  isTrustedSidePanelSender,
  isTrustedYoutubeContentSender,
  handleFetchTranscript,
  pollTranscriptJob,
  requestOverview,
  translateSegments,
  explainSelection,
  getSavedLibrary,
  getPlayerVideoDetails,
};
