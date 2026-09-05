# Popcorn Unified Learning Workspace Design

**Date:** 2026-09-05
**Status:** Approved direction, pending written-spec review
**Baseline:** `c947cac27d82ffcab882be8613860ed93cbbf4cc`

This specification supersedes the Web viewport boundary in
`2026-08-16-popcorn-desktop-web-design.md` §2.4. It also follows the
local-first user-configured exact base URL amendment in
`2026-08-22-popcorn-local-first-school-demo-design.md`; that amendment
supersedes the earlier administrator-catalog gateway requirement.

## 1. Problem

Popcorn already implements the core learning data path:

```
YouTube save
  -> durable Saved material
  -> source-grounded candidate expression
  -> learner Practice
  -> Vault evidence
  -> Progress
```

The current Web experience does not present that path as one product. The root
page is a heading, authenticated navigation is visually unstyled, model gateway
settings sit outside the authenticated layout, and the feature pages render
mostly as independent semantic HTML. Users cannot reliably tell where to start,
what Saved and Vault each mean, or what to do after a save.

This work creates one coherent authenticated learning workspace. It changes the
information architecture, routing, presentation, and a small number of view
contracts. It does not change Popcorn's product boundary or introduce a new
learning system.

## 2. Goals

- Make `/` the only general entry point from the extension and documentation.
- Route signed-out users to Sign in and signed-in users to Home.
- Place Home, Saved, Practice, Vault, Progress, and Settings inside one
  consistent authenticated application shell.
- Make Home present one primary next action and a small amount of supporting
  context.
- Make Saved detail the visible bridge between captured YouTube evidence and
  Practice.
- Make Practice a short, focused, learner-first session with useful feedback.
- Make Vault scan-friendly and clearly different from Saved.
- Make Progress explain evidence-based growth without vanity metrics.
- Preserve raw Saved material through transcript, Provider, gateway, and worker
  failures.
- Keep the result light enough for a personal school project and repeatable
  professor demonstration.

## 3. Non-goals

- No additional input source beyond the currently watched YouTube video.
- No pasted text, arbitrary URL, image, screenshot, upload, or video-file
  storage.
- No social, streak, points, leaderboard, notification, billing, quota,
  multi-tenant administration, or commercial analytics feature.
- No new database table for UI state, navigation, draft answers, or dashboard
  data.
- No saved-answer draft system. A Practice task persists, but an unsubmitted
  textarea value does not need cross-device durability.
- No vector search, graph, chat retrieval, export, or advanced Progress.
- No Provider call merely to render Home, Saved, Vault, Progress, a hint, or
  navigation.
- No replacement of the existing durable job, mastery, or scheduling model.

## 4. User mental model

The authenticated navigation follows four learning roles:

- **Saved remembers:** raw learning material grouped under a YouTube video.
- **Practice activates:** the learner uses one selected expression in a new
  context.
- **Vault explains:** expressions backed by at least one valid learner attempt.
- **Progress proves:** recent attempts and the highest demonstrated
  `tried -> reused -> owned` evidence.

Home does not add a fifth content store. It chooses the most useful next action
across those roles.

## 5. Routing and authentication

### 5.1 Root

`/` is a server-side smart entry.

- Missing or invalid Web session: redirect to `/sign-in`.
- Authenticated Web session: redirect to `/home`.

The page must not render a marketing placeholder or require the user to know an
internal route.

### 5.2 Sign in

- A signed-in visitor opening `/sign-in` receives the existing signed-in state
  with a primary `Continue to Popcorn` action targeting `/home`.
- Successful sign-in and account creation redirect to `/home`, not directly
  to model gateway settings.
- Sign-out redirects to `/sign-in`.
- Missing gateway configuration never blocks sign-in or access to raw Saved
  material.

### 5.3 Extension navigation

- Rename the Side Panel header action from `Settings` to `Open Popcorn` and
  open `http://127.0.0.1:3000/`.
- The Web root decides whether the user sees Sign in or Home.
- A saved-video deep link may continue to open
  `/saved/:videoSourceId`.
- The Chrome options page remains an extension-specific `Extension connection`
  surface because the extension service worker owns its own session. It remains
  reachable from Chrome's extension details and from a sign-in-required sync
  recovery action; it is not the product's general Settings destination.
- Opening Web does not copy credentials, tokens, or passwords into page fields.

### 5.4 Authenticated application routes

The shared shell owns:

