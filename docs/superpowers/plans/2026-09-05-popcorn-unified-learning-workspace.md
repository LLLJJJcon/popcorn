# Popcorn Unified Learning Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing authenticated Popcorn pages into one coherent, responsive YouTube-to-Mandarin learning workspace with a focused Saved → Practice → Vault → Progress journey.

**Architecture:** Keep the existing Next.js App Router, Supabase repositories, durable jobs, mastery rules, and model-gateway lifecycle. Add a shared authenticated shell and feature-local view composition; enrich Practice HTTP responses from already persisted artifacts, senses, occurrences, and snapshots without changing the database. Client components own transient UI state only, while every route retains server-side authentication and every data query remains owner scoped.

**Tech Stack:** Next.js 16.3 App Router, React 19, TypeScript 5, CSS Modules plus global design tokens, Supabase, Zod, Vitest/Testing Library, Playwright, Manifest V3 Chrome extension.

**Spec:** `docs/superpowers/specs/2026-09-05-popcorn-unified-learning-workspace-design.md`

## Global Constraints

- Support only the currently watched YouTube video; do not add text, URL, image, screenshot, upload, or video-file inputs.
- Preserve background saving: saving must not pause playback, navigate YouTube, or display a form.
- Saved stores learning snapshots and never stores video files.
- Mastery remains exactly `tried -> reused -> owned`; AI never decides mastery or scheduling.
- Rendering Home, Saved, Vault, Progress, navigation, or a hint must not call a transcript, translation, or AI Provider.
- Natural Chinese revision is returned by the existing evaluation Provider call and is not stored in a new database field.
- Do not add a database migration, root dependency, lockfile change, pgvector, graph, chat retrieval, export, commercial quota, billing, observability dashboard, or concurrency platform.
- Use fixed fixtures in automated tests; use a real Provider only for the final manual demonstration.
- Preserve owner scoping, RLS, write-only gateway credentials, deterministic idempotency, durable queue recovery, and nonleaking public errors.
- The Web interface remains English for an English-speaking Mandarin learner; Chinese examples use `lang="zh-CN"`.
- Reflow without horizontal scrolling at 320 CSS pixels; use a left rail from 900 CSS pixels upward and compact top navigation below 900.
- Read the relevant local Next.js 16 documentation in `node_modules/next/dist/docs/01-app/` before modifying App Router, Server/Client Component, redirect, or CSS behavior.
- Every implementation task starts from an integrated baseline, uses a dedicated worktree, records RED and GREEN evidence, commits its allowlisted files, receives an independent read-only review, and is integrated only after PASS.
- Do not add or commit the existing unrelated `next-env.d.ts`, `.DS_Store`, `AGENTS.md`, `CLAUDE.md`, or `extension/.DS_Store` changes.

## Upstream and license boundary

- YouTube Digest is pinned at `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`. This plan changes only Popcorn navigation and presentation around already reused acquisition code; do not create a second transcript or side-panel acquisition implementation. Preserve `extension/UPSTREAM.md` and MIT attribution.
- LLM Wiki is pinned at `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6` (`v0.6.9`). Reuse only the already documented methods; do not copy its GPLv3 code, prompts, tests, components, or assets.
- No task in this plan introduces third-party source copying. Reviewers must still run the provenance checks at the final gate.

## File ownership and execution waves

| Wave | Task | Owner | Dependency | Exclusive files |
| --- | --- | --- | --- | --- |
| 0 | 1. Shell and routing | fresh feature Agent | approved spec | root page, auth redirect, app layout, global CSS, shell files, settings route placement |
| 1 | 2. Saved workspace | fresh feature Agent | Task 1 | Saved pages/components/API/tests |
| 1 | 3. Progress workspace | fresh feature Agent | Task 1 | Progress page/components/tests |
| 1 | 4. Gateway and extension entry | fresh feature Agent | Task 1 | model-gateway component/CSS/tests and extension entry/tests |
| 2 | 5. Home decision workspace | fresh feature Agent | Tasks 2–4 | Home page/runtime/components/tests |
| 2 | 6. Practice view contracts | Controller | Task 1 | shared Practice contract, evaluation prompt/services, Practice material repository/tests |
| 3 | 7. Focused Practice UX | fresh feature Agent | Task 6 | Practice pages/components/CSS/tests |
| 3 | 8. Vault list and detail UX | fresh feature Agent | Task 6 | Vault page/components/repository/tests |
| 4 | 9. Integrated acceptance | Controller | Tasks 1–8 | E2E, accessibility, user guide, ledger, checkpoint |

The waves describe dependency readiness, but implementation and review dispatches run one task at a time under the required subagent-driven-development protocol. Tasks 5 and 6 run sequentially under the Controller because Task 6 owns a shared contract. Task 6 places Practice material reads in a dedicated repository so Task 8 does not have to undo Practice repository work.

