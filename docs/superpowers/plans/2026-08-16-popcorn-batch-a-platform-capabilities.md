# Popcorn Batch A YouTube Acquisition and Cloud Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapt the pinned YouTube Digest extension into an authenticated Chinese-learning acquisition surface with reliable exact saves entering Popcorn cloud storage.

**Architecture:** Keep YouTube-page and Side Panel interactions in the vendored Manifest V3 extension, but replace direct provider credentials and permanent local notes with user-scoped Popcorn APIs. The service worker alone owns the Supabase session and a compact durable event queue; all transcript polling and AI work stays server-side.

**Tech Stack:** Chrome Manifest V3/Side Panel/Identity/Storage/Alarms, plain HTML/CSS/JavaScript adapted from YouTube Digest, Next.js Route Handlers, Supabase Auth/PostgreSQL/RLS, Zod, Vitest, Playwright.

## Global Constraints

- Foundation exit gate must be green and shared contracts/migrations frozen.
- Upstream source is `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7` under MIT.
- Agents edit vendored files in place; they do not create a parallel extension UI.
- Every task below names the upstream source functions it must reuse.
- Original subtitle language must resolve to native Simplified Chinese; a provider fallback to English is rejected.
- Saving never waits for transcript polling, translation, overview, or expression extraction.
- Tokens are accessible only to trusted extension contexts; content scripts cannot read them.
- Local storage contains only bounded cache and queued event descriptors, not full transcript snapshots.
- Extension user-facing tabs are `Transcript`, `Overview`, and `Saved`.
- No generic text, URL, image, screenshot, vector, or alternate-browser work.

## Upstream Reuse Matrix

| Task | Upstream file/functions | Target | Mode |
|---|---|---|---|
| 1 | `manifest.json`, `options.*`, `settings.js` | same vendored paths | Adapt permissions and replace API-key setup with Popcorn linking. |
| 2 | `background.js:handleFetchTranscript`, `pollTranscriptJob`, response normalization | `src/server/transcript/**`, `src/server/jobs/handlers/resolve-snapshot.ts` | Move provider and polling server-side; retain normalized result shape. |
| 3 | `sidepanel.*`; `startDigest`, transcript render/seek/follow, translation and explanation functions; `background.js` message router; `prompts/*.md` | same extension paths plus server AI handlers/routes | Reuse the Side Panel and move provider work into durable Popcorn jobs. |
| 4 | No upstream persistence primitive applies | Popcorn capture repositories/routes | Implement from frozen Popcorn contracts; do not invent a second extension save path. |
| 5 | `content.js:extractVideoInfo`; `background.js:getPlayerVideoDetails`; Digest/Note injection, keyboard shortcut, timestamp, toast functions; `sidepanel.js:saveQuoteAsNote` | same vendored extension paths | Reuse metadata and interactions; adapt exact Popcorn save payloads. |
| 6 | `background.js` storage access hardening, message routing, cache eviction; `sidepanel.js` cache structure | `extension/sync-queue.js`, `background.js`, `options.js` | Adapt to owner-bound bounded queue; remove permanent local notes/full transcripts. |
| 7 | upstream tests | `extension/tests/` plus new integration tests | Preserve regression coverage and change product expectations. |

### Task 1: Replace provider-key setup with explicit Popcorn extension linking

**Files:**

- Modify: `extension/manifest.json`
- Modify: `extension/options.html`
- Modify: `extension/options.css`
- Modify: `extension/options.js`
- Modify: `extension/settings.js`
- Create: `extension/auth.js`
- Create: `src/app/auth/extension/page.tsx`
- Create: `src/app/api/v1/extension/session/exchange/route.ts`
- Test: `extension/tests/auth.test.js`
- Test: `tests/integration/extension/auth-exchange.test.ts`

**Interfaces:**

- Consumes: `EXTENSION_REDIRECT_ORIGIN`, Supabase PKCE, `chrome.identity.launchWebAuthFlow`.
- Produces: `beginInteractiveSignIn(): Promise<ExtensionSession>`, `getSession(): Promise<ExtensionSession | null>`, `getAccessToken(): Promise<string>`, `signOut(): Promise<void>`, and a single refresh mutex.

