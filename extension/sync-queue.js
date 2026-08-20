const POPCORN_SYNC_QUEUE = (() => {
  const PENDING_EVENTS_KEY = "popcorn_pending_events";
  const RETRY_ALARM = "popcorn-sync-retry";
  const QUEUE_BUDGET_BYTES = 5_000_000;
  const MAX_EVENT_BYTES = 64_000;
  const MAX_BATCH_SIZE = 50;
  const MAX_ATTEMPTS = 32;
  const BASE_RETRY_MS = 30_000;
  const MAX_RETRY_MS = 60 * 60 * 1000;

  function byteLength(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  }

  function normalizeEvents(stored) {
    return Array.isArray(stored?.[PENDING_EVENTS_KEY])
      ? stored[PENDING_EVENTS_KEY].filter((event) => (
        event && typeof event.ownerUserId === "string" &&
        typeof event.clientEventId === "string" && event.input &&
        Number.isInteger(event.attempts) && Number.isFinite(event.nextAttemptAt)
      ))
      : [];
  }

  function retryDelay(attempts) {
    return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, attempts - 1)));
  }

  function createSyncQueue({ chrome, authClient, apiFetch, now = () => Date.now() }) {
    if (!chrome?.storage?.local || !chrome?.alarms || !authClient || typeof apiFetch !== "function") {
      throw new Error("Popcorn sync queue requires Chrome storage, alarms, auth, and API access.");
    }

    async function readEvents() {
      return normalizeEvents(await chrome.storage.local.get(PENDING_EVENTS_KEY));
    }

    async function scheduleRetry(events, minimumWhen) {
      if (!events.length) {
        await chrome.alarms.clear(RETRY_ALARM);
        return null;
      }
      const floor = Number.isFinite(minimumWhen) ? minimumWhen : now();
      const scheduled = Math.max(floor, Math.min(
        ...events.map((event) => Number.isFinite(event.nextAttemptAt) ? event.nextAttemptAt : floor),
      ));
      await chrome.alarms.create(RETRY_ALARM, { when: scheduled });
      return scheduled;
    }

    async function hasQueueCapacity(descriptor) {
      const descriptorBytes = byteLength(descriptor) + byteLength(PENDING_EVENTS_KEY) + 8;
      if (descriptorBytes > MAX_EVENT_BYTES) return false;
      const queueBytes = await chrome.storage.local.getBytesInUse(PENDING_EVENTS_KEY);
      return queueBytes + descriptorBytes <= QUEUE_BUDGET_BYTES;
    }

    async function retrySelected(selectedKeys, ownerUserId) {
      const selected = new Set(selectedKeys);
      const latest = await readEvents();
      const updated = latest.map((event) => {
        if (!selected.has(`${event.ownerUserId}:${event.clientEventId}`)) return event;
        const attempts = Math.min(MAX_ATTEMPTS, event.attempts + 1);
        return { ...event, attempts, nextAttemptAt: now() + retryDelay(attempts) };
      });
      await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: updated });
      await scheduleRetry(updated.filter((event) => event.ownerUserId === ownerUserId));
      return updated;
    }

    async function flushPendingEvents(trigger = "manual") {
      const events = await readEvents();
      if (!events.length) {
        await scheduleRetry([]);
        return { success: true, synced: 0, pending: 0, trigger };
      }
      const session = await authClient.getSession();
      if (!session?.user?.id) {
        await scheduleRetry(events, now() + BASE_RETRY_MS);
        return { success: false, code: "AUTH_REQUIRED", synced: 0, pending: events.length, trigger };
      }
      const ownedEvents = events.filter((event) => event.ownerUserId === session.user.id);
      const due = ownedEvents.filter((event) => event.nextAttemptAt <= now()).slice(0, MAX_BATCH_SIZE);
      if (!due.length) {
        await scheduleRetry(ownedEvents);
        return { success: true, synced: 0, pending: events.length, trigger };
      }

      const selectedKeys = due.map((event) => `${event.ownerUserId}:${event.clientEventId}`);
      try {
        const response = await apiFetch("/api/v1/extension/sync", {
          method: "POST",
          body: JSON.stringify({ events: due.map((event) => event.input) }),
        });
        const results = Array.isArray(response?.data?.results) ? response.data.results : [];
        const selectedIds = new Set(due.map((event) => event.clientEventId));
        const acknowledged = new Set(results.filter((result) => (
          result?.ok === true && selectedIds.has(result.clientEventId)
        )).map((result) => result.clientEventId));
        const latest = await readEvents();
        const remaining = latest.filter((event) => !(
          event.ownerUserId === session.user.id && acknowledged.has(event.clientEventId)
        ));
        const unacknowledged = new Set(due.filter((event) => !acknowledged.has(event.clientEventId)).map((event) => `${event.ownerUserId}:${event.clientEventId}`));
        const updated = remaining.map((event) => {
          if (!unacknowledged.has(`${event.ownerUserId}:${event.clientEventId}`)) return event;
          const attempts = Math.min(MAX_ATTEMPTS, event.attempts + 1);
          return { ...event, attempts, nextAttemptAt: now() + retryDelay(attempts) };
        });
        await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: updated });
        await scheduleRetry(updated.filter((event) => event.ownerUserId === session.user.id));
        return { success: true, synced: acknowledged.size, pending: updated.length, trigger };
      } catch (_error) {
        const updated = await retrySelected(selectedKeys, session.user.id);
        return { success: true, synced: 0, pending: updated.length, code: "SYNC_RETRYING", trigger };
      }
    }

    async function enqueueSavedItem(input) {
      const session = await authClient.getSession();
      if (!session?.user?.id) {
        return { success: false, synced: false, pending: false, code: "AUTH_REQUIRED" };
      }
      if (!input || typeof input !== "object" || typeof input.clientEventId !== "string") {
        return { success: false, synced: false, pending: false, code: "VALIDATION_FAILED" };
      }
      const events = await readEvents();
      const duplicate = events.some((event) => (
        event.ownerUserId === session.user.id && event.clientEventId === input.clientEventId
      ));
      if (!duplicate) {
        const descriptor = {
          ownerUserId: session.user.id,
          clientEventId: input.clientEventId,
          input: structuredClone(input),
          attempts: 0,
          nextAttemptAt: now(),
        };
        if (!(await hasQueueCapacity(descriptor))) {
          return { success: false, synced: false, pending: false, code: "SYNC_QUEUE_FULL" };
        }
        try {
          await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: [...events, descriptor] });
        } catch (_error) {
          return { success: false, synced: false, pending: false, code: "SYNC_QUEUE_FULL" };
        }
      }
      const flushed = await flushPendingEvents("new-save");
      return {
        success: true,
        synced: flushed.synced > 0,
        pending: flushed.pending > 0,
        ...(flushed.code ? { code: flushed.code } : {}),
      };
    }

    async function getSyncSummary() {
      const events = await readEvents();
      const session = await authClient.getSession();
      const owned = session?.user?.id ? events.filter((event) => event.ownerUserId === session.user.id) : [];
      return {
        pendingCount: owned.length,
        requiresSignIn: !session && events.length > 0,
        nextRetryAt: owned.length ? Math.min(...owned.map((event) => event.nextAttemptAt)) : null,
      };
    }

    async function discardPendingEvents(ownerUserId) {
      const session = await authClient.getSession();
      if (!session?.user?.id || session.user.id !== ownerUserId) {
        throw new Error("Only the current queue owner may discard pending events.");
      }
      const events = await readEvents();
      const remaining = events.filter((event) => event.ownerUserId !== ownerUserId);
      const discardedCount = events.length - remaining.length;
      await chrome.storage.local.set({ [PENDING_EVENTS_KEY]: remaining });
      await scheduleRetry(remaining.filter((event) => event.ownerUserId === ownerUserId));
      return { discardedCount };
    }

    async function recoverOnStartup(trigger) {
      const events = await readEvents();
      await scheduleRetry(events);
      return flushPendingEvents(trigger);
    }

    return { enqueueSavedItem, flushPendingEvents, getSyncSummary, discardPendingEvents, recoverOnStartup };
  }

  return { createSyncQueue };
})();

globalThis.POPCORN_SYNC_QUEUE = POPCORN_SYNC_QUEUE;
if (typeof module !== "undefined" && module.exports) module.exports = POPCORN_SYNC_QUEUE;