---

### Task 1: Build the authenticated shell and smart entry routing

**Files:**

- Create: `src/features/shell/app-shell.tsx`
- Create: `src/features/shell/app-navigation.tsx`
- Create: `src/features/shell/gateway-notice.tsx`
- Create: `src/features/shell/app-shell.module.css`
- Create: `src/features/shell/app-shell.test.tsx`
- Create: `src/app/(app)/settings/model-gateway/page.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/page.test.tsx`
- Modify: `src/app/sign-in/page.tsx`
- Modify: `src/app/sign-in/page.test.tsx`
- Modify: `src/app/sign-in/sign-in.module.css`
- Modify: `src/server/auth/web-auth-flow.ts`
- Modify: `src/server/auth/web-auth-flow.test.ts`
- Delete: `src/app/settings/model-gateway/page.tsx`

**Interfaces:**

- Consumes: `createWebAuthFlowHandlers(...).getPageAccount()`, `createWebSessionAuthenticator(...)`, `GET /api/v1/settings/model-gateway`.
- Produces:
  ```ts
  export type AppShellAccount = { readonly email?: string };
  export function AppShell(props: {
    readonly account: AppShellAccount;
    readonly children: React.ReactNode;
  }): React.JSX.Element;
  export function AppNavigation(): React.JSX.Element;
  export function GatewayNotice(): React.JSX.Element;
  ```
- The route `/settings/model-gateway` remains unchanged because the `(app)` group does not enter the URL.

**Upstream reuse:** Use the existing Popcorn Web session and gateway settings API. No upstream UI code is copied.

- [ ] **Step 1: Write failing shell, root, and auth tests**

Add assertions equivalent to:

```tsx
expect(redirect).toHaveBeenCalledWith("/sign-in"); // anonymous /
expect(redirect).toHaveBeenCalledWith("/home"); // authenticated /
expect(response.headers.get("location")).toBe("https://popcorn.example/home");
expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
expect(screen.getByRole("link", { name: "Saved" })).toHaveAttribute("aria-current", "page");
expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
  "href",
  "/settings/model-gateway",
);
```

Also assert a skip link, `main` landmark target, account text, sign-out form, gateway setup notice after an empty settings response, and no duplicate model-gateway route.

- [ ] **Step 2: Run the focused tests and capture RED**

Run:

```bash
pnpm vitest run src/app/page.test.tsx src/app/sign-in/page.test.tsx src/server/auth/web-auth-flow.test.ts src/features/shell/app-shell.test.tsx
```

Expected: FAIL because root renders the old heading, auth redirects to settings, and shell components do not exist.

- [ ] **Step 3: Implement smart routing and the shell**

Implement root as a Server Component using the existing scoped environment and auth flow:

```tsx
export default async function RootPage() {
  const environment = getModelGatewaySettingsEnv();
  const account = await createWebAuthFlowHandlers({
    appUrl: environment.APP_URL,
    supabaseUrl: environment.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    cookieStore: await cookies(),
  }).getPageAccount();
  redirect(account.authenticated ? "/home" : "/sign-in");
}
```

Implement client route awareness in `AppNavigation` using `usePathname()`; mark a link active when the current path equals its href or starts with `${href}/`. Wrap it in `Suspense` from the Server Component layout. The shell renders a desktop rail, compact top navigation, `<div id="main-content">` around page-owned `main` landmarks, account/sign-out controls, and `GatewayNotice`.

Define the shared tokens in `globals.css`:

```css
:root {
  --paper: #fffdf8;
  --cream: #f6f0e5;
  --cocoa: #2f241f;
  --coral: #dd6048;
  --success: #2f7d59;
  --attention: #a76712;
  --danger: #b33a32;
  --radius-sm: 0.625rem;
  --radius-lg: 1.25rem;
  --shadow-paper: 0 12px 36px rgb(47 36 31 / 0.08);
}
```

Keep `GatewayNotice` client-side and fetch only the existing settings endpoint. Render nothing when any config is `active`; otherwise render one action linking to settings. Do not reveal IDs, keys, or response bodies.

- [ ] **Step 4: Move Settings into the route group and update Sign in**

Move only the route page into `src/app/(app)/settings/model-gateway/page.tsx` and import the existing component by absolute path. Remove the old page so only one URL resolves. Change successful sign-in/sign-up and the signed-in Sign in CTA to `/home`.

- [ ] **Step 5: Verify GREEN and responsive semantics**

Run:

```bash
pnpm vitest run src/app/page.test.tsx src/app/sign-in/page.test.tsx src/app/sign-in/sign-in-form.test.tsx src/server/auth/web-auth-flow.test.ts src/features/shell/app-shell.test.tsx tests/accessibility/web-states.test.tsx
pnpm typecheck
```