**Upstream reuse:** Adapt `manifest.json`, `options.*`, and the `chrome.storage.local` adapter pattern from `options.js`. Remove Supadata/DeepSeek key fields, model customization, provider URLs, and `checkConfig` behavior rather than rebuilding a new settings app.

- [ ] **Step 1: Write failing auth tests**

Assert an interactive flow starts only after a click, uses `chrome.identity.getRedirectURL("supabase")`, persists PKCE verifier/state in trusted `chrome.storage.session` before the worker can terminate, exchanges the one-time Supabase authorization code, stores tokens under `popcorn_session`, restricts storage access to trusted contexts, serializes simultaneous refresh calls, and never sends tokens to a content script.

```js
test("two simultaneous token requests share one refresh", async () => {
  const [a, b] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
  assert.equal(refreshCalls, 1);
  assert.equal(a, b);
});
```

Run `node --test extension/tests/auth.test.js`.

Expected: FAIL because `auth.js` does not exist.

- [ ] **Step 2: Adapt the manifest and setup UI**

Set Chrome minimum `116`, add `identity` and `alarms`, keep `sidePanel`, `storage`, `tabs`, and `scripting`, keep only YouTube and Popcorn API/auth host permissions, and remove direct Supadata/DeepSeek hosts. Use a stable public manifest key so the unpacked extension redirect identity does not change between machines.

Options shows account email, `Sign in to Popcorn`, `Sign out`, sync status, clear bounded cache, and discard pending events. It never contains provider-key fields.

- [ ] **Step 3: Implement PKCE exchange**

`beginInteractiveSignIn` generates verifier, challenge, and state; persists verifier/state in trusted session storage; and opens the Popcorn sign-in page with the exact Chrome redirect URL. The web page starts Supabase PKCE with that approved `redirectTo`. `launchWebAuthFlow` receives only the Supabase authorization `code` and state, validates origin/state, then POSTs `{ code, codeVerifier, redirectUri }` to `/api/v1/extension/session/exchange`. The route requires the configured extension redirect origin and exchanges the single-use code through Supabase; access and refresh tokens never appear in a URL and no custom authorization-code table is introduced. Clear PKCE material on success, cancellation, expiry, and explicit sign-out.

- [ ] **Step 4: Implement sign-out ownership protection**

Pending events include `ownerUserId`. Sign-out returns `{ pendingCount }`; the UI requires `sync first` or `discard`. A new session may not upload events for another user ID.

- [ ] **Step 5: Verify and commit**

```bash
node --test extension/tests/auth.test.js
pnpm vitest run tests/integration/extension/auth-exchange.test.ts
pnpm typecheck
git add extension src/app/auth/extension src/app/api/v1/extension/session tests/integration/extension
git commit -m "feat: link the extension to Popcorn accounts"
```

Expected: tests pass and no provider credential field remains in the extension.

### Task 2: Implement server-side native Chinese transcript retrieval

**Files:**

- Create: `src/server/transcript/provider.ts`
- Create: `src/server/transcript/supadata-provider.ts`
- Create: `src/server/transcript/normalize-transcript.ts`
- Create: `src/server/jobs/process-jobs.ts`
- Create: `src/server/jobs/handlers/resolve-snapshot.ts`
- Create: `src/app/api/v1/youtube/[videoId]/transcript/route.ts`
- Create: `src/app/api/v1/jobs/[jobId]/route.ts`
- Create: `src/app/api/internal/jobs/process/route.ts`
- Test: `tests/contract/transcript/supadata-provider.test.ts`
- Test: `src/server/transcript/normalize-transcript.test.ts`
- Test: `tests/integration/jobs/resolve-snapshot.test.ts`

**Interfaces:**

- Consumes: canonical YouTube ID and server-only `SUPADATA_API_KEY`.
- Produces: `requestNativeChineseTranscript(videoId): Promise<TranscriptRequestResult>` where result is `{kind:"ready", snapshot}` or `{kind:"pending", jobId}` or a typed unsupported/failure; a minimal leased job processor; and an authenticated, user-scoped job-status endpoint.

