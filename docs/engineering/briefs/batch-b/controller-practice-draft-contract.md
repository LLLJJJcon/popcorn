# Batch B controller practice-draft contract

## Assignment

- Dependency for Batch B Task 4 and later Task 5 atomic promotion.
- Baseline: `cb20d89`; integration worktree `/private/tmp/popcorn-youtube-learning`.
- Controller-owned migration/generated types; feature Agents may only consume it.

## Contract conflict

Task 4 must persist activation context before showing it and preserve evaluated
revision history. Existing canonical `practice_tasks`/`attempts` require a real
`user_expressions` row. But the product and Batch B Tasks 3/5 require that no Vault,
mastery, or user-expression row exists until a valid original learner attempt is
atomically accepted. Creating a placeholder expression would violate that boundary;
keeping the task only in memory would violate persistence/recovery.

## Allowed files

- Create: `supabase/migrations/202608160011_practice_drafts.sql`
- Create: `supabase/tests/practice_drafts.sql`
- `src/types/database.generated.ts`
- Create: `docs/engineering/handoffs/batch-b/controller-practice-draft-contract.md`

Every other path is forbidden, including TypeScript contracts, application code,
root config/lockfile, existing migrations/tests, ledger, prompts, and upstream files.

## Contract to produce

### `public.practice_drafts`

- Owner-scoped UUID identity; exact `video_source_id`, `saved_item_id`,
  `candidate_artifact_id`, and zero-based `candidate_index` (0–2).
- `future_user_expression_id` is a preallocated UUID only; it has no FK to
  `user_expressions`. Task 5 must use this exact ID during atomic promotion.
- Persist target expression, Chinese situation, English instructions/goal,
  `en -> zh-CN`, `active|completed|abandoned`, timestamps, and activation prompt/
  model/config/revision/fingerprint provenance.
- Candidate artifact must be the same owner's `saved_item_analysis` for the exact
  YouTube source and saved item. Add only the composite immutable artifact key needed
  to enforce this FK.

### `public.practice_draft_attempts`

- Owner-scoped UUID identity; exact draft and same `future_user_expression_id`.
- Append-only positive `revision` unique per draft, original Chinese response,
  evaluation dimensions/English feedback, passed/independent/assistance, submission
  time, and exact evaluation prompt/model/config/revision/fingerprint provenance.
- This table preserves revisions but is not mastery evidence. Task 5 owns promotion
  into canonical `practice_tasks`, `attempts`, `user_expressions`, mastery and due
  Practice in one transaction.

### Ownership and provenance

- Enable RLS. `authenticated` may select only own rows; no direct insert/update/delete.
  `service_role` receives select/insert/update on drafts and select/insert on append-only
  attempt revisions; application code must still filter owner.
- Composite owner FKs prevent cross-user/source/save/artifact/draft mixing.
- Provenance is either all-null (deterministic CI/legacy fixture) or all five fields
  non-null and exactly bound, including model, to one immutable user gateway config.
- Store no API key, Vault ID, origin, URL, headers, prompts, request bodies, provider
  raw output, or logs.
- Existing canonical tables and mastery rules are unchanged.

## TDD protocol

RED must show migration absent and behavior gaps. GREEN pgTAP must prove at least:

- a valid owner candidate creates a persisted draft while `user_expressions`,
  canonical `practice_tasks`, `attempts`, and mastery remain absent;
- exact candidate/source/save and owner FKs reject cross-owner/cross-source rows;
- future expression ID is retained without creating its row;
- all-null provenance passes, exact five-field provenance passes, missing fingerprint
  and wrong model reject for both draft and attempt;
- two revisions append in order; duplicate revision and mismatched future expression
  reject; invalid response/scores/feedback/assistance reject;
- authenticated owner select works and another authenticated user sees zero; direct
  authenticated writes and anon access fail.

## Verification

```bash
pnpm db:reset
./node_modules/.bin/supabase test db supabase/tests/practice_drafts.sql
pnpm db:test
./node_modules/.bin/supabase gen types typescript --local
./node_modules/.bin/tsc --noEmit --pretty false
fixed-test-environment ./node_modules/.bin/next build --webpack
git diff --check
```

One clean reset/full pgTAP/build is justified because this is a shared migration.
Task 4 must not repeat them unless it changes a shared boundary.

## License

- No upstream implementation applies to the Popcorn persistence/RLS contract.
- Copy no YouTube Digest code.
- LLM Wiki is method-only; copy no GPLv3 code/tests/prompts/components/assets.

## Handoff

Record RED/GREEN, migration semantics, Task 4/5 consumer rules, remaining risks, and
independent-review requirement. Commit only allowed files.
