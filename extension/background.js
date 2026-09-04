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
  const response = await fetch(`${POPCORN_API_ORIGIN}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
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

function normalizeTranscriptResult(data) {
  const snapshot = data?.snapshot;
  if (!snapshot || snapshot.language !== "zh-CN" || !Array.isArray(snapshot.segments)) {
    throw new Error("Popcorn returned an invalid native Chinese transcript.");
  }
  const transcript = snapshot.segments.map((segment) => ({
    id: segment.stableId,
    stableId: segment.stableId,
    text: segment.originalChinese,
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

/** Adapted from pinned handleFetchTranscript: canonical ID in, normalized rows out. */
async function handleFetchTranscript(videoId, jobId) {
  if (jobId) {
    const status = await pollTranscriptJob(jobId);
    if (["pending", "leased", "retryable_failed"].includes(status.status)) {
      return { success: true, pending: true, jobId, status: status.status };
    }
    if (status.status !== "succeeded" || !status.result?.snapshotId) {
      return { success: false, error: status.lastErrorCode || "TRANSCRIPT_UNAVAILABLE" };
    }
  }
  const result = await apiFetch(`/api/v1/youtube/${encodeURIComponent(videoId)}/transcript`, { method: "GET" });
  if (result.status === 202) {
    return { success: true, pending: true, jobId: result.data.jobId, status: "pending" };
  }
  return normalizeTranscriptResult(result.data);
}

async function submitArtifact(path, payload, jobId) {
  if (jobId) {
    const status = await pollTranscriptJob(jobId);
    if (["pending", "leased", "retryable_failed"].includes(status.status)) {
      return { success: true, pending: true, jobId, status: status.status };
    }
    if (status.status !== "succeeded" || !status.result?.artifactId) {
      return {
        success: false,
        error: "The learning artifact could not be completed. Check your model gateway settings and retry.",
      };
    }
  }
  const result = await apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
  if (result.status === 202) {
    return { success: true, pending: true, jobId: result.data.jobId, status: result.data.status };
  }
  return { success: true, artifactId: result.data.artifactId, content: result.data.content };
}

async function requestOverview(message) {
  return submitArtifact(
    `/api/v1/youtube/${encodeURIComponent(message.videoId)}/overview`,
    { snapshotId: message.snapshotId },
    message.jobId,
  );
}

async function translateSegments(message) {
  return submitArtifact(
    `/api/v1/youtube/${encodeURIComponent(message.videoId)}/translations`,
    { snapshotId: message.snapshotId, segmentIds: message.segmentIds },
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
    return respondFrom(queue.enqueueSavedItem(message.input), sendResponse);
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
  getPlayerVideoDetails,
};