**Upstream reuse:** Move the request construction and normalized chunk shape from `background.js:handleFetchTranscript`; move `pollTranscriptJob` semantics into this task's durable `resolve-snapshot.ts` handler. Preserve `mode=native`, canonical URL stripping, offsets in milliseconds, duration conversion, caption cleanup, timestamp strings, and explicit `206` handling. Change preferred `lang=en` to `lang=zh` and validate actual return language/content.

- [ ] **Step 1: Write failing provider and durable-resolution tests**

Cover HTTP 200 chunks, 202 provider job ID, 206 missing native transcript, 401 provider configuration, 429 retryable limit, empty content, requested `zh` returning `en`, and non-Simplified Chinese content. Prove a 202 creates one user-scoped `resolve_snapshot` job, returns Popcorn's job ID rather than the provider ID, survives lease expiry, and exposes no provider payload through public status.

```ts
expect(await provider.fetch("abc123XYZ00")).toEqual({
  kind: "unsupported",
  code: "NATIVE_CHINESE_TRANSCRIPT_REQUIRED",
});
```

- [ ] **Step 2: Implement canonical provider requests**

Send only `https://www.youtube.com/watch?v=<id>` with `text=false`, `lang=zh`, and `mode=native`. Validate video ID against the shared schema before any provider call.

- [ ] **Step 3: Normalize stable transcript segments**

Stable IDs are derived from snapshot hash plus ordinal/start/end/text hash, never array position alone. Store exact cleaned Chinese text, ordinal, start/end seconds, language, and plain/timestamped renderings.

- [ ] **Step 4: Implement durable resolution and bounded status polling**

