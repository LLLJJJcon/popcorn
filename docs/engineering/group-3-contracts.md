# Group 3 frozen interface document

2026-11-01, Task3A. Controller released implementation on the separate `codex/phase1-group3-confirmed` branch after independent merged-source group2 verification PASS (1387 plus107 focused), initially while its PR waited only for publication. Group2 subsequently passed all GitHub CI and merged main at `0ff3bce4d3fba15e839cac9509b63e9bd4d11b54`. Shared schemas were tested RED/GREEN and published before B/C consumers began implementation. This engineering-flow adjustment does not change the product acceptance gate; group3 still requires separate independent acceptance before group4.

Authority: confirmed specification §5.2/5.13/5.14, full §6/16.3, the plan, and the explicit rulings below. Group2's accepted material/round-state/error/activation contracts remain unchanged. §6.12 has **nine** acceptance items, not six.

## Client-safe exports

New `src/contracts/today-practice.ts`, exclusively owned by A:

```ts
TodayPracticeKindSchema; type TodayPracticeKind = 'review'|'second_try'|'new';
TodayPracticeSummarySchema; type TodayPracticeSummary = {
  reviewCount:number; secondTryCount:number; newCount:number;
  estimatedMinutes:number; needsAnalysisCount:number; processingCount:number;
  nextPracticeAt:string|null; // ISO instant, UI formats in local timezone
};
TodayPracticeItemSchema; type TodayPracticeItem = TodayReviewItem|TodayCandidateItem;
TodayPracticeResponseSchema; type TodayPracticeResponse = {
  summary:TodayPracticeSummary; items:TodayPracticeItem[];
};
TodayPracticeNextResponseSchema; type TodayPracticeNextResponse = {
  summary:TodayPracticeSummary; item:TodayPracticeItem|null;
  remainingCount:number; resumed:boolean;
};
TodayPracticeRecentVideoSchema; type TodayPracticeRecentVideo = {
  sourceId:string; youtubeVideoId:string; canonicalUrl:string;
  title:string; channel:string; thumbnailUrl:string; savedCount:number;
  latestSavedAt:string; processingState:SavedItemStatus;
  practiceCount:number; needsAnalysisCount:number;
};
TodayPracticeHomeDataSchema; type TodayPracticeHomeData = {
  summary:TodayPracticeSummary; recentVideos:TodayPracticeRecentVideo[];
};
TodaySessionResultSchema; type TodaySessionResult = {
  id:string; kind:TodayPracticeKind; expression:string;
  outcome:'added'|'moved_up'|'practice_again_tomorrow'|'maintained'|'removed';
  priorMastery:MasteryState|null; newMastery:MasteryState|null;
  nextPracticeAt:string|null;
};
```

All counts/estimated minutes/overdue days are nonnegative integers. Every public item `id` is a UUID. Review ID is reviewTaskId; candidate ID is a deterministic UUID derived from `(owner,stable candidate key)` with a separate today-item scope. **Candidate ID survives New→Second try, artifact replacement and new practice rounds.** It is not taskId, artifactId, highlightId or attemptId. The raw candidate key need not be sent to the browser. A publishes `todayCandidateItemId(userId,candidateKey)` in the queue domain module for backend tests only.

For Home/Practice/session summaries, nextPracticeAt null means **omit the Next practice date line**; do not invent tomorrow or format an invalid date. A real instant is formatted in the user's local timezone. B may keep a tiny Home local-date helper; C reuses practice-controls. Neither imports server-only modules for formatting.

Items retain §6.9's common fields:

```ts
type TodayItemBase = {
  id:string; expression:string; meaningHere:string;
  mastery:MasteryState|null; dueAt:string|null; overdueDays:number;
  roundNumber:number|null; sourceVideoTitle:string|null; sourceId:string|null;
};
type TodayReviewItem = TodayItemBase & {
  kind:'review'; reviewTaskId:string; userExpressionId:string;
  mastery:MasteryState; dueAt:string; roundNumber:null;
};
type TodayCandidateItem = TodayItemBase & {
  kind:'second_try'|'new'; mastery:null;
  selection:{savedItemId:string;candidateArtifactId:string;candidateIndex:number};
  currentTaskId:string|null; roundStatus:'open'|'retry_scheduled'|null;
};
```