Expected: all focused tests pass; TypeScript reports no duplicate route or client/server boundary error.

- [ ] **Step 6: Commit**

```bash
git add src/app src/features/shell src/server/auth/web-auth-flow.ts src/server/auth/web-auth-flow.test.ts
git commit -m "feat: add the unified Popcorn app shell"
```

### Task 2: Turn Saved into a scan-friendly learning bridge

**Files:**

- Create: `src/features/saved/saved-library.tsx`
- Create: `src/features/saved/saved-workspace.module.css`
- Create: `src/features/saved/saved-library.test.tsx`
- Create: `src/features/saved/saved-video-detail.tsx`
- Create: `src/features/saved/saved-video-detail.test.tsx`
- Modify: `src/app/(app)/saved/page.tsx`
- Modify: `src/app/(app)/saved/[videoSourceId]/page.tsx`
- Modify: `src/features/saved/api.ts`
- Modify: `src/features/saved/video-card.tsx`
- Modify: `src/features/saved/saved-timeline.tsx`
- Modify: `src/features/saved/candidate-list.tsx`
- Modify: `src/features/saved/candidate-expression.tsx`
- Modify: corresponding `src/features/saved/*.test.tsx`
- Test: `tests/integration/saved/video-library.test.ts`

**Interfaces:**

- Consumes: `SavedVideoSummary`, `SavedVideoDetail`, existing candidate recovery endpoint, existing Practice task endpoint.
- Produces:
  ```ts
  export type SavedLibraryFilter = "all" | "ready" | "processing";
  export function SavedLibrary(props: {
    readonly videos: readonly SavedVideoSummary[];
  }): React.JSX.Element;
  export function SavedVideoDetailView(props: {
    readonly video: SavedVideoDetail;
    readonly deletionImpact: SourceDeletionImpact;
  }): React.JSX.Element;
  ```
- `SavedVideoSummary` gains an internal `latestSavedItemId` tie-break field if needed; it never exposes a raw ID in visible copy.

**Upstream reuse:** Retain existing YouTube canonical URLs, persisted thumbnails, timestamps, and YouTube Digest provenance. Do not fetch or reconstruct transcripts in the page.

- [ ] **Step 1: Write failing Saved library and detail tests**

Assert All/Ready to learn/Processing controls appear only when multiple states exist, cards expose thumbnail/title/channel/count/latest activity, and ordering follows:

```ts
expect(groupSavedVideos(rows).map(({ sourceId }) => sourceId)).toEqual([
  "source-with-ascending-latest-item-id",
  "source-with-later-source-id",
]);
```

Assert raw Chinese and stored English remain visible beside a terminal failure, invalid or missing candidate analysis offers exactly one `Retry analysis` button, candidate action says `Practice this expression`, and no text claims the expression is already in Vault.

- [ ] **Step 2: Run focused tests and capture RED**

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx
```

Expected: FAIL because filters/detail composition do not exist and recovery copy is still `Retry organizing`.

- [ ] **Step 3: Implement the Saved library**

Use a client-only filter over the already supplied video array:

```ts
const filtered = videos.filter((video) =>
  filter === "all"
    || (filter === "ready" && video.processingState === "ready")
    || (filter === "processing" && video.processingState !== "ready"),
);
```

Style cards as responsive paper surfaces and keep the entire title link as the navigation target. Format dates with a deterministic locale option and preserve semantic headings.

- [ ] **Step 4: Implement the Saved detail bridge**

Move page composition into `SavedVideoDetailView`. Keep raw moments before generated artifacts, render overview/chapters only when already present, and place candidate cards under their saved item. For absent or unusable analysis, call the existing per-item recovery endpoint once and use states `Retry analysis`, `Starting analysis…`, `Set up model gateway`, and a generic safe retry error.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm vitest run tests/integration/saved/video-library.test.ts src/features/saved/saved-library.test.tsx src/features/saved/saved-video-detail.test.tsx src/features/saved/candidate-list.test.tsx src/features/saved/saved-timeline.test.tsx tests/integration/knowledge/source-traceability.test.ts
pnpm typecheck
```

Expected: all focused tests pass; raw saves remain present in every tested failure state.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(app)/saved' src/features/saved tests/integration/saved/video-library.test.ts
git commit -m "feat: redesign Saved as the learning bridge"
```

### Task 3: Present Progress as evidence-based growth

**Files:**

- Create: `src/features/progress/progress-dashboard.module.css`
- Modify: `src/app/(app)/progress/page.tsx`
- Modify: `src/features/progress/progress-dashboard.tsx`
- Modify: `src/features/progress/progress-dashboard.test.tsx`

**Interfaces:**

- Consumes: unchanged `ProgressSummary`.
- Produces: only presentation; the five existing metrics and three mastery states remain exact.

**Upstream reuse:** Reuse the current Progress repository and schema; no upstream or Provider code is involved.

- [ ] **Step 1: Write failing Progress presentation tests**

```tsx
expect(screen.getByRole("heading", { name: "Your Mandarin in use" })).toBeVisible();
expect(screen.getByRole("link", { name: "Practice 1 due expression" })).toHaveAttribute("href", "/practice");
expect(screen.getAllByRole("progressbar")).toHaveLength(3);
expect(screen.queryByText(/streak|points|saved total|leaderboard/i)).not.toBeInTheDocument();
```

Also assert the no-due state uses a secondary link to Saved and explains that mastery records highest evidence.

- [ ] **Step 2: Run the test and capture RED**

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx
```