- `/home`
- `/saved`
- `/saved/:videoSourceId`
- `/practice`
- `/practice/:taskId`
- `/vault`
- `/vault/:userExpressionId`
- `/progress`
- `/settings/model-gateway`

Every route retains its existing server-side authentication check. The common
shell is presentation and navigation, not an authorization substitute.

## 6. Authenticated application shell

Desktop uses a persistent left navigation. Layouts narrower than 900 CSS pixels
replace it with a compact top navigation that preserves the same order:

1. Home
2. Saved
3. Practice
4. Vault
5. Progress

Settings and the account/sign-out action sit separately from the learning
navigation. The active route is visually and programmatically identified.

The shell provides:

- Popcorn brand and consistent page width;
- active navigation state;
- signed-in account summary and sign-out;
- a gateway setup or connection notice only when action is required;
- one shared action notice when model gateway configuration is missing;
- skip navigation, visible focus, semantic landmarks, and responsive behavior.

The shell does not permanently show system health, queue internals, API
metadata, or developer terminology.

## 7. Visual language

The visual system uses a warm learning-workspace character rather than a
generic admin dashboard:

- warm cream page background;
- dark cocoa navigation;
- coral as the primary action and active accent;
- paper-like white content surfaces;
- green only for successful learning evidence;
- amber for processing or attention;
- red for actionable failures.

Use one spacing, radius, field, button, badge, and typography system across all
pages. Avoid oversized hero copy, dense boxed dashboards, unexplained icons,
and decorative charts. English remains the interface language because the
first-release learner is an English-speaking Mandarin learner. Chinese examples
use `lang="zh-CN"`.

## 8. Home

Home answers: **What is the most useful thing I can do now?**

Supporting content shows:

- a compact `tried / reused / owned` snapshot;
- the most recently saved video, including its current processing state.

Home composes a bounded view with `hasActiveGateway`,
`duePracticeCount`, `unsortedSaveCount`, `recentVideo | null`, and the
mastery distribution. `unsortedSaveCount` retains the existing definition:
saved items in `saved`, `resolving_source`, or `organizing` state. The
recent video is the source containing the saved item with the newest
`captured_at`; equal timestamps use ascending saved-item ID and then ascending
source ID as deterministic tie-breakers.

The primary action is selected by this complete decision table:

| Condition, evaluated top to bottom | Primary label | Target |
| --- | --- | --- |
| No active gateway | `Set up model gateway` | `/settings/model-gateway` |
| Gateway active and `duePracticeCount > 0` | `Practice N due expressions` | `/practice` |
| Gateway active, nothing due, and `unsortedSaveCount > 0` | `Review N recent saves` | `/saved` |
| Gateway active and no due or unsorted work | `Continue watching on YouTube` | `https://www.youtube.com/` |

There is exactly one visually primary CTA. When gateway setup is primary, Home
still renders the recent Saved and mastery supporting content, and authenticated
navigation to raw Saved remains available. Supporting modules use text links or
secondary buttons only; they never compete with the primary action.

## 9. Saved

### 9.1 Saved library

Saved answers: **What did I capture from YouTube?**

- Group saves by video.
- Show thumbnail, title, channel, saved count, latest activity, and a
  user-facing processing state.
- Provide simple All, Ready to learn, and Processing filters only if more than
  one state is present.
- A card opens the video detail. It does not start Practice immediately.
- Empty state explains how to save from the extension; it does not offer
  another input source.

### 9.2 Saved video detail

Saved detail is the bridge from capture to learning.

The page contains:

- compact video identity with a canonical YouTube link;
- overview and chapters when already available;
- timestamp-ordered saved moments;
- exact original Chinese evidence;
- stored English translation when available;
- processing or failure state per moment;
- one to three source-grounded candidate expressions per ready saved item;
- a clear `Practice this expression` action on each candidate.

Raw saved material stays visible even when transcript resolution, translation,
candidate analysis, gateway access, or AI generation fails. A saved item whose
candidate analysis is unavailable shows one `Retry analysis` action backed by
the existing candidate-recovery endpoint. It retries that saved item's analysis
only and never re-creates the raw save or fans out into a general job-control
operation. Video-level snapshot and overview failures keep their existing
recovery behavior and do not gain a new bulk operator control.

The page must not imply that accepting or viewing a candidate adds it to Vault.
Only a valid original Practice attempt may do that.

## 10. Practice

### 10.1 Practice landing

Practice answers: **What should I actively use today?**