- A new card has currentTaskId/roundStatus/roundNumber/dueAt null. An unanswered open first round is New, currentTaskId is that same task, roundStatus open, roundNumber1; refresh never creates round2.
- `roundNumber` is the round the learner **will enter**, not necessarily the stored predecessor number: retry_scheduled stored round1 => row Round2; open round2 => row Round2 and same currentTaskId. Second try dueAt is inherited retryDueAt. Newly selected retry_scheduled cards activate a fresh round through the existing POST tasks route; they do not render the predecessor's answered task.
- `overdueDays = floor(max(0,now-dueAt)/24h)` on server UTC; New is0. Dates remain local in the UI. Source title may be null for retained canonical review evidence after source deletion; no source-recovery work is added here.

Also export one client-safe readonly `TODAY_PRACTICE_GROUPS` constant, in this exact order:

```ts
[
  {kind:'review',id:'reviews',label:'Reviews',description:'Due for review — use a Vault expression again in a new situation.'},
  {kind:'second_try',id:'second-tries',label:'Second tries',description:'Not in your Vault yet — one more try with a fresh question.'},
  {kind:'new',id:'new-expressions',label:'New expressions',description:'Analyzed from your saves — practice it for the first time.'},
]
```

Home links use `/practice#reviews`, `#second-tries`, `#new-expressions`. Both pages render the same constant. A adds `ESTIMATED_MINUTES_PER_ITEM=2` in the existing server learning-config; clients use server estimatedMinutes.

## Queue and classification rules

One owned current state feeds both count and list predicates; query/list/count never activates tasks or calls a model.

1. Review: owned review_tasks pending, due_at≤now, with owned canonical expression/sense. Order due_at ASC then review ID ASC. Do not derive the full queue/count from legacy listDue's100 rows.
2. Second try: candidate has no promotion receipt, latest current round is retry_scheduled or open round_number≥2, retry_due_at≤now. Order retry_due_at ASC then stable item ID ASC. Removed/superseded/promoted rounds cannot be current automatic items. A passed revision never promotes or changes this rule.
3. New: newest valid card per stable candidate key, explicit suitability expression and no practice rounds, or an existing unanswered latest open first round proving explicit Practice entry. This latter branch also includes not_expression and legacy cards that the user explicitly opened. Removed/promoted candidates are excluded. Order saved captured_at DESC then stable item ID ASC.

Rulings agreed with controller:

- **Retain historical generated cards.** Deduplicate by the group2 stable candidate key and take the newest readable/schema-valid card version for that key. Do not drop an older-only card because the newest artifact omits it. Do not add a still-active-highlight requirement to existing cards: group1 preserves generated cards when a mark is removed. Active marks are used only to count missing analyses.
- **Legacy suitability stays unknown.** Group1 v3 requires suitability, legacy candidates allow the field to be absent and no migration/normalizer proves they are expressions. Such untouched legacy cards are not automatically New. A stored open first round is explicit entry and is restored, including not_expression. Do not relabel missing suitability as not_expression or mutate old cards.
- Unpracticed automatic New cards come from visible saved bookmarks (`removed_from_saved_at is null`); existing manually opened rounds/Second tries retain their existing source graph when the bookmark is hidden, matching the bookmark remover's retain-learning-records behavior. Removing a practice item is different from removing a highlight/bookmark. Physically deleted source graphs have no candidate rows to restore. Review source-deletion recovery remains out of scope.
- needsAnalysisCount counts distinct visible ready non-video saves with at least one active mark lacking a generated valid card match (highlight identity/key or exact retained mark ID), not number of missing marks and not generic ready/processing counts. A's SQL predicate is shared by Home summary, per-video counts and Saved needs-analysis filtering.
- processingCount includes saved/resolving_source/organizing/**failed** saves as the specified secondary cue, excludes hidden bookmarks, and does not become Home's main action. Unsupported saves are not described as still processing.
- nextPracticeAt is the minimum future pending review due or current nonremoved/nonpromoted future retry due. It is null if none. Counts do not truncate at100/200/1000; estimatedMinutes is the full sum×2.

## Server exports and B's exact dependency

New `src/server/repositories/today-practice-repository.ts`:

```ts
export interface TodayPracticeRepository {
  summary(userId:string,now:string):Promise<TodayPracticeSummary>;
  itemsPage(userId:string,now:string,offset:number,limit:number):Promise<TodayPracticeItem[]>;
  next(userId:string,now:string,input:TodayNextInput):Promise<TodayPracticeNextResponse>;
  recentVideos(userId:string,now:string):Promise<TodayPracticeRecentVideo[]>; // exactly up to3
  needsAnalysisVideosPage(userId:string,now:string,offset:number,limit:number):Promise<TodayPracticeRecentVideo[]>;
}
export function createTodayPracticeRepository(client:SupabaseClient<Database>):TodayPracticeRepository;
```

New `src/server/domain/build-today-queue.ts`:

```ts
export type TodayNextInput = {
  exclude?:string[];
  currentItemId?:string; currentTaskId?:string;
};
export function createTodayPracticeService(repository:TodayPracticeRepository): {
  today(userId:string,now:string):Promise<TodayPracticeResponse>;
  next(userId:string,now:string,input?:TodayNextInput):Promise<TodayPracticeNextResponse>;
  home(userId:string,now:string):Promise<TodayPracticeHomeData>;
  needsAnalysisVideos(userId:string,now:string):Promise<TodayPracticeRecentVideo[]>;
};
```

- `today` and `needsAnalysisVideos` internally exhaust stable pages of at most200 rows; there is no maximum number of pages/items. Home uses exact summary+recent3, not the full item list. SQL performs count aggregation with the same eligibility predicates, not a count of a limited page.
- Recent3 is ordered by **latest visible saved timestamp across all owned sources**, not the legacy Saved reader's first100 sources by source creation. `savedCount`, practiceCount (currently eligible today's items attributable to that source) and needsAnalysisCount are full per-source aggregates. Metadata is persisted source/snapshot data, not a model call. TodayPracticeRecentVideo is structurally compatible with SavedVideoSummary, with the two count fields added.
- B's `createHomeLoader` dependency becomes `today:Pick<ReturnType<typeof createTodayPracticeService>,'home'>`. It calls `today.home(session.userId,now)` together with the existing gateway/progress reads. HomeView has hasActiveGateway, summary, recentVideos and the existing masteryDistribution; old duePracticeCount/unsortedSaveCount/recentVideo fields are removed.
- B's SavedPage recognizes only string `filter=needs-analysis`, awaits searchParams, and calls `service.needsAnalysisVideos(userId,now)` for the full qualified list. B owns its URL/local-tab behavior and routes All back to `/saved`; it must not label a prefiltered list as the full library.

New `src/server/today-practice-runtime.ts` exports `createTodayPracticeRuntime()` returning `{appUrl,authenticate,service,material}` for Practice pages and HTTP handlers. `material(userId:string,taskId:string):Promise<PracticeMaterialView|null>` delegates to the existing owned material reader. B Home runtime can construct repository/service using its existing client/authentication rather than self-fetching HTTP. All helpers operate only on the authenticated owner and one explicit UTC now per invocation.

## HTTP contracts, session entry and recovery

Outer envelope remains `{ok:true,data,requestId}` / the existing ApiFailure. All GET responses are no-store and authenticated; no public shared caching. POST next additionally uses current Origin/JSON/CSRF safeguards and a bounded64KiB JSON reader. Malformed UUIDs/requests or an oversized body return an explicit non-2xx VALIDATION_FAILED, never silent truncation. There is **no fixed excluded-ID count or session-item cap**.

| Route | Input | Success data |
| --- | --- | --- |
| GET `/api/v1/practice/today` | none | TodayPracticeResponse: all items, same full summary |
| GET `/api/v1/practice/today/next` | optional exclude comma-separated UUIDs; optional currentItemId/currentTaskId UUIDs | TodayPracticeNextResponse |
| POST `/api/v1/practice/today/next` | JSON TodayNextInput | identical TodayPracticeNextResponse, pure read |
| GET `/api/v1/practice/tasks/[taskId]` | owned task UUID | existing PracticeMaterialView directly inside data; model-free |

POST next is a controller-approved engineering companion to the specified GET: large exclusion lists must not hit URL limits. The runner uses POST; it may compact completed IDs to those still in a fresh current queue but never treats that payload as authority. Unknown/foreign valid excluded IDs simply match no owned eligible row. The endpoint independently scopes all reads; it never writes practice evidence or accepts summary claims as official state. Byte limits protect transport memory, not the number of items a session can finish.

Entry rules for C:

- Review: use existing GET `/practice/due/[reviewTaskId]` on entry, retaining its existing response/material contract. No due-generation/scoring/regen change in group3.
- New no task / Second retry_scheduled: existing POST `/practice/tasks` with item.selection; handle existing `{redirect}` safely after a concurrent promotion. Then GET the returned task's material. Only the current item is activated.
- New open1 / Second open≥2: GET currentTaskId's material directly, no new-round creation/model call. Standalone item entry returns to `/practice`; session mode stays in `/practice/session`.
- A valid **refresh hint** is `(currentItemId,currentTaskId)` for the owner's same stable candidate's current latest open task with no first answer. Restore that task even if its inherited retry date is future after manual Try a new situation. This does not enroll future retries in normal today counts. Invalid, foreign, superseded, removed or already answered hints are ignored and normal ordered next is chosen. Refresh/start may send the hint; explicit Next omits it.
- `resumed=true` identifies that validated continuation. remainingCount counts eligible nonexcluded items and includes a manually resumed current item exactly once if it was otherwise outside the queue/excluded. It never increments once per new round. Summary remains the ordinary queue summary used by Home.
- A Review refresh hint likewise requires the owner's pending due review and that same review's owned canonical due-practice task. It restores persisted material and does not generate another question. Once the review completes, its old hint is ignored.
- C may keep the refresh hint in URL/sessionStorage; it is untrusted navigation data, never evidence. Summary storage is optional/try-catch, owner/version scoped. Completed outcomes deduplicate by stable item ID; replacing the result after another round updates the same item, and revisions never add completed items.

## Session component handshake (C ownership)

Group2 PracticeSession already accepts mode/onNext/nextLabel/onCompleted/onRemoved/onRoundCreated. C adapts it, without changing standalone behavior:

- First answer/persisted FIRST_ANSWER_EXISTS feedback emits the authoritative roundState at most once per official answer. Summary derives added vs tomorrow from that state, not score guesses.
- onRoundCreated(taskId) keeps the stable item ID and left count, refreshes material through the new model-free GET, updates the current refresh hint, and never creates another summary entry.
- In session mode **Remove advances immediately** and emits `{taskId,undoUntil,roundState}` to the runner. The runner owns the five-second Undo toast across items; restoring calls existing restore endpoint, removes/replaces the Removed summary result and refreshes the queue. Standalone still uses its existing five-second return behavior. Existing onRemoved firing only at expiry is insufficient for group3.
- C extracts a single-item Review component from DuePractice and owns its onCompleted/onNext/nextLabel/navigation callbacks. It reuses existing due endpoints and does not implement group4 generation/masking/revisions.
- Outcomes: added=>Added to your Vault; moved_up=>actual Tried→Reused/Reused→Owned; failed/assisted=>Practice again tomorrow; removed=>Removed. Independent maintained reviews use the already confirmed §7.4 line `Nice — still {state}. Next practice {local date}` (controller ruling for §6.6's omitted normal case). movedUpCount only counts actual prior≠new transitions; owned30-day/reused7-day maintenance must not be mislabeled tomorrow.

## Single-owner file boundaries

| Owner | Exact responsibility |
| --- | --- |
| A queue/backend | contracts/today-practice.ts, domain/build-today-queue.ts and learning-config, repositories/today-practice-repository.ts and any server-only pool helpers, server/today-practice-runtime.ts, new today/next/material GET route handlers, new migration(s) after the reconciled latest version, generated types, new queue/HTTP/repository/SQL/contract tests. No Home/Practice UI files or saved/api.ts edits. |
| B Home/Saved | features/home/*, Home page if needed, features/saved/api.ts **sole owner** for display/legacy adapter cleanup, saved-library.tsx, Saved page and their UI/runtime tests. A supplies shared analysis-count predicates and full recent/needs-analysis data; B does not independently approximate them. |
| C Practice/session | Practice page, new session page/runner/summary/client API, DuePractice extraction, PracticeSession callbacks/runner Undo, shared practice controls/CSS/return-target integration and their UI tests. Uses A's schemas/constants/routes; no contracts/server/SQL writes. |
| Controller/assigned integration | seed/E2E/ledger/PR integration after A/B/C self-tests; separate D accepts all nine §6.12 items and affected invariants before group4. |

Required coverage includes2 review+1 second+3 new; >100 reviews and >200 new; >200 GET/POST excludes equivalence and over-byte error; open1/not_expression/legacy explicit restore; all-history dedup without per-card RPC; deleted-mark retained card; removed/promoted exclusions; retry round1→display/entry round2 and open2 reuse; current future-open resume; per-source counts and latest3 across >100 sources; first-answer/revision/new-round summary dedup; immediate Remove with cross-item Undo; storage failure; and no model calls in summary/list/next/material reads. Group4 remains gated on independent group3 PASS.