Expected: FAIL because the current dashboard is an unstyled pair of lists.

- [ ] **Step 3: Implement compact metrics and labeled mastery bars**

Render four metric cards and three directly labeled bars with:

```tsx
<div
  role="progressbar"
  aria-label={`${label} expressions`}
  aria-valuemin={0}
  aria-valuemax={Math.max(1, total)}
  aria-valuenow={value}
/>
```

Use only values from `ProgressSummary`. Do not derive streaks, percentage improvement, or collection totals.

- [ ] **Step 4: Verify GREEN and commit**

```bash
pnpm vitest run src/features/progress/progress-dashboard.test.tsx tests/integration/progress/progress-summary.test.ts
pnpm typecheck
git add 'src/app/(app)/progress/page.tsx' src/features/progress
git commit -m "feat: clarify evidence-based Progress"
```

### Task 4: Integrate model settings and the extension's Web entry

**Files:**

- Modify: `src/app/settings/model-gateway/model-gateway-settings.tsx`
- Modify: `src/app/settings/model-gateway/model-gateway-settings.module.css`
- Modify: `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- Modify: `extension/sidepanel.html`
- Modify: `extension/sidepanel.js`
- Modify: `extension/background.js`
- Modify: `extension/tests/saved-panel.test.js`
- Modify: `extension/tests/release.test.js`

**Interfaces:**

- Consumes: existing model-gateway GET/PUT/POST/DELETE endpoints and `POPCORN_API_ORIGIN`.
- Produces: trusted extension action `openPopcorn` that opens `${POPCORN_API_ORIGIN}/`; Chrome options continues to use `openOptions`.

**Upstream reuse:** Preserve the existing trusted-sender validation and Chrome extension worker structure inherited from YouTube Digest. Do not add another background worker.

- [ ] **Step 1: Write failing gateway and extension entry tests**

Assert the gateway page has one setup form, one configured list, no duplicate confirmation section, session-entered API key remains visible according to the approved personal-use behavior, and account fields never populate gateway fields.

For the extension:

```js
assert.equal(button.textContent.trim(), "Open Popcorn");
assert.deepEqual(sentMessage, { action: "openPopcorn" });
assert.equal(createdTab.url, "http://127.0.0.1:3000/");
```

Also prove `openOptions` remains accepted only from the extension-specific connection page or its existing trusted recovery path.

- [ ] **Step 2: Run focused tests and capture RED**

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js
```

Expected: FAIL because the header action still opens Chrome options and the gateway component still owns page-level chrome already supplied by the shell.

- [ ] **Step 3: Restyle settings inside the shell**

Remove duplicate product header/sign-out ownership from `ModelGatewaySettings`; retain all configuration, consent, rotation, revocation, and API-key behavior. Use the shared form tokens and keep one visible configuration form plus one list.

- [ ] **Step 4: Implement `Open Popcorn`**

Rename the header button and send `{ action: "openPopcorn" }`. In the background worker, accept it only from the trusted Side Panel sender and open:

```js
const url = new URL("/", POPCORN_API_ORIGIN).toString();
chrome.tabs.create({ url });
```