- Show the number of due items and an approximate short-session length computed
  as two minutes per selected item, capped at six minutes.
- Start a focused session of at most three due expressions.
- Let the learner stop after any completed item; a session is a presentation
  convenience, not a new persisted entity.
- When nothing is due, explain that current work is complete and link to recent
  Saved material or Vault without manufacturing a task.

Due items are ordered by ascending `dueAt` and then ascending
`reviewTaskId`. A client-side session selects the first three. The session
stays on `/practice`; it does not create a session row or a session URL.

- Starting an item calls the existing
  `GET /api/v1/practice/due/:reviewTaskId`, which idempotently returns or
  materializes its due Practice task.
- Completing an item calls the existing
  `POST /api/v1/practice/due/:reviewTaskId` and returns evaluation,
  deterministic mastery transition, and next due data in one response.
- On completion, the client removes that review ID from the local three-item
  queue and advances to the next selected item.
- Stopping returns to the Practice landing state. Uncompleted review tasks stay
  pending and reappear on reload; no server state is changed by stopping.
- Reloading during an item may discard only the unsubmitted textarea. Starting
  the same review again returns the same materialized task.
- Repeating a POST with the same response and assistance level uses the existing
  deterministic request key and completion receipt. It does not call the
  Provider or record mastery twice. A different response after completion is a
  conflict, not a retry.

### 10.2 Focused task

One task occupies the primary content surface. The task shows:

- expression;
- English meaning;
- current mastery;
- source video title and timestamp;
- original evidence or a link that reveals it;
- an answer-free new situation;
- English instructions;
- Chinese response field;
- `Check my response`.

`/practice/:taskId` remains the canonical route only for the immediate
`use_it_now` draft created after a candidate is selected in Saved. Due
Practice uses the focused state inside `/practice` and does not overload this
route with a review-task identifier.

The first response must remain learner-authored. A `Need a hint?` disclosure
reveals the existing communicative function, tone, register, and English
explanation from the candidate or expression sense. It must not issue a second
Provider request or reveal a complete model answer before the first attempt.
Opening the hint records the assistance level for evaluation and mastery
evidence.

### 10.3 Data provenance

The display fields are obtained without new storage:

- expression, meaning, explanation, tone, function, register, evidence, and
  candidate timestamp: saved-item analysis artifact before first promotion, or
  expression sense and occurrence afterward;
- video title: the persisted snapshot associated with the source;
- current mastery and due schedule: user expression and review task;
- prompt and goal: existing Practice task.

The Practice view contracts must expose these fields. The UI must not reconstruct
them from text or request the extension at render time.

### 10.4 Evaluation

While checking:

- keep the learner response visible and unchanged;
- disable duplicate submission;
- show a specific `Checking your Chinese…` state;
- after eight seconds, explain that the configured model is still working while
  leaving the request active;
- allow retry after a failure without retyping.

Feedback order:

1. one plain-language overall takeaway;
2. accuracy, naturalness, and contextual-fit feedback;
3. one most useful revision instruction;
4. revise once or continue.

A natural Chinese revision is returned in the same existing evaluation Provider
call after the learner has submitted. It must not trigger a second call. It is
transient coaching for the active Practice screen: existing dimension feedback
remains the persisted attempt history, so no database column or table is added.

After success, show whether evidence was recorded, any deterministic mastery
transition, the next due date, and the number of remaining session items. AI
does not decide mastery or scheduling.

## 11. Vault

Vault answers: **What expressions have I genuinely practiced?**

- Default to compact expression rows or cards.
- Show expression, English meaning, mastery, communicative function/register,
  and a concise source reference.
- Provide one prominent search field and simple mastery chips.
- Put function, register, source, and date filters behind a `Filters`
  disclosure.
- Never expose raw `Video source ID` as a normal learner-facing field.
- Open one expression on `/vault/:userExpressionId` for full source evidence,
  attempt history, feedback, and YouTube timestamp link.

The list does not expand every attempt by default. Saved and Vault stay distinct:
Saved contains captured material; Vault contains attempt-backed expressions.

## 12. Progress

Progress answers: **Am I getting better at using Mandarin?**

Use only the existing bounded summary:

- attempts this week;
- due Practice completed;
- independent reuse;
- Practice due now;
- `tried / reused / owned` distribution.

Separate recent activity from highest demonstrated mastery. Explain that mastery
does not fall when a later attempt is weak. Use compact metrics and directly
labeled mastery bars, then link to Practice when work is due. Do not add
streaks, collection totals, unsourced trends, or comparison with other users.

