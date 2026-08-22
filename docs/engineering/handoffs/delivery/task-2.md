# Delivery Task 2 handoff — deterministic classroom demo seed

Status: implementation and clean local verification complete; commit pending.

## Scope and changed files

- `scripts/seed-demo.ts`
- `tests/fixtures/demo/youtube-video.ts`
- `tests/fixtures/demo/transcript.zh-CN.json`
- `tests/fixtures/demo/generated-artifacts.json`
- `tests/integration/demo/demo-seed.test.ts`
- this handoff

No package/lock/workspace configuration, migration, generated database type,
application, extension, server runtime, existing test/fixture, ledger, or
checkpoint file was changed.

## TDD evidence

Initial RED:

```text
TMPDIR=/private/tmp pnpm vitest run tests/integration/demo/demo-seed.test.ts
FAIL Failed to resolve import "../../../scripts/seed-demo"
Test Files 1 failed; Tests 0
```

Additional schema-driven RED cycles were captured before each correction:

- the documented `pnpm demo:seed -- --user ...` invocation exposed the leading
  `--`; the new parser assertion failed before the parser accepted it;
- the real database rejected the non-existent
  `expression_occurrences.source_deleted_at`; a focused row-contract assertion
  failed before the field was removed;
- `practice_task_text_check` rejected Chinese embedded in `goal_english`; the
  ASCII-English assertion failed before the goal was corrected;
- `review_tasks_one_pending_expression` rejected batching two completed-review
  placeholders for the owned expression; the in-memory repository reproduced
  the constraint before orchestration changed to one review at a time;
- the first cached overview failed the production `OverviewContentSchema`, and
  the production grounding validators failed before the final 64-hex segment
  references, exact quotes/timestamps, and one-save analysis were added.

Current focused GREEN:

```text
TMPDIR=/private/tmp pnpm vitest run tests/integration/demo/demo-seed.test.ts
Test Files 1 passed; Tests 16 passed

TMPDIR=/private/tmp pnpm typecheck
PASS

TMPDIR=/private/tmp pnpm eslint scripts/seed-demo.ts \
  tests/fixtures/demo/youtube-video.ts \
  tests/integration/demo/demo-seed.test.ts
PASS (no warnings)

git diff --check
PASS
```

## Fixture graph and stable identity

The fixture uses clearly labelled video ID `PopcornD3mo`, canonical YouTube
watch URL, acquisition time `2026-08-16T09:00:00.000Z`, and four short ordered
native `zh-CN` excerpts. It stores no media/video bytes or full third-party
transcript.

Both cached artifact bodies pass the existing production grounding validators:
the overview uses only persisted 64-hex stable segment IDs, matching timestamps,
and exact native quotes; the saved-item analysis contains one candidate grounded
only in the selected subtitle save. The other two expression definitions are
fixture graph inputs, not extra candidates attached to that saved item.

Each row UUID is SHA-256-derived from the versioned namespace, selected owner
UUID, and a named fixture record. UUID version/variant bits are normalized.
Therefore one owner's repeated runs reuse the same IDs while two owners cannot
collide. Result keys use a separate deterministic SHA-256 input.

Per-owner row counts are:

| Table | Rows |
| --- | ---: |
| `video_sources` | 1 |
| `video_snapshots` | 1 |
| `transcript_segments` | 4 |
| `saved_items` | 3 |
| `generated_artifacts` | 2 |
| `expression_senses` | 3 |
| `expression_occurrences` | 3 |
| `user_expressions` | 3 |
| `practice_tasks` | 6 |
| `attempts` | 6 |
| `mastery_events` | 6 |
| `review_tasks` | 6 |

The three current expression states are exactly one `tried`, one `reused`,
and one `owned`. Evidence chains contain respectively one, two, and three
independent passing attempts/events:

```text
null -> tried (valid_original_attempt)
tried -> reused (successful_independent_transfer)
reused -> owned (owned_threshold_met)
```

Every completed review points to its due task/attempt. Review cycles are seeded
with the minimum safe two-phase sequence: insert-ignore one pending placeholder,
write its due task/attempt/event, then finalize that review before starting the
next. This also repairs interrupted runs without temporarily producing two
pending reviews for one expression. Exactly one current pending review is due
at the explicit reference clock; the reused/owned maintenance reviews are
future-dated.

## Owner, local-only, and network boundaries

- The CLI requires exactly one `--user` email or UUID and resolves an already
  existing Auth account. Missing, malformed, unknown, or ambiguous selectors
  fail with bounded messages.
- It refuses non-loopback, credential-bearing, query-bearing, fragment-bearing,
  non-HTTP(S), or unexpected-path Supabase URLs. There is no bypass flag.
- Every fixture row contains the selected `user_id`; every public-table write
  verifies the owner, every verification read filters `user_id`, and only
  stable fixture IDs are upserted. No delete is used.
- The injected fixture test poisons `fetch`; two runs make no network or
  Provider call and preserve an unrelated owner's row.
- Cached JSON contains no API key, Provider response, base URL, request, token,
  cookie, service secret, or job secret. No model configuration or provenance
  row is seeded.

## Final local database evidence

The accepted controller prerequisite `b010832` made the two existing local
accounts readable by current GoTrue without changing their IDs, emails,
password hashes, or confirmation timestamps. Exactly one clean
`node_modules/.bin/supabase db reset` then applied migrations `001` through
`016` and `supabase/seed.sql`. Direct Auth admin verification returned HTTP 200,
two users, and exactly one ID/email match for `owner-a@popcorn.test`.

Against that clean database, the exact documented command
`pnpm demo:seed -- --user owner-a@popcorn.test` completed twice. Both runs
returned category `demo_seeded`, the exact table counts above, and identical
sorted IDs. The canonical JSON output was identical on both runs; its sorted
ID map SHA-256 was
`038ac72920e94b097eb02f4f2e78be303ffd6b61464986371070ca42fc570bbf`.
No credential value was printed or recorded. A separate read-only check
returned:

```text
unrelated_source_preserved=true
mastery=owned:1,reused:1,tried:1
due_now=1
```

## Upstream and licenses

No new YouTube Digest or LLM Wiki file, function, prompt, test, component,
asset, or sample data was consumed or copied. The existing YouTube Digest MIT
notice remains untouched; GPLv3 LLM Wiki remains method-only and unused here.
Pinned MIT `tsx@4.23.12` is used only as the local TypeScript CLI runner and is
not exposed in product data or distribution artifacts.

## Risks and generated state

- This local CLI intentionally uses ordered service-role upserts rather than a
  new database function or migration. A mid-run interruption is repaired by
  the next run; it does not delete unrelated rows.
- Temporary diagnostic files exist only under `/private/tmp` and are untracked.
  The disposable local database contains the clean-reset fixture graph.
- No Provider, browser E2E, build, pgTAP, load, or concurrency check was run.