Leave `chrome.runtime.openOptionsPage()` for extension connection recovery only.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm vitest run src/app/settings/model-gateway/model-gateway-settings.test.tsx tests/integration/model-gateway/settings-web-auth.test.ts
node --test extension/tests/saved-panel.test.js extension/tests/release.test.js extension/tests/auth.test.js
git add src/app/settings/model-gateway extension/sidepanel.html extension/sidepanel.js extension/background.js extension/tests
git commit -m "feat: connect the extension to the Popcorn workspace"
```

### Task 5: Build the one-action Home workspace

**Files:**

- Create: `src/features/home/home-view.ts`
- Create: `src/features/home/home-runtime.ts`
- Create: `src/features/home/home-dashboard.tsx`
- Create: `src/features/home/home-dashboard.module.css`
- Create: `src/features/home/home-dashboard.test.tsx`
- Create: `src/features/home/home-runtime.test.ts`
- Modify: `src/features/home/next-action.tsx`
- Modify: `src/app/(app)/home/page.tsx`

**Interfaces:**

- Consumes: `createSavedLibraryService(...).home()`, `createSavedLibraryService(...).list()`, `ProgressRepository.read()`, and owner-scoped model-gateway configuration rows.
- Produces:
  ```ts
  export type HomeView = {
    readonly hasActiveGateway: boolean;
    readonly duePracticeCount: number;
    readonly unsortedSaveCount: number;
    readonly recentVideo: SavedVideoSummary | null;
    readonly masteryDistribution: {
      readonly tried: number;
      readonly reused: number;
      readonly owned: number;
    };
  };
  export function selectNextAction(view: HomeView): HomeNextAction;
  ```

**Upstream reuse:** Compose existing bounded repositories; do not query Providers or the extension.

- [ ] **Step 1: Write failing decision-table and composition tests**

```ts
expect(selectNextAction({ ...view, hasActiveGateway: false }).kind).toBe("gateway");
expect(selectNextAction({ ...view, duePracticeCount: 2 }).href).toBe("/practice");
expect(selectNextAction({ ...view, duePracticeCount: 0, unsortedSaveCount: 3 }).href).toBe("/saved");
expect(selectNextAction({ ...emptyView, hasActiveGateway: true })).toEqual({
  kind: "youtube",
  href: "https://www.youtube.com/",
});
```

Assert only one element uses the primary-action class, recent video uses the first deterministically sorted Saved summary, and mastery distribution equals Progress data.

- [ ] **Step 2: Run focused tests and capture RED**

```bash
pnpm vitest run src/features/home/home-dashboard.test.tsx src/features/home/home-runtime.test.ts
```

Expected: FAIL because the current Home view lacks gateway, recent video, and mastery data.

- [ ] **Step 3: Implement bounded Home composition**

Build one service-role Supabase client in `home-runtime.ts`, authenticate once, and use existing repository factories. Determine `hasActiveGateway` from owner-scoped configs with `state === "active"`. Return exactly the `HomeView` fields and no IDs, secrets, prompts, or Provider output.

- [ ] **Step 4: Implement the dashboard**

Render one primary CTA from the approved top-to-bottom decision table, then secondary mastery and recent-video modules. When the gateway is missing, keep Saved and mastery content visible.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm vitest run src/features/home tests/integration/saved/video-library.test.ts tests/integration/progress/progress-summary.test.ts
pnpm typecheck
git add 'src/app/(app)/home/page.tsx' src/features/home
git commit -m "feat: add the action-oriented Home workspace"
```

### Task 6: Enrich Practice material and evaluation responses without a migration

**Files:**

- Create: `src/features/practice/material-schema.ts`
- Create: `src/server/repositories/practice-material-repository.ts`
- Create: `src/server/repositories/practice-material-repository.test.ts`
- Modify: `src/contracts/practice.ts`
- Modify: `src/server/ai/prompts/evaluate.v1.ts`
- Modify: `src/server/domain/create-practice-task.ts`
- Modify: `src/server/domain/create-transfer-task.ts`
- Modify: `src/server/domain/complete-due-practice.ts`
- Modify: `src/server/repositories/attempt-repository.ts`
- Modify: `src/app/api/v1/practice/tasks/route.ts`
- Modify: `src/app/api/v1/practice/due/[reviewTaskId]/route.ts`
- Modify: related domain and integration tests under `src/server/**` and `tests/integration/practice/**`

**Interfaces:**

- Consumes: persisted candidate artifact for `use_it_now`; persisted expression sense, occurrence, review task, and snapshot for due Practice.
- Produces:
  ```ts
  export type PracticeMaterialView = {
    readonly task: PracticeTask;
    readonly masteryState: "tried" | "reused" | "owned";
    readonly source: {
      readonly videoTitle: string;
      readonly youtubeUrl: string;
      readonly evidenceText: string;
      readonly startSeconds: number;
    };
    readonly expression: {
      readonly englishMeaning: string;
      readonly englishExplanation: string;
      readonly tone: string;
      readonly communicativeFunction: string;
      readonly register: string;
    };
  };
  export const PracticeCoachingSchema = z.strictObject({
    naturalRevisionChinese: TargetChineseTextSchema.max(5_000),
  });
  export type PracticeCoaching = {
    readonly naturalRevisionChinese: string;
  };
  export const PracticeAttemptResponseSchema = z.strictObject({
    attempt: AttemptRecordedSchema,
    coaching: PracticeCoachingSchema.nullable(),
  });
  ```
- Initial evaluation responses include `coaching: PracticeCoaching`; replay from persisted dimensions may return `coaching: null` because coaching is intentionally transient.

**Upstream reuse:** Reuse the existing activation/evaluation prompts, artifact schema, expression graph, deterministic receipt, and Provider resolver. No LLM Wiki prompt or code may be copied.

- [ ] **Step 1: Write failing material provenance tests**

