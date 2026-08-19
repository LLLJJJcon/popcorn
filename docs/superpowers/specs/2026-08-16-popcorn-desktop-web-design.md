# Popcorn Language YouTube Extension and Web Product Design

**Date:** 2026-08-16

**Status:** Approved design; pending written-spec review

**Product:** Popcorn Language

**Delivery target:** Chrome extension plus authenticated desktop web application

## 1. Product Objective

Popcorn helps native English speakers learning Mandarin Chinese turn useful expressions from authentic Chinese YouTube videos into expressions they can reuse independently.

The first release must prove one persistent learning loop:

1. The learner watches a supported Chinese YouTube video.
2. The Chrome extension provides the transcript, English translation, overview, chapters, key quotes, and selected-text explanations without making the learner leave YouTube.
3. The learner saves a video, moment, subtitle selection, key quote, or explanation without interrupting playback.
4. The raw saved material reaches the learner's Popcorn cloud account before any optional AI enrichment begins.
5. After watching, the learner opens Popcorn Web and reviews saved moments grouped under one video.
6. The learner chooses a useful expression and writes an original Chinese response.
7. The system evaluates accuracy, naturalness, and contextual fit.
8. Valid practice evidence creates or updates an Expression Card and schedules later reuse in a new context.
9. Independent reuse advances mastery from `tried` to `reused` and eventually `owned`.

The product is not a generic content importer and not a disconnected AI summarizer. The Chrome extension is the acquisition surface; Popcorn Web is the durable knowledge, practice, and review surface.

## 2. Product Boundary

### 2.1 First-release learner and language

- Native language: English.
- Target language: Mandarin Chinese.
- Interface, instructions, translations, overviews, explanations, and feedback: English.
- Authentic source content, transcript, saved expressions, prompts, and learner output: Simplified Chinese.
- Supported source: standard public `youtube.com/watch` pages with an available native Simplified Chinese subtitle track.
- A requested Chinese subtitle that resolves to another language is unsupported and must not enter the learning pipeline.

### 2.2 Included surfaces

- Chrome 116 or newer using the Side Panel API.
- Popcorn account sign-up, sign-in, sign-out, password recovery, and extension linking.
- A YouTube Side Panel with `Transcript`, `Overview`, and `Saved` tabs.
- `中文`, `English`, and `Bilingual` transcript views.
- Timestamp navigation, playback following, manual-scroll pause, copy, and transcript export in the extension.
- On-demand AI overview, full-video chapters, key quotes, and selected-text explanations.
- Non-blocking saves from the whole video, player moment, `N` shortcut, subtitle row or selection, key quote, and AI explanation.
- A private cloud learning-material snapshot containing video metadata, the immutable native transcript snapshot, generated overview and chapters, key quotes, and English translations already generated for viewed or saved segments.
- Durable, idempotent synchronization with an offline pending queue.
- A Popcorn Web `Saved` library grouped by video and ordered by timestamp.
- AI-assisted candidate-expression analysis grounded in saved subtitle evidence.
- `Use It Now` response, evaluation, revision, and resubmission.
- Expression Vault, deterministic Practice schedule, and evidence-based Progress.
- Account and saved-source deletion with explicit treatment of existing learning evidence.
- A seeded demo account and a known public Chinese-video fixture with cached provider results.

### 2.3 Deferred add-ons

The following are product-completion add-ons, not first-release tasks or acceptance requirements:

- Pasted text, generic public URL, image, or screenshot input.
- Shorts, live streams, private or access-restricted videos, embeds, or videos without native Simplified Chinese subtitles.
- AI-generated audio transcription or fallback transcription.
- Native mobile applications, mobile-specific layouts, PWA installation, offline web mode, Firefox, Safari, or other Chromium browsers.
- Traditional Chinese learning flows, another target language, or selectable source/target language pairs.
- User-supplied transcript-provider keys. AI model gateway configuration is
  allowed only through authenticated Popcorn Web settings under the
  owner-scoped, exact-origin-consent design amendment dated 2026-08-19.