## 13. Model gateway settings

Move `/settings/model-gateway` into the authenticated shell and restyle it with
the shared form system. Preserve the provider-neutral gateway name, base URL,
model, API key, active configuration, and consent behavior.

The page uses one configuration form and one configured-gateway list. Saving
must not create visually duplicated confirmation sections. API key presentation
follows the already approved personal-use behavior. Extension account
credentials must never prefill gateway name, model, base URL, or API key.

The base URL is the learner's exact OpenAI-compatible HTTPS configuration,
including its bounded optional path, as defined by the local-first amendment;
the UI does not require an administrator-managed origin catalog.

## 14. Loading, empty, processing, and error states

Every state answers three questions:

1. What happened?
2. Is my saved learning material safe?
3. What can I do next?

Required behavior:

- **Gateway missing:** show a link to Settings; raw Saved remains usable.
- **Transcript unavailable:** keep the save and explain that learning
  organization cannot finish yet.
- **AI enrichment processing:** show the raw moment and a calm progress label.
- **Provider failure:** retain all input, use the specified per-candidate
  `Retry analysis` action where applicable, and avoid generic `failed` copy.
- **Local Web unavailable in the extension:** explain that the moment is queued
  and will sync automatically after Popcorn restarts. The Web UI does not add a
  worker heartbeat or pretend to detect a stopped worker.
- **No results:** explain the relevant next action rather than displaying an
  empty box.

Do not add a permanent observability dashboard for these states.

## 15. Data and interface changes

Prefer view composition over schema changes.

Expected interface work:

- authenticated account and optional gateway-action state for the app shell;
- enriched Practice task view containing source summary and expression
  metadata already present in persisted records;
- due Practice completion response that can show evaluation, transition, and
  next due action together;
- Vault summary and detail presentation using the existing repository data;
- root and authentication redirect changes;
- extension Web-navigation target change to `/`.

No API key, token, password, raw internal ID, Provider response body, or
cross-user record may enter a page DTO.

## 16. Accessibility and responsive behavior

- Keyboard access and visible focus for every navigation item, disclosure,
  filter, form field, dialog, and CTA.
- One `h1` per page with ordered headings.
- Active navigation uses `aria-current="page"`.
- Loading messages use polite live regions; actionable failures use alerts
  without repeated announcements.
- Color is never the only carrier of processing, mastery, or error state.
- Touch targets remain usable at narrow widths.
- Page content reflows without horizontal scrolling at 320 CSS pixels. This
  responsive requirement replaces the earlier unsupported-below-1024 behavior;
  it does not add a separate mobile application or mobile-only feature set.
- Reduced-motion preferences are respected.

## 17. Verification

Use fixture-backed tests for all deterministic UI work. Live Providers are used
only for the final manual demonstration.

Required focused verification:

- root routing for signed-out and signed-in sessions;
- successful sign-in redirects to Home;
- extension general Web action opens `/`;
- authenticated routes share navigation, active state, account, and Settings;
- Home primary-action priority;
- Saved list grouping and Saved-detail raw-material preservation;
- Saved candidate to Practice task navigation;
- Practice source provenance, hint behavior, duplicate-submit prevention,
  retry-without-retyping, evaluation, transition, and next due display;
- Vault compact list, hidden advanced filters, and expression detail;
- Progress metrics exactly match the existing summary;
- gateway settings retains configuration behavior inside the shell;
- loading, empty, processing, Provider failure, and worker recovery states;
- keyboard, landmarks, focus, labels, contrast, and narrow viewport behavior;
- complete extension Save -> Web Saved -> Practice -> Vault -> Progress happy
  path with fixed fixtures.

Run the smallest relevant test set for each implementation task. Before the
integration commit, run the complete Web learning-loop gate, typecheck, lint,
build, and the existing database tests affected by view-contract changes.

## 18. Implementation boundaries

Implementation should be split so concurrent agents never edit the same file:

1. routing, authentication redirects, and shared application shell;
2. Saved list/detail presentation and candidate bridge;
3. Practice view contracts and focused session;
4. Vault and Progress presentation;
5. model gateway page integration and extension root navigation;
6. controller-owned integration, end-to-end verification, documentation, and
   final visual consistency pass.

Shared contracts, root configuration, lockfiles, migrations, and final
integration remain controller-owned. A database migration is not expected; if
one becomes necessary, implementation must stop and justify it before adding
the migration.