Create owner-scoped fixtures and assert:

```ts
expect(material).toMatchObject({
  masteryState: "tried",
  source: {
    videoTitle: "Fixture video",
    evidenceText: "这也太离谱了。",
    startSeconds: 42,
  },
  expression: {
    englishMeaning: "That is outrageous.",
    communicativeFunction: "reaction",
  },
});
expect(JSON.stringify(material)).not.toMatch(/api[_-]?key|gatewayConfigId|userId/i);
```

Cover both immediate candidate provenance and due expression provenance, missing/cross-owner graphs, deterministic snapshot selection, and timestamp URL construction.

- [ ] **Step 2: Write failing one-call coaching and replay tests**

Change the fixture Provider output to include:

```ts
{
  passed: true,
  accuracy: { score: 4, englishFeedback: "Meaning is clear." },
  naturalness: { score: 4, englishFeedback: "Natural in conversation." },
  contextualFit: { score: 5, englishFeedback: "Fits the situation." },
  independentUse: true,
  assistanceLevel: "none",
  naturalRevisionChinese: "这个价格也太离谱了吧。"
}
```

Assert one Provider call returns both persisted dimensions and transient coaching; the existing attempt insert/RPC receives no revision field; exact completion replay makes zero Provider calls and returns `coaching: null`; conflicting response remains a conflict.

- [ ] **Step 3: Run focused tests and capture RED**

```bash
pnpm vitest run src/server/repositories/practice-material-repository.test.ts src/server/domain/complete-due-practice.test.ts tests/integration/practice/attempts.test.ts tests/integration/practice/due-transfer.test.ts
```

Expected: FAIL because Practice material and natural revision are not in current response contracts.

- [ ] **Step 4: Implement local view schemas and the dedicated repository**

Keep persisted `EvaluationResultSchema` fields unchanged. Add a strict Provider result schema that combines those fields with `naturalRevisionChinese`, split it before persistence, and return the revision only as `PracticeCoaching`. Implement `findImmediateMaterial(userId, taskId)` and `findDueMaterial(userId, reviewTaskId)` with explicit owner filters and bounded single-record queries.

- [ ] **Step 5: Update evaluation prompt and both services**

Replace the old no-rewrite instruction with:

```ts
"Return one concise naturalRevisionChinese after the learner has submitted; it must preserve the intended meaning and include the target expression."
```

Call `gateway.complete(...)` exactly once. Feed only existing prompt material and learner response. Continue storing only the three dimensions, pass/independent/assistance fields, and existing provenance.

- [ ] **Step 6: Verify GREEN, shared-contract regressions, and no migration**

```bash
pnpm vitest run src/server/repositories/practice-material-repository.test.ts src/server/domain/complete-due-practice.test.ts tests/integration/practice/attempts.test.ts tests/integration/practice/due-transfer.test.ts tests/integration/learning-loop/record-valid-attempt.test.ts tests/integration/knowledge/source-traceability.test.ts tests/contract/shared-contracts.test.ts
pnpm typecheck
git diff --name-only | rg '^supabase/migrations/' && exit 1 || true
```

Expected: all tests pass and the migration guard prints no path.

- [ ] **Step 7: Commit**

```bash
git add src/contracts/practice.ts src/features/practice/material-schema.ts src/server/ai/prompts/evaluate.v1.ts src/server/domain src/server/repositories/practice-material-repository.ts src/server/repositories/practice-material-repository.test.ts src/server/repositories/attempt-repository.ts src/app/api/v1/practice tests/integration/practice
git commit -m "feat: enrich Practice material and coaching"
```

### Task 7: Build the focused three-item Practice experience

**Files:**

- Create: `src/features/practice/practice-workspace.module.css`
- Create: `src/features/practice/practice-material.tsx`
- Modify: `src/app/(app)/practice/page.tsx`
- Modify: `src/app/(app)/practice/[taskId]/page.tsx`
- Modify: `src/features/practice/due-practice.tsx`
- Modify: `src/features/practice/due-practice.test.tsx`
- Modify: `src/features/practice/practice-session.tsx`
- Modify: `src/features/practice/practice-session.test.tsx`
- Modify: `src/features/practice/evaluation-panel.tsx`
- Create or modify: `src/features/practice/evaluation-panel.test.tsx`
- Modify: `src/features/practice/api.ts`

**Interfaces:**

- Consumes: `PracticeMaterialView`, `PracticeCoaching`, existing due GET/POST endpoints, existing immediate attempt/revision endpoints.
- Produces: a client-only queue of at most three due review IDs; no session table or draft-answer persistence.

**Upstream reuse:** Use the existing Practice endpoints and deterministic completion receipt. Do not issue a second Provider request for hint or coaching.

- [ ] **Step 1: Write failing due-session tests**

