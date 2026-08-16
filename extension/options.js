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
    const auth = root.POPCORN_AUTH?.createAuthClient?.({ chrome: root.chrome, appUrl: "https://app.popcorn.local" });
    if (!doc || !auth) return;
    const storage = createStorageAdapter(root.chrome, root.localStorage);
    const email = doc.getElementById("accountEmail");
    const signIn = doc.getElementById("signInBtn");
    const signOut = doc.getElementById("signOutBtn");
    const authStatus = doc.getElementById("authStatus");
    const syncStatus = doc.getElementById("syncStatus");
    const signOutChoice = doc.getElementById("signOutChoice");
    const discard = doc.getElementById("discardPendingBtn");
    const dataStatus = doc.getElementById("dataStatus");

    async function renderSession() {
      const session = await auth.getSession();
      email.textContent = session?.user.email ?? "Not signed in";
      signIn.hidden = !!session;
      signOut.hidden = !session;
      syncStatus.textContent = session ? "Ready to sync saved moments." : "Sign in to sync saved moments.";
    }
    signIn.addEventListener("click", async () => {
      authStatus.textContent = "Opening Popcorn sign-in…";
      try { await auth.beginInteractiveSignIn({ userInitiated: true }); authStatus.textContent = "Signed in."; await renderSession(); } catch (_error) { authStatus.textContent = "Sign-in was not completed."; }
    });
    signOut.addEventListener("click", async () => {
      const result = await auth.signOut();
      if (result.requiresDecision) { signOutChoice.hidden = false; discard.hidden = false; return; }
      await renderSession();
    });
    discard.addEventListener("click", async () => { await auth.signOut({ decision: "discard" }); signOutChoice.hidden = true; discard.hidden = true; await renderSession(); });
    doc.getElementById("clearCacheBtn").addEventListener("click", async () => {
      const all = await storage.get(null);
      const keys = Object.keys(all).filter((key) => key.startsWith(YTD_SETTINGS.DEFAULTS.boundedCachePrefix));
      if (keys.length) await storage.remove(keys);
      dataStatus.textContent = `Cleared ${keys.length} cached item${keys.length === 1 ? "" : "s"}.`;
    });
    void auth.initialize().then(renderSession);
  }

  return { createStorageAdapter, initialize };
})();

if (typeof module !== "undefined" && module.exports) module.exports = YTD_OPTIONS;
if (typeof document !== "undefined") YTD_OPTIONS.initialize();
