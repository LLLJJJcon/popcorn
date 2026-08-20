const YTD_OPTIONS = (() => {
  const PREVIEW_STORAGE_PREFIX = "popcornPreview:";

  function createStorageAdapter(chromeApi, fallbackStorage) {
    const chromeStorage = chromeApi?.storage?.local;
    const memoryStorage = new Map();
    return {
      async get(keys) {
        if (chromeStorage) return chromeStorage.get(keys);
        const requested = keys === null ? [...memoryStorage.keys()] : (Array.isArray(keys) ? keys : [keys]);
        return Object.fromEntries(requested.map((key) => [key, memoryStorage.get(key)]).filter(([, value]) => value !== undefined));
      },
      async set(items) {
        if (chromeStorage) return chromeStorage.set(items);
        for (const [key, value] of Object.entries(items)) {
          memoryStorage.set(key, value);
          try { fallbackStorage?.setItem(`${PREVIEW_STORAGE_PREFIX}${key}`, JSON.stringify(value)); } catch (_error) {}
        }
      },
      async remove(keys) {
        if (chromeStorage) return chromeStorage.remove(keys);
        for (const key of Array.isArray(keys) ? keys : [keys]) memoryStorage.delete(key);
      },
    };
  }

  function initialize(root = globalThis) {
    const doc = root.document;
    if (!doc || !root.chrome?.runtime?.sendMessage) return;
    const email = doc.getElementById("accountEmail");
    const signIn = doc.getElementById("signInBtn");
    const signOut = doc.getElementById("signOutBtn");
    const authStatus = doc.getElementById("authStatus");
    const syncStatus = doc.getElementById("syncStatus");
    const signOutChoice = doc.getElementById("signOutChoice");
    const discard = doc.getElementById("discardPendingBtn");
    const dataStatus = doc.getElementById("dataStatus");

    async function sendAuthCommand(command, extra = {}) {
      const response = await root.chrome.runtime.sendMessage({ command, ...extra });
      if (!response?.ok) throw new Error("The sign-in request was rejected.");
      return response;
    }

    async function sendQueueCommand(action) {
      const response = await root.chrome.runtime.sendMessage({ action });
      if (response?.success === false) throw new Error("The sync request was rejected.");
      return response;
    }

    async function renderSession() {
      const { account } = await sendAuthCommand("popcorn-auth:session");
      email.textContent = account?.email ?? "Not signed in";
      signIn.hidden = !!account;
      signOut.hidden = !account;
      const summary = await sendQueueCommand("getSyncSummary");
      syncStatus.textContent = account
        ? (summary.pendingCount ? `${summary.pendingCount} saved moment${summary.pendingCount === 1 ? "" : "s"} waiting to sync.` : "Ready to sync saved moments.")
        : "Sign in to sync saved moments.";
    }
    signIn.addEventListener("click", async () => {
      authStatus.textContent = "Opening Popcorn sign-in…";
      try { await sendAuthCommand("popcorn-auth:begin", { userInitiated: true }); authStatus.textContent = "Signed in."; await renderSession(); } catch (_error) { authStatus.textContent = "Sign-in was not completed."; }
    });
    signOut.addEventListener("click", async () => {
      const result = await sendAuthCommand("popcorn-auth:sign-out");
      if (result.requiresDecision) { signOutChoice.hidden = false; discard.hidden = false; return; }
      await renderSession();
    });
    discard.addEventListener("click", async () => { await sendQueueCommand("discardPendingEvents"); await sendAuthCommand("popcorn-auth:sign-out"); signOutChoice.hidden = true; discard.hidden = true; await renderSession(); });
    doc.getElementById("clearCacheBtn").addEventListener("click", async () => {
      try {
        const { clearedCount } = await sendAuthCommand("popcorn-auth:clear-cache");
        dataStatus.textContent = `Cleared ${clearedCount} cached item${clearedCount === 1 ? "" : "s"}.`;
      } catch (_error) {
        dataStatus.textContent = "Could not clear the bounded cache.";
      }
    });
    void renderSession().catch(() => { authStatus.textContent = "Could not check Popcorn sign-in."; });
  }

  return { createStorageAdapter, initialize };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YTD_OPTIONS;
if (typeof document !== "undefined") YTD_OPTIONS.initialize();