The transcript route returns a ready snapshot immediately for HTTP 200. For provider HTTP 202 it persists the provider job reference inside a leased `resolve_snapshot` job and returns `202 { jobId }`. The internal processor authenticates `INTERNAL_JOB_SECRET`, leases a bounded batch, and runs `resolve_snapshot`; the public status route requires the saved job's user and returns only status plus a schema-valid result. Side Panel polling consists of independent short requests and never depends on one service-worker lifetime.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/contract/transcript/supadata-provider.test.ts src/server/transcript/normalize-transcript.test.ts tests/integration/jobs/resolve-snapshot.test.ts
pnpm typecheck
git add src/server/transcript src/server/jobs src/app/api/v1/youtube src/app/api/v1/jobs src/app/api/internal/jobs/process tests/contract/transcript tests/integration/jobs
git commit -m "feat: resolve native Chinese transcripts durably"
```

### Task 3: Adapt the transcript, overview, and translation Side Panel

**Files:**

- Modify: `extension/sidepanel.html`
- Modify: `extension/sidepanel.css`
- Modify: `extension/sidepanel.js`
- Modify: `extension/background.js`
- Modify: `extension/prompts/analysis.md`
- Modify: `extension/prompts/explain.md`
- Modify: `extension/prompts/translation.md`
- Create: `src/server/ai/provider.ts`
- Create: `src/server/ai/prompts/youtube-overview.v1.ts`
- Create: `src/server/ai/prompts/translate-segments.v1.ts`
- Create: `src/server/ai/prompts/explain-selection.v1.ts`
- Create: `src/server/jobs/handlers/generate-overview.ts`
- Create: `src/server/jobs/handlers/translate-segments.ts`
- Create: `src/server/jobs/handlers/explain-selection.ts`
- Create: `src/app/api/v1/youtube/[videoId]/overview/route.ts`
- Create: `src/app/api/v1/youtube/[videoId]/translations/route.ts`
- Create: `src/app/api/v1/explanations/route.ts`
- Test: `extension/tests/transcript-selection.test.js`
- Test: `extension/tests/translation.test.js`
- Test: `extension/tests/release.test.js`
- Test: `tests/integration/youtube/learning-artifacts.test.ts`

**Interfaces:**

- Consumes: authenticated transcript/status APIs and the leased processor from Task 2 through service-worker `apiFetch()`.
- Produces: pinned transcript segmentation/rendering, `中文|English|Bilingual`, on-demand Overview, chapters, key quotes, explanation, timestamp navigation, retry states, and durable/versioned server jobs for `generate_overview`, `translate_segments`, and `explain_selection`.

**Upstream reuse:** Keep `normalizeCaptionText`, `splitOversizedThought`, `groupTranscriptEntries`, `startDigest`, `renderTranscript`, `seekFromTranscriptEntryClick`, `renderSubtitleInlineMarkup`, `setupExplainFeature`, `startPlaybackTracking`, `highlightActiveEntry`, `translateTranscript`, `alignTranslatedSegmentBatch`, and their DOM structure. Do not replace them with React or newly generated equivalents.

- [ ] **Step 1: Change copied tests before implementation**

Adjust expectations from Original/中文/双语 to 中文/English/Bilingual; assert original Chinese remains visible, English is lazy, stable IDs align results, selection suppresses seeking, and translation failures retry one segment. Add server tests proving each request validates user/source ownership, enqueues a bounded job, returns 202 before an AI call completes, and exposes only the authenticated user's schema-valid result.

Run:

```bash
node --test extension/tests/transcript-selection.test.js extension/tests/translation.test.js extension/tests/release.test.js
```

Expected: FAIL against the unadapted upstream labels, direction, and direct provider behavior.

- [ ] **Step 2: Replace direct providers with fast Popcorn messages**

`background.js` keeps message dispatch but routes `fetchTranscript`, `requestOverview`, `translateSegments`, and `explainSelection` through authenticated Popcorn endpoints. Each action starts or reuses a deterministic job and polls with independent short status requests; delete `requestAiCompletion`, provider settings, provider host calls, and long provider polling from the extension.

- [ ] **Step 3: Implement durable learning-artifact handlers**

Create server-only, versioned prompts and schema validators for Chinese-to-English segment translation, complete Overview/chapters/key quotes, and selected-Chinese explanation. Handlers write `generated_artifacts` under a source/payload/prompt/model result key, apply lease retry rules, and never overwrite native Chinese evidence. The extension receives only status and the final bounded artifact.

- [ ] **Step 4: Adapt copy and prompts**

Prompts use English explanations grounded in original Chinese, preserve timestamps, and never translate Chinese source evidence away. Overview remains content-focused and complete; selected explanations add meaning, tone, communicative function, and contextual fit without turning into a full lesson.

- [ ] **Step 5: Preserve lazy rendering and verify**

```bash
node --test extension/tests/transcript-selection.test.js extension/tests/translation.test.js extension/tests/release.test.js
pnpm vitest run tests/integration/youtube/learning-artifacts.test.ts
pnpm test:provenance
git diff -- extension/sidepanel.js extension/content.js
```

Expected: copied behavior remains recognizable and regression-covered; only integration, language direction, and Popcorn product states change.

- [ ] **Step 6: Commit**

```bash
git add extension/sidepanel.* extension/background.js extension/prompts extension/tests src/server/ai src/server/jobs src/app/api/v1/youtube src/app/api/v1/explanations tests/integration/youtube
git commit -m "feat: adapt YouTube Digest for Chinese learning"
```

### Task 4: Implement idempotent cloud capture APIs

**Files:**

- Create: `src/server/repositories/video-source-repository.ts`
- Create: `src/server/repositories/saved-item-repository.ts`
- Create: `src/server/repositories/knowledge-job-repository.ts`
- Create: `src/server/domain/capture-save.ts`
- Create: `src/app/api/v1/extension/sync/route.ts`
- Create: `src/app/api/v1/saved-items/route.ts`
- Test: `tests/integration/capture/save-item.test.ts`
- Test: `tests/integration/capture/sync-batch.test.ts`

**Interfaces:**

- Consumes: `SavedItemInput[]`, authenticated user.
- Produces: `captureSave(userId, input): { videoSourceId, savedItemId, status:"saved" }` and `syncBatch` preserving per-event results.

- [ ] **Step 1: Write failing atomicity and idempotency tests**

Prove one save transaction upserts one `(user_id,youtube_video_id)` parent, inserts exact raw payload, coalesces a pending knowledge job, and returns before any provider call. Replaying the same `clientEventId` returns the original row; a new event ID at the same timestamp remains a distinct deliberate save.

- [ ] **Step 2: Implement repositories with user scope**

Every repository method takes `userId` explicitly. No method accepts an optional user scope. Payload sizes and arrays are bounded by shared schemas.

- [ ] **Step 3: Implement atomic capture**

Use one database RPC transaction or server-side transaction function. The transaction contains no Supadata or AI call.

- [ ] **Step 4: Implement partial batch responses**

`syncBatch` accepts at most 50 events and returns a result for every `clientEventId`; one invalid event does not cause already-valid events to be silently retried without identity.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/integration/capture/save-item.test.ts tests/integration/capture/sync-batch.test.ts
pnpm db:test
git add src/server/repositories src/server/domain/capture-save.ts src/app/api/v1/extension/sync src/app/api/v1/saved-items tests/integration/capture
git commit -m "feat: capture exact saved moments atomically"
```