Assert input tasks are sorted by `dueAt` then `reviewTaskId`, only the first three are selected, duration is `Math.min(6, selected.length * 2)`, completion advances to the next local item, Stop returns to the landing state without a mutation, and empty state links to Saved and Vault.

```tsx
expect(screen.getByText("3 due · about 6 minutes")).toBeVisible();
expect(fetch).toHaveBeenCalledWith("/api/v1/practice/due/first-id", expect.anything());
expect(screen.getByText("2 left in this session")).toBeVisible();
```

- [ ] **Step 2: Write failing focused-task tests**

Assert source title/timestamp, meaning, mastery, evidence disclosure, answer-free situation, and hint metadata render. Opening `Need a hint?` changes submitted `assistanceLevel` to `hint` and does not call fetch. Assert duplicate submit is disabled, response survives failure, the eight-second message appears under fake timers, and feedback includes takeaway, dimensions, revision instruction, natural revision, mastery transition, due date, and remaining count.

- [ ] **Step 3: Run focused tests and capture RED**

```bash
pnpm vitest run src/features/practice/due-practice.test.tsx src/features/practice/practice-session.test.tsx src/features/practice/evaluation-panel.test.tsx
```

Expected: FAIL because current UI lists all tasks and omits source, hint, delayed state, coaching, and automatic advance.

- [ ] **Step 4: Implement the shared focused surface**

Use `PracticeMaterial` for immediate and due routes. Store only current text, selected IDs, hint-open state, response state, and completion in React state. Start the eight-second explanation with `window.setTimeout`; clear it in `finally` and on unmount.

- [ ] **Step 5: Implement feedback and continuation**

Render feedback in the approved order. Keep the textarea value on failure. On success, show `Practice recorded`, transition only when non-null, formatted next due date, remaining count, and buttons `Continue` and `Stop for now`. Never claim Vault promotion for a failed or revision-only pass.

- [ ] **Step 6: Verify GREEN and commit**

```bash
pnpm vitest run src/features/practice tests/integration/practice tests/integration/learning-loop/record-valid-attempt.test.ts tests/integration/knowledge/source-traceability.test.ts
pnpm typecheck
git add 'src/app/(app)/practice' src/features/practice
git commit -m "feat: create focused Mandarin Practice sessions"
```

### Task 8: Make Vault compact and add expression detail

**Files:**

- Create: `src/app/(app)/vault/[userExpressionId]/page.tsx`
- Create: `src/features/vault/vault-workspace.module.css`
- Create: `src/features/vault/vault-detail.tsx`
- Create: `src/features/vault/vault-detail.test.tsx`
- Modify: `src/app/(app)/vault/page.tsx`
- Modify: `src/features/vault/vault-list.tsx`
- Modify: `src/features/vault/expression-card.tsx`
- Modify: `src/features/vault/vault-search.tsx`
- Modify: `src/features/vault/vault-search.test.tsx`
- Modify: `src/server/repositories/review-task-repository.ts`
- Modify: `tests/integration/memory/vault-practice.test.ts`

**Interfaces:**

- Consumes: `LearningMemoryRepository.listVault()` and `getVault()`.
- Produces: compact summaries linking to `/vault/:userExpressionId`; detail uses the existing attempt-backed graph and adds a persisted snapshot title when available.

**Upstream reuse:** Reuse the existing bounded Vault repository and search RPC. Do not add semantic/vector search.

- [ ] **Step 1: Write failing compact-list and detail tests**

```tsx
expect(screen.getByRole("link", { name: /太离谱了/ })).toHaveAttribute(
  "href",
  "/vault/22222222-2222-4222-8222-222222222222",
);
expect(screen.queryByRole("heading", { name: "Attempt history" })).not.toBeInTheDocument();
```

For detail, assert expression metadata, source video title, evidence, YouTube timestamp, complete attempt history, generic source-deleted text, and no cross-owner record.

- [ ] **Step 2: Write failing search-disclosure tests**

Assert the prominent search and mastery chips are visible, advanced fields are inside a `Filters` disclosure, and no visible control or label contains `Video source ID`. Keep debounce, stale-response, retry, and keyboard tests.

- [ ] **Step 3: Run focused tests and capture RED**

```bash
pnpm vitest run src/features/vault/vault-search.test.tsx src/features/vault/vault-detail.test.tsx tests/integration/memory/vault-practice.test.ts
```

Expected: FAIL because the list expands history, links to hashes, exposes the raw source ID, and lacks a detail page.

- [ ] **Step 4: Implement compact list, filters, and detail**