- Full-transcript English pre-generation.
- Folders, tags, collaborative notes, rich note editing, recommendations, community, social features, marketplace, streaks, achievements, or gameplay.
- Vector search, knowledge-graph visualization, Louvain clustering, Deep Research, agent chat, MCP, and Expression Health Check.
- Batch JSON, Markdown, CSV, or Anki export.

### 2.4 Browser and viewport boundary

- Extension: Chrome 116 or newer on desktop.
- Web primary viewport: 1280x720 and above.
- Web minimum supported width: 1024 pixels.
- Narrower web viewports may show a clear unsupported-layout message.
- The capstone delivery may use a packaged or unpacked extension; Chrome Web Store publication is not required for first release.

## 3. Upstream Product Foundations and Reuse Policy

### 3.1 YouTube Digest: code reuse foundation

Repository: `https://github.com/zarazhangrui/youtube-digest.git`

Pinned commit: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`

License: MIT, Copyright (c) 2026 Zara Zhang. Popcorn must preserve the upstream copyright and license notice for copied or substantially adapted code.

The implementation plans must identify reuse at task and file level. Agents must import and adapt the pinned implementation instead of independently regenerating equivalent behavior.

| Upstream area | Required Popcorn treatment |
|---|---|
| `manifest.json` | Copy and adapt the name, permissions, stable extension identity, Popcorn hosts, icons, and options surface. |
| `content.js` button injection and reconciliation | Reuse `findDigestButtonHost`, `createDigestButton`, `injectDigestButton`, resize reconciliation, and mutation reconciliation. |
| `content.js` player note behavior | Reuse and adapt `injectNoteButton`, `handleNoteKeyboardShortcut`, `saveCurrentNote`, timestamp capture, and save feedback. |
| `content.js` playback control | Reuse timestamp seeking and safe page cleanup behavior. |
| `sidepanel.html` and `sidepanel.css` | Use as the Side Panel foundation; rename and simplify tabs and controls for Popcorn. |
| `sidepanel.js` transcript segmentation | Reuse `normalizeCaptionText`, `splitOversizedThought`, `groupTranscriptEntries`, stable segment alignment, and safe subtitle markup rendering. |
| `sidepanel.js` transcript experience | Reuse transcript rendering, selection-aware seeking, playback tracking, active-row highlighting, manual-scroll pause, and `Follow playback`. |
| `sidepanel.js` AI surfaces | Reuse overview, chapters, key-quote presentation, selection explanation, retry states, and timestamp navigation; route calls through Popcorn APIs. |
| `sidepanel.js` translation experience | Reuse lazy translation queues, stable-ID alignment, per-segment retry, and bilingual rendering; reverse the direction to Chinese-to-English. |
| `background.js` message routing and bounded-response patterns | Adapt for Popcorn authentication, fast API submission, status lookup, and durable sync. |
| `background.js` direct provider calls and permanent local notes | Do not retain. Replace Supadata/DeepSeek keys and local-only notes with Popcorn server APIs and cloud persistence. |
| `prompts/*.md` | Preserve the useful prompt structure, timestamp grounding, and structured-output discipline; rewrite instructions for English-speaking learners of Mandarin Chinese. |
| `tests/*.test.js` | Copy the relevant tests, change language expectations, and extend them for authentication, cloud sync, worker restart, and exact saved payloads. |

Parallel reimplementations of upstream button injection, transcript grouping, playback following, bilingual row rendering, overview layout, or selection explanation are prohibited unless a failing adaptation test proves the upstream code cannot satisfy a documented Popcorn requirement.

### 3.2 LLM Wiki: method reference only

Repository: `https://github.com/nashsu/llm_wiki.git`

Pinned release: `v0.6.9`

Pinned commit: `723e259309aea5e3850265b631f80224f66dd9f6`

License: GPLv3.

Popcorn may adapt the public design methods described in `llm-wiki.md` and the release README, but must not copy GPLv3 implementation code into the Popcorn codebase. The adopted methods are:

- immutable raw sources followed by generated structured knowledge;
- schema-governed knowledge organization;
- two-stage analysis and knowledge update;
- source traceability;
- content hashing and incremental work avoidance;
- durable processing queues;
- asynchronous human review for ambiguous decisions;
- index, operation log, and staged retrieval concepts.

Popcorn does not adopt the LLM Wiki desktop runtime, Markdown filesystem storage, Obsidian structure, LanceDB, graph engine, community detection, agent chat, Deep Research, web clipper, MCP implementation, or GPLv3 source files.

## 4. Product Principles

1. **Watching is never interrupted by organization.** Saving does not open a form, navigate away, pause playback, or demand an immediate learning decision.
2. **Raw save before AI.** The original save must be durable before overview, cleanup, extraction, or other AI work begins.
3. **Saving is interest, not mastery.** A save, translation view, or explanation view cannot advance `tried`, `reused`, or `owned`.
4. **Learner responds first.** AI may guide and revise but must not provide a complete model answer before the learner's first attempt.
5. **Evidence advances mastery.** Mastery transitions are deterministic and server-controlled.
6. **One source, many traceable moments.** A video has one user-owned parent record; every saved item and learned expression preserves video, subtitle, and timestamp evidence.
7. **Original text is exact.** A saved quote or selection is the text the learner acted on, not text reconstructed later from an approximate timestamp.
8. **Long work belongs to the cloud.** The extension submits fast requests and never depends on a long-lived service worker or long provider response.
9. **Knowledge compounds selectively.** AI analyzes saved evidence, not every subtitle in every watched video.
10. **Demo stability is a product requirement.** Known public videos may use versioned cached provider results when external services are unavailable.

## 5. User Experience

### 5.1 First-run setup

1. The learner installs the Popcorn extension.
2. On an eligible YouTube page, the learner opens Popcorn.
3. The Side Panel explains the product and presents one explicit `Sign in to Popcorn` action.
4. Chrome opens an interactive Popcorn authentication flow.
5. Successful authentication returns control to the extension and stores the session only in a trusted extension context.
6. The extension immediately checks the active video and either shows the transcript or a precise unsupported reason.

Interactive authentication may not launch automatically on installation or first panel open.

### 5.2 Watching and understanding

- `Transcript` opens first and does not require an AI call for the original subtitle view.
- The learner can switch between `中文`, `English`, and `Bilingual`.
- English translation is lazy and progressive; only visible or explicitly retried segments are requested.
- Clicking a timestamp or transcript row seeks the video unless the learner is selecting text.
- Active subtitles follow playback; manual scrolling pauses auto-follow until the learner selects `Follow playback`.
- `Overview` is on demand and contains complete video chapters and three to five timestamp-grounded key quotes.
- Selecting transcript text offers `Explain` and `Save` actions.

### 5.3 Save entry points

| Entry point | Exact saved payload |
|---|---|
| `Save Video` | YouTube ID, canonical URL, title, channel, thumbnail, duration, description, current playback position, and a request for a native transcript snapshot. |
| Player note or `N` | Video identity and the captured playback second; the server resolves the nearby subtitle without blocking the click. |
| Subtitle row | Stable transcript segment ID, exact original Chinese, displayed English translation if present, start/end seconds, and bounded surrounding segments. |
| Text selection | Exact selected Chinese, source segment IDs, character offsets, start/end seconds, displayed translation if present, and bounded context. |
| Key Quote | Exact quote shown to the learner, quote timestamp, linked source segments, and video identity. |
| AI Explanation | Exact selected Chinese, English explanation shown to the learner, source segment IDs, timestamp range, and bounded context. |

Every click creates a client-generated `clientEventId`. Retrying the same event cannot create a duplicate.

The only immediate presentation states are `Saving…`, `Saved to Popcorn`, `Saved locally; sign in to sync`, and a concise retryable failure. Success feedback must not cover important video controls.

### 5.4 After-watching web journey

Web navigation is `Home`, `Saved`, `Practice`, `Vault`, and `Progress`.

- `Home` shows one primary next action: recent unsorted saves or due practice.
- `Saved` groups material by video and shows the count of saved moments and processing state.
- A video detail page presents the snapshot, overview, chapters, saved items in timestamp order, and candidate expressions.
- The learner may ignore, delete, or practice any saved item without processing the others.
- Candidate expressions show exact subtitle evidence before the learner chooses one.
- `Use It Now` begins with an original learner response, followed by evaluation and optional revision.
- `Practice` replaces the internal term `Queue` in user-facing copy.
- `Vault` contains only expressions backed by a valid attempt, never raw saves alone.

### 5.5 Returning learner

- `Home` prioritizes due Practice over inactive saved material.
- A due task uses a different context and withholds a complete answer.
- After submission, the learner sees feedback, the resulting evidence state, and the next scheduled action.
- Progress emphasizes successful reuse and ownership rather than collection volume.

## 6. Runtime Architecture

```text
YouTube Page
  |  content script: buttons, timestamp capture, lightweight feedback
  v
Chrome Side Panel
  |  transcript/overview UI, explicit sign-in, save commands
  v
Extension Service Worker
  |  sole session owner, durable small sync queue, fast API calls
  v
Popcorn Next.js API (/api/v1)
  |-- auth and user-scoped authorization
  |-- idempotent save and sync endpoints
  |-- transcript and knowledge job status
  |-- practice, vault, progress, and deletion endpoints
  v
Supabase
  |-- Auth
  |-- PostgreSQL + RLS
  |-- durable knowledge_jobs and mastery evidence
  |-- Cron recovery for pending jobs
  v
Server-only Provider Adapters
  |-- Supadata native transcript retrieval
  |-- AI overview, translation, explanation, extraction, evaluation
```

### 6.1 Extension boundaries

- The content script is an untrusted page-adjacent context. It may observe YouTube state and send bounded messages but may not read auth tokens, provider keys, cached cloud payloads, or other users' data.
- The Side Panel owns presentation state and may request actions through the service worker. It does not own refresh tokens or initialize an independent auth refresher.
- The service worker is the only extension session owner. It stores session and pending events through a custom `chrome.storage.local` adapter restricted to trusted extension contexts.
- No correctness depends on service-worker global variables, ordinary timers, or an uninterrupted network request.
- Pending sync stores compact event descriptors, not complete transcripts or AI results.
- Chrome alarms, extension startup, panel open, and new-save events may all trigger the same idempotent sync routine.

### 6.2 Authentication flow

- An explicit user action starts `chrome.identity.launchWebAuthFlow`.
- The flow uses PKCE and a stable extension redirect identity.
- The authorization code is short-lived and exchanged exactly once; access or refresh tokens must not appear in a user-visible URL, log, screenshot, or source file.
- A single refresh mutex in the service worker prevents overlapping refresh attempts.
- Expired sessions keep unsynced events locally and present a non-blocking sign-in-required state.
- Every pending event is bound to the user ID that created it. Signing into a different account can never reassign or upload another account's queued events.
- Explicit sign-out with pending events requires a clear choice to sync first or discard them; successful sign-out clears tokens and PKCE material.
- Provider credentials and the Supabase service role key never reach the extension.
- A learner may configure an approved AI gateway, model, and write-only API key
  in authenticated Popcorn Web settings. The server stores only a Vault reference
  in application tables and requires consent to the exact catalog origin before
  any transcript or selection leaves Popcorn.

### 6.3 Fast-save and durable-job boundary

The save endpoint performs only bounded work:

1. Validate the authenticated user and payload size.
2. Validate the canonical YouTube ID and save kind.
3. Upsert the user's `video_sources` parent.
4. Insert the exact `saved_items` record using `clientEventId` idempotency.
5. Insert or coalesce a pending `knowledge_jobs` record.
6. Commit and return success.

Transcript fetch, provider polling, overview generation, translation, candidate extraction, and knowledge updates occur after this transaction. A scheduled server-side consumer and an on-demand recovery trigger use the same durable job table. Jobs are leased, bounded, retryable, and safe after process termination.

## 7. Product Modules

### M0. Foundation and Upstream Intake

- Preserve the existing Next.js/Supabase foundation.
- Add an `extension/` package based on the pinned YouTube Digest source.
- Preserve upstream MIT attribution and add machine-checkable provenance.
- Establish shared formatting, tests, packaging, and contract generation.

### M1. Identity, Contracts, Data, and Security

- Web and extension authentication contracts.
- YouTube source, snapshot, transcript, saved-item, processing-job, expression, practice, attempt, mastery, and review contracts.
- RLS, ownership, indexes, idempotency keys, and processing-job leases.
- Three mastery states: `tried`, `reused`, `owned`.
- Deterministic scheduling and append-only mastery events.

### M2. YouTube Acquisition Extension

- Adapt pinned manifest, content script, Side Panel, styles, prompts, and tests.
- Require and validate native Simplified Chinese subtitles.
- Reverse translation to Chinese-to-English.
- Route transcript and AI work through Popcorn APIs.
- Add exact save payloads and cloud status.

### M3. Reliable Cloud Capture

- Extension link and session management.
- Compact offline queue, retry alarms, and byte-budget enforcement.
- Idempotent batch sync and one-parent-per-user-video behavior.
- Immutable transcript snapshots and transcript revisions by content hash.
- Durable processing jobs with scheduled recovery.

### M4. Saved Knowledge Organization

- Video-grouped `Saved` library and detail page.
- Two-stage saved-item analysis and expression-knowledge update.
- Source traceability from expression through occurrence to transcript segment and timestamp.
- Ambiguous expression merges remain separate candidates until learner confirmation.
- Incremental work avoidance by transcript, saved-item, prompt, and model hashes.

### M5. Use It Now

- Candidate selection, original response, evaluation, revision, and resubmission.
- Separate accuracy, naturalness, and contextual-fit feedback.
- A valid attempt creates or updates an Expression Card and records `tried` evidence atomically.

### M6. Practice, Vault, and Mastery

- Vault search and expression detail with source occurrences and attempt history.
- Deterministic due Practice tasks using new contexts.
- Failed or heavily assisted reuse schedules an earlier retry.
- Independent successful reuse may advance `reused`; repeated cross-context evidence may advance `owned`.

### M7. Progress, Deletion, and Delivery

- Basic Progress: weekly attempts, due completions, independent reuse, and `tried/reused/owned` distribution.
- Saved-source deletion with explicit learning-evidence effects.
- Account deletion.
- Production web deployment, packaged extension, seeded demo account, cached fixtures, observability, and recovery documentation.

## 8. Core Data Model

| Entity | Purpose | Required identity or relationship |
|---|---|---|
| `profiles` | Learner level and goal | One per authenticated user |
| `video_sources` | User-owned YouTube video parent | Unique `(user_id, youtube_video_id)` |
| `video_snapshots` | Immutable metadata and transcript version | Belongs to source; unique transcript hash per source |
| `transcript_segments` | Exact ordered native subtitle evidence | Belongs to snapshot; stable segment ID and time range |
| `saved_items` | Exact learner save action | Belongs to user/source/snapshot when resolved; unique `client_event_id` per user |
| `generated_artifacts` | Overview, chapters, quotes, translations, explanations | Prompt/model/versioned and source-grounded |
| `knowledge_jobs` | Durable provider and knowledge work | Leased state machine with attempt count and next retry |
| `expression_senses` | User-owned structured Chinese expression knowledge | Meaning, tone, function, register, normalized text |
| `expression_occurrences` | Source traceability | Links expression to saved item and transcript segment |
| `user_expressions` | Learner mastery projection | Current `tried/reused/owned` state |
| `practice_tasks` | Immediate or due new-context task | Links user expression and task context |
| `attempts` | Learner response, assistance, feedback, revision | Links task and user expression |
| `mastery_events` | Append-only evidence history | Links attempt and state transition |
| `review_tasks` | Deterministic Practice schedule | One scheduling record per due action |

Every user-owned row carries `user_id`. RLS policies apply to reads and writes. Background service-role operations must carry an explicit user scope and are covered by cross-user tests.

### 8.1 Saved-item states

Before cloud creation, an extension queue event is locally `pending_sync` or `sign_in_required`. These are not `saved_items` database states.

After cloud creation, `saved_items.status` is one of:

- `saved`: the raw cloud record is durable;
- `resolving_source`: transcript or snapshot is being resolved;
- `organizing`: AI analysis is running;
- `ready`: source and candidate knowledge are available;
- `unsupported`: the source has no valid native Simplified Chinese transcript;
- `failed`: processing failed after bounded retries, while the raw save remains durable.

### 8.2 Knowledge-job states

`knowledge_jobs.status` is `pending`, `leased`, `succeeded`, `retryable_failed`, or `terminal_failed`.

- A lease has an expiry so a terminated worker does not strand the job.
- Retry uses bounded exponential backoff and persists the provider error category.
- A job result is idempotent by job type, source hash, saved-item hash, prompt version, and model version.
- Provider failure never deletes or rewrites the original saved item.

## 9. Knowledge Organization and Retrieval

### 9.1 Adapted LLM Wiki layers

```text
Raw Source
  video snapshot + immutable transcript + exact saved item
      |
      v
Structured Knowledge
  generated video artifact + candidate expression + source occurrence
      |
      v
Learning Evidence
  attempt + mastery event + due Practice task
```

The raw layer is immutable. Generated knowledge may be regenerated by version. Learning evidence may not be rewritten by knowledge regeneration.

### 9.2 Two-stage organization

1. **Analysis stage:** inspect the saved item and bounded source context; propose one to three candidate expressions with meaning, tone, communicative function, confidence, and exact evidence.
2. **Knowledge-update stage:** only after the learner selects and practices an expression, create or update the expression sense and attach the occurrence and attempt evidence.

The system never mass-creates Vault cards from a complete transcript.

### 9.3 First-release retrieval

- Exact normalized Simplified Chinese expression match.
- Chinese substring and PostgreSQL trigram matching.
- English meaning search.
- Filters for communicative function, register, source video, mastery, and date.
- Source-overlap signals for presenting additional occurrences of the same expression.

Vector embeddings and graph traversal are deferred. PostgreSQL's default English full-text parser is not treated as a Chinese tokenizer.

## 10. Mastery and Scheduling

- `tried`: the learner submits an original response using the expression; assistance is recorded.
- `reused`: the learner succeeds without a complete supplied answer in a later or meaningfully different context.
- `owned`: the learner produces successful independent evidence across at least two distinct contexts on separate occasions, including one due Practice task.

Transitions are monotonic in the first release. A weak later attempt records recent performance and schedules more practice but does not erase the highest demonstrated state.

- New `tried` evidence schedules initial reuse.
- Failed or heavily assisted reuse schedules an earlier retry.
- Successful independent reuse schedules a later transfer task.
- AI may generate task content but may not choose the mastery transition or due date.
- `saved`, translation viewed, overview viewed, explanation viewed, and candidate accepted are not mastery evidence.

## 11. Primary Data Flows

### 11.1 Open supported video

1. The extension resolves the active canonical YouTube ID.
2. The service worker checks the Popcorn session.
3. Popcorn requests `mode=native` with preferred `lang=zh` from the transcript provider.
4. Popcorn validates the actual returned language and Simplified Chinese content rather than trusting the request preference.
5. A direct transcript result is normalized immediately; an asynchronous provider job is polled by the server-side job system.
6. Stable transcript segments are returned to the Side Panel.

### 11.2 Save during playback

1. The UI constructs the exact bounded payload and a new `clientEventId`.
2. The service worker persists the compact event locally before attempting network sync.
3. The API commits the source parent, saved item, and knowledge job.
4. The API returns success; the local pending event is removed.
5. Cloud processing resolves the transcript snapshot and generated artifacts.
6. The website reflects progressive states without hiding raw saved content.

### 11.3 Offline or expired session

1. The compact event remains in `chrome.storage.local`.
2. A bounded queue budget prevents full transcript or provider payload storage.
3. Network recovery, startup, panel open, or an alarm retries the same `clientEventId`.
4. An expired session changes the event to sign-in-required but does not delete it.
5. After explicit sign-in, queued events resume automatically.

### 11.4 Saved item to Expression Card

1. The learner opens a ready saved item.
2. The system presents one to three source-grounded candidates.
3. The learner selects one and receives a response task without a complete answer.
4. The learner submits an original response.
5. The server evaluates and atomically stores the attempt, expression occurrence, `tried` mastery event, and initial Practice schedule.

### 11.5 Delete source

- If no practice evidence depends on the source, deleting it may remove the snapshot, saved items, candidates, and generated artifacts.
- If practice evidence exists, the confirmation identifies the affected expressions. The default removes source content and occurrences but retains attempts and mastery history with a `Source deleted` marker.
- Account deletion removes all user-owned source, generated knowledge, learning evidence, and extension link data.

## 12. Error Handling and Safety

### 12.1 Error categories

- `AUTH_REQUIRED`, `SESSION_EXPIRED`, `FORBIDDEN`
- `INVALID_YOUTUBE_VIDEO`, `UNSUPPORTED_YOUTUBE_PAGE`
- `NATIVE_CHINESE_TRANSCRIPT_REQUIRED`, `TRANSCRIPT_UNAVAILABLE`, `TRANSCRIPT_EMPTY`
- `SYNC_QUEUE_FULL`, `SYNC_RETRYING`, `IDEMPOTENCY_CONFLICT`
- `PROVIDER_RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_OUTPUT_INVALID`
- `JOB_LEASE_CONFLICT`, `JOB_RETRY_EXHAUSTED`
- `VALIDATION_FAILED`, `CONFLICT`, `INTERNAL_ERROR`

### 12.2 Recovery requirements

- Safe raw user input survives recoverable failures.
- Partial provider results do not advance mastery.
- A provider error may leave generated content pending or failed but cannot remove the saved item.
- Cached known-video results remain usable during a demo outage.
- The server accepts only canonical YouTube watch identities for this release.
- User-supplied strings are stored and rendered as escaped plain text.
- Server logs exclude tokens, raw private content, full provider responses, and sensitive transcript bodies by default.
- AI gateway API keys, Vault references, exact private job inputs, and consented
  transcript/selection bodies are never returned by public APIs or logs.
- The application stores no YouTube video file and does not bypass access controls.
- Full transcript snapshots are private, user-owned learning records and are not redistributed publicly.
- Production readiness requires a recorded review of the selected transcript provider's current terms, retention rules, and permission for private transcript snapshots. An incompatibility blocks deployment until the provider or granted rights change; it may not silently weaken the agreed snapshot product.

## 13. Testing Strategy

### 13.1 Reused upstream tests

Adapt the pinned YouTube Digest tests for:

- responsive Digest/Popcorn button injection and duplicate repair;
- transcript segmentation and oversized-entry splitting;
- selection-aware timestamp navigation;
- safe subtitle markup rendering;
- stable-ID translation alignment and per-segment retry;
- provider response size, timeout, and structured-output boundaries where still server-relevant;
- minimum extension permissions and packaged-release checks.

### 13.2 Extension tests

- Explicit authentication and PKCE redirect handling.
- One service-worker refresh owner and concurrent-refresh mutex.
- Compact event is persisted before network submission.
- Worker termination or extension reload does not lose pending events.
- Alarm/startup/panel-open retry is idempotent.
- Local byte budget rejects unbounded cache growth without silently dropping events.
- Player, subtitle, selection, quote, and explanation saves contain the exact expected payload.
- Key Quote saving preserves the displayed quote rather than reconstructing it by timestamp.
- Non-Chinese provider fallback is rejected.

### 13.3 Contract, integration, and security tests

- Unique `(user_id, client_event_id)` and `(user_id, youtube_video_id)` behavior.
- Snapshot revision by transcript hash.
- Atomic raw save plus job creation.
- Job lease expiry, retry, and idempotent result application.
- AI failure preserves raw saved data.
- Two users cannot access each other's sources, transcripts, saved items, generated artifacts, jobs, expressions, attempts, or progress.
- A service-role worker cannot process a job under the wrong user scope.
- Deleting a source does not silently delete mastery evidence.

### 13.4 Web and learning tests

- Home shows a recent-save next action.
- Saved groups multiple moments under one video.
- Progressive processing states preserve access to raw saves.
- Candidate evidence links to the correct subtitle and timestamp.
- A save alone creates no Vault card or mastery event.
- A valid first attempt creates `tried` evidence and a due task.
- Independent cross-context evidence advances `reused` and `owned` under deterministic rules.
- Progress reports attempts, due completions, independent reuse, and mastery distribution.

### 13.5 Browser and live verification

- Playwright uses a persistent Chrome context with the unpacked extension loaded.
- CI mocks Supadata and AI providers with fixed fixtures.
- Manual smoke testing covers several real public Chinese YouTube videos.
- The demo uses one known public video and versioned cached results, while still demonstrating a real extension save entering the authenticated cloud account.

### 13.6 Provenance and license checks

- Record the pinned YouTube Digest commit and copied file map.
- Preserve its MIT license and copyright notice.
- Fail review if protected upstream behaviors are independently reimplemented without a documented test-backed exception.
- Record LLM Wiki as a design-method reference only.
- Fail review if GPLv3 LLM Wiki source code is copied into Popcorn.

## 14. Acceptance Criteria

The first release is complete when all of the following are true:

1. A learner explicitly signs into Popcorn from the extension and retains one recoverable session without exposing provider or service-role credentials.
2. A standard video with native Simplified Chinese subtitles shows the original, English, and bilingual transcript modes.
3. A non-Chinese fallback transcript is rejected rather than treated as authentic Chinese input.
4. Overview, complete chapters, key quotes, selected-text explanation, playback following, and timestamp navigation work from the pinned YouTube Digest adaptation.
5. The learner can save a video, player moment, subtitle row or selection, key quote, and AI explanation without pausing, navigating, or completing a form.
6. The exact acted-on text and source range are stored for subtitle, quote, and explanation saves.
7. Raw saves remain durable when AI, translation, transcript resolution, or knowledge organization fails.
8. An offline or session-expired save survives extension-worker termination and syncs later with the same `clientEventId`.
9. Multiple saves from one video produce one user-owned video parent and traceable timestamped items.
10. The Saved website shows the video snapshot, raw saves, progressive processing, and source-grounded expression candidates.
11. Saving, viewing, translating, or explaining creates no mastery evidence.
12. A valid original attempt creates or updates an Expression Card, records `tried`, and schedules Practice atomically.
13. Later independent use in distinct contexts can advance `reused` and `owned` under deterministic rules.
14. Home, Saved, Practice, Vault, and Progress derive from authenticated cloud data and remain available across computers.
15. Source deletion has explicit, tested effects and cannot silently erase mastery history.
16. RLS and worker-scope tests prove cross-user isolation.
17. The deployed web application, packaged extension, seeded demo account, and known-video cached path support a repeatable live demonstration.
18. First-release UI and tests contain no pasted-text, generic URL, image, or screenshot input path.
19. Required unit, contract, integration, security, web E2E, and extension E2E checks pass from a clean checkout.
20. Upstream provenance and license checks pass.

## 15. Implementation Planning Constraints

The revised implementation plans must:

- modify the existing foundation, Batch A, Batch B, Batch C, delivery, orchestration, and execution-runbook documents rather than adding an alternative plan set;
- remove generic text, URL, image, screenshot, pgvector, advanced relation, advanced Progress, and export tasks from first-release execution;
- assign exact upstream repository, pinned ref, file, function, reuse mode, target file, required adaptation, license action, and verification test at the relevant task;
- require agents to inspect and reuse pinned YouTube Digest code before creating extension behavior;
- state explicitly that LLM Wiki contributes methods only and that its GPLv3 implementation code may not be copied;
- establish extension authentication, raw-save contracts, idempotency, immutable snapshot, durable-job, and three-state mastery contracts before feature work begins;
- keep long provider work out of extension requests and service-worker lifecycle assumptions;
- use test-driven, independently reviewable tasks with exact files, commands, expected failures, and passing results;
- preserve sequential contract and migration ownership before parallel feature batches;
- include integration gates for extension-to-cloud save, Saved-to-practice, and practice-to-mastery;
- treat real-provider smoke tests as manual delivery verification and keep CI deterministic with fixtures.