### Task 5: Adapt player, subtitle, quote, and explanation saves

**Files:**

- Modify: `extension/content.js`
- Modify: `extension/sidepanel.js`
- Modify: `extension/sidepanel.html`
- Modify: `extension/sidepanel.css`
- Test: `extension/tests/digest-button.test.js`
- Create: `extension/tests/save-payloads.test.js`

**Interfaces:**

- Consumes: the frozen `SavedItemInput` contract and an `enqueueSavedItem(input)` port supplied as a test double until Task 6 implements it.
- Produces: exact payload builders and calls to the queue port for `video`, `player_moment`, `subtitle_row`, `subtitle_selection`, `key_quote`, and `ai_explanation`.

**Upstream reuse:** Preserve `content.js:extractVideoInfo`, `background.js:getPlayerVideoDetails` with DOM fallback, `findDigestButtonHost`, `createDigestButton`, `injectDigestButton`, `scheduleDigestButtonReconciliation`, `setupButtonObserver`, `injectNoteButton`, `handleNoteKeyboardShortcut`, `saveCurrentNote`, `showNoteSavedToast`, `saveQuoteAsNote`, and selection/explanation presentation. Adapt command payloads instead of rebuilding the interaction. Construct the thumbnail from the validated YouTube ID; never trust an arbitrary client thumbnail URL.

- [ ] **Step 1: Write failing exact-payload tests**

Assert Save Video includes validated YouTube ID, canonical URL, upstream-extracted title/channel/duration/description, derived thumbnail, current position, and `requestNativeSnapshot: true`; Key Quote includes the displayed quote; explanation includes selected Chinese plus shown English explanation; subtitle selection includes segment IDs and character offsets; and player moment subtracts the upstream three-second reaction delay while remaining non-negative.

- [ ] **Step 2: Add Save Video and subtitle save controls**

Add one header `Save Video` action, a row-hover save button, and `Save` beside `Explain` for selected text. Controls use existing styles and do not change playback or open a form.

- [ ] **Step 3: Adapt quote and explanation saves**

Do not call the old timestamp-only `saveNote` path. Send exact text and source identities through `enqueueSavedItem`.

- [ ] **Step 4: Preserve lightweight feedback**

Use only `Saving…`, `Saved to Popcorn`, `Saved locally; sign in to sync`, or a concise retry state. The toast must not cover core YouTube controls.

- [ ] **Step 5: Verify and commit**

```bash
node --test extension/tests/digest-button.test.js extension/tests/save-payloads.test.js
pnpm test:provenance
git add extension/content.js extension/sidepanel.* extension/tests
git commit -m "feat: save exact YouTube learning moments"
```

### Task 6: Implement the durable bounded extension sync queue

**Files:**

- Create: `extension/sync-queue.js`
- Modify: `extension/background.js`
- Modify: `extension/options.js`
- Modify: `extension/manifest.json`
- Test: `extension/tests/sync-queue.test.js`
- Test: `extension/tests/worker-restart.test.js`

**Interfaces:**

- Produces: `enqueueSavedItem(input)`, `flushPendingEvents(trigger)`, `getSyncSummary()`, and `discardPendingEvents(ownerUserId)`.