Make `ExpressionCard` summary-only. Use mastery buttons to update the existing mastery query parameter; keep function/register/date fields in `<details>`. Remove the learner-entered source UUID field. Add owner-scoped snapshot-title composition to the repository and render one detail page after server-side authentication.

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm vitest run src/features/vault tests/integration/memory/vault-practice.test.ts src/server/repositories/expression-search-repository.test.ts
pnpm typecheck
git add 'src/app/(app)/vault' src/features/vault src/server/repositories/review-task-repository.ts tests/integration/memory/vault-practice.test.ts
git commit -m "feat: separate Vault summaries from expression detail"
```

### Task 9: Run the complete learner journey and delivery gate

**Files:**

- Modify: `tests/accessibility/web-states.test.tsx`
- Modify: `tests/e2e/saved-learning-loop.spec.ts`
- Modify: `tests/e2e/returning-learner.spec.ts`
- Modify: `tests/e2e/demo-acceptance.spec.ts`
- Modify: `docs/operations/user-guide.zh-CN.md`
- Modify: `docs/engineering/execution-ledger.md`
- Create: `docs/engineering/checkpoints/unified-learning-workspace.md`

**Interfaces:**

- Consumes: Tasks 1–8 integrated commits and fixed local fixtures.
- Produces: repeatable professor-demo path and a checkpoint containing exact commands, results, residual risks, and final commit.

**Upstream reuse:** Run `tests/provenance/youtube-digest.test.ts` and `tests/provenance/no-llm-wiki-code.test.ts`; preserve existing license files and provenance records.

- [ ] **Step 1: Extend E2E tests before visual cleanup**

Cover:

```text
extension Save
  -> Open Popcorn
  -> smart root/Home
  -> Saved raw moment
  -> Practice this expression
  -> learner response + one-call feedback
  -> Vault detail
  -> due Practice
  -> Progress evidence
```

Also cover signed-out root, missing gateway with accessible Saved, Provider failure with retained input/material, queued extension save while Web is unavailable, and 320/899/900/1440 CSS-pixel viewports.

- [ ] **Step 2: Run focused browser tests and capture any failure**

```bash
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts tests/e2e/returning-learner.spec.ts tests/e2e/demo-acceptance.spec.ts
```

Expected after Tasks 1–8: functional journey passes. Treat any layout, focus, route, or state failure as a defect and repair it with a failing regression test in the owning feature.

- [ ] **Step 3: Perform the final visual consistency pass**

Inspect Home, Saved list/detail, immediate Practice, due Practice, Vault list/detail, Progress, Settings, Sign in, empty states, processing states, and errors at the four target widths. Adjust only feature CSS or shared tokens; do not change data rules during this pass.

- [ ] **Step 4: Update the user guide and durable ledger**

Document that the extension's `Open Popcorn` action is the normal entry, where the learner configures a gateway, how Saved differs from Vault, how Practice affects mastery, how to stop/restart locally, and what queued/processing/failure messages mean. Record every accepted task baseline/head/review/verification in the ledger.

- [ ] **Step 5: Run the final proportional verification**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:provenance
pnpm build
node --test extension/tests/*.test.js
pnpm playwright test tests/e2e/saved-learning-loop.spec.ts tests/e2e/returning-learner.spec.ts tests/e2e/demo-acceptance.spec.ts
git diff --check
```

Run `pnpm db:test` only if an unexpected database or RLS file entered the diff; otherwise record that no schema boundary changed.

- [ ] **Step 6: Independent release review and commit**

The reviewer compares the complete range from the Task 1 baseline to the integrated HEAD and returns PASS only when the approved spec, accessibility, YouTube-only boundary, Provider-call limits, credential isolation, idempotency, queue recovery, MIT attribution, and GPL isolation all hold.

```bash
git add tests/accessibility tests/e2e docs/operations/user-guide.zh-CN.md docs/engineering
git commit -m "test: verify the unified Popcorn learning journey"
```

## Controller execution protocol

For each task, create `docs/engineering/briefs/unified-workspace-task-N.md` before dispatch. The brief records the plan/task number, current integration baseline SHA, absolute worktree path, exact allowlist and denylist, consumed/produced interfaces, expected RED test, GREEN commands, upstream pins and reused functions, and license boundary.

Each implementation Agent must:

1. read the approved spec, this plan, its brief, applicable `AGENTS.md`, relevant local Next.js docs, and the required TDD skill;
2. show RED evidence before implementation;
3. implement only the numbered task;
4. run the focused GREEN commands;
5. commit only allowlisted files;
6. write `docs/engineering/handoffs/unified-workspace-task-N.md`;
7. return commit SHA, tests, risks, and handoff path.

After the implementation Agent finishes, stop it and create a fresh read-only review Agent. The reviewer examines the entire baseline-to-HEAD diff, the spec, real reuse of existing code, MIT/GPL boundaries, owner isolation, RLS, idempotency, Provider-call count, queue behavior, accessible states, and tests. A failing review receives a fresh repair Agent, an added regression test, and another independent review. Only PASS commits are integrated. The Controller then runs the task's focused integration gate, updates the ledger, and reports one concise status line.