**Upstream reuse:** Reuse Chrome storage access-level hardening, cache eviction structure, and message routing from `background.js`/`sidepanel.js`; replace `ytd_notes` and full transcript cache persistence with owner-bound event descriptors and a byte-budgeted display cache.

- [ ] **Step 1: Write failing restart and ownership tests**

Test storage-before-network, service-worker module reload, alarm retry, panel-open retry, duplicate flush, partial batch success, expired session, different-account isolation, and queue budget failure without silent deletion.

- [ ] **Step 2: Implement storage-first enqueue**

Persist `{ ownerUserId, clientEventId, input, attempts, nextAttemptAt }` before calling the API. Remove only events explicitly acknowledged by matching ID.

- [ ] **Step 3: Implement bounded storage**

Use `chrome.storage.local.getBytesInUse()` before writes. Keep queued raw events ahead of expendable display cache. If the queue cannot accept another bounded event, return `SYNC_QUEUE_FULL`; never request `unlimitedStorage` in first release.

- [ ] **Step 4: Implement event-driven retries**

Register `chrome.runtime.onStartup`, `chrome.runtime.onInstalled`, `chrome.alarms.onAlarm`, panel messages, and new-save events. Recreate the retry alarm at startup. No correctness depends on `setInterval`, a module global, or a permanently open port.

- [ ] **Step 5: Verify and commit**

```bash
node --test extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
node --test extension/tests/*.test.js
git add extension
git commit -m "feat: add durable extension save synchronization"
```

### Task 7: Integrate extension acquisition with authenticated cloud capture

**Files:**

- Create: `tests/e2e/extension/acquisition-save.spec.ts`
- Create: `tests/e2e/extension/fixtures.ts`
- Create: `tests/integration/capture/cross-user.test.ts`
- Modify: `playwright.config.ts`
- Modify: `docs/engineering/UPSTREAM_EXECUTION_LOG.md`

**Interfaces:**

- Consumes: Tasks 1-6.
- Produces: a complete `sign in -> open Chinese video fixture -> view transcript -> save from every entry point -> verify cloud rows` gate.

- [ ] **Step 1: Add a persistent-Chrome extension fixture**

Launch Chromium with `--disable-extensions-except=<absolute extension path>` and `--load-extension=<absolute extension path>` in a persistent context. Do not run this suite in Firefox/WebKit projects.

- [ ] **Step 2: Add the failing end-to-end scenario**

Use mocked Popcorn/Supadata/AI endpoints and a deterministic YouTube-page fixture. Verify sign-in is explicit, Chinese/English/bilingual modes render, playback is not paused by saving, all six save kinds reach one video parent, and duplicate retries stay idempotent.

- [ ] **Step 3: Add cross-user proof**

User B cannot query user A video, snapshot, segment, saved item, or job. A service-role test intentionally passes the wrong expected user and must refuse the job.

- [ ] **Step 4: Record upstream reuse evidence**

`UPSTREAM_EXECUTION_LOG.md` records each reused upstream function, target diff, copied upstream test, and any approved exception. An empty or generic entry fails review.

- [ ] **Step 5: Run the Batch A gate**

```bash
node --test extension/tests/*.test.js
pnpm vitest run tests/integration/capture tests/contract/transcript
pnpm playwright test tests/e2e/extension/acquisition-save.spec.ts --project=chromium-extension
pnpm lint
pnpm typecheck
pnpm build
pnpm db:test
pnpm test:provenance
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/extension tests/integration/capture playwright.config.ts docs/engineering/UPSTREAM_EXECUTION_LOG.md
git commit -m "test: prove extension-to-cloud capture"
```

## Batch A Exit Gate

Do not start Batch B until the execution ledger proves:

- the extension links explicitly to one Popcorn account;
- one trusted service-worker owner refreshes the session;
- direct provider keys and provider hosts are absent from the extension;
- native Chinese transcript validation rejects fallback languages;
- the pinned Side Panel and content-script behaviors remain under adapted upstream tests;
- every save kind preserves exact content and returns without provider work;
- worker termination, offline state, expired auth, and retry do not lose or reassign events;
- one user/video parent and one user/event identity are enforced;
- extension E2E, RLS, build, and provenance gates pass.
