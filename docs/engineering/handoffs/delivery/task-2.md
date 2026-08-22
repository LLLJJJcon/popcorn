# Delivery Task 2 handoff — deterministic classroom demo seed

Status: candidate `424bba497bd5067a414bf233efa1d4ed18cf21a0` was committed,
independently reviewed, and rejected. Review repair implementation is committed
as `3f64477b33697b1d50672108cde95bb2bfe1b0ca`; independent re-review is pending.

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

## Review repair 1 — causal schedule, exact origin, bounded errors

The independent review rejected the original candidate for two P1 and two P2
findings: the sequence-based task clock could put a task after its attempt and
did not derive reviews from accepted evidence; `/rest/v1` was accepted as a
client base URL; UUID account lookup hid Auth failures as an unknown user; and
database failures could append raw PostgREST/SQL text to CLI stderr.

Repair RED against the rejected candidate:

```text
TMPDIR=/private/tmp node_modules/.bin/vitest run tests/integration/demo/demo-seed.test.ts
Test Files  1 failed (1)
Tests       5 failed | 20 passed (25)
```

The concrete failures showed a `practice_tasks.created_at` later than its
attempt's `submitted_at`, both `/rest/v1` path variants being accepted, the
CLI formatter absent, and Auth/write/verification failures lacking fixed error
categories. A focused mutation cycle then proved URL normalization also
accepted `/.` and `/rest/../` until the validator compared the raw input with
the parsed origin.

The repair now normalizes the supplied clock to its UTC day and constructs each
expression from the preceding accepted evidence. Original tasks precede their
attempts; the first tried review is original completion + 24 hours; the reused
review is successful due completion + 7 days; owned maintenance is owned
completion + 30 days. Completed review, due task, attempt, and mastery event
references/timestamps agree exactly. The pending tried review is due at the day
anchor and the reused/owned maintenance reviews are future. Calls anywhere on
the same UTC day produce identical rows.

Only a raw loopback HTTP(S) origin, with an optional root slash, is accepted.
REST/Auth/arbitrary paths, trailing path variants, parser-normalized paths,
credentials, query, fragment, non-loopback hosts, and non-HTTP(S) schemes are
rejected. Auth, write, verification, configuration, and argument failures map
to a small fixed category set; unknown exceptions map to `unexpected failure`.
The CLI formatter never emits dependency messages, URL/key values, SQL detail,
or unbounded text.

Fresh GREEN after the repair:

```text
TMPDIR=/private/tmp node_modules/.bin/vitest run tests/integration/demo/demo-seed.test.ts
Test Files  1 passed (1)
Tests       27 passed (27)

TMPDIR=/private/tmp node_modules/.bin/vitest run tests/contract/local-auth-seed.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)

TMPDIR=/private/tmp pnpm typecheck
PASS

TMPDIR=/private/tmp pnpm eslint scripts/seed-demo.ts tests/integration/demo/demo-seed.test.ts
PASS

git diff --check
PASS
```

Against the already-clean disposable local database, without a reset, a stable
owner-b source marker was added to make preservation observable. The documented
CLI then ran twice for `owner-a@popcorn.test`. The two canonical result JSON
values and the two sorted task/review timestamp graphs were identical. Both
runs returned `demo_seeded` with the original per-table counts, mastery states
`tried:1,reused:1,owned:1`, `due_now=1`, and `future_maintenance=2`. The
normalized graph SHA-256 was
`5ae80ad34044c99f5972ee41347bb498b9c53215f89788b90408704a8d271c8c`, and
the exact owner-b source marker remained present. No credential or connection
value was printed or recorded.

Repair scope is only `scripts/seed-demo.ts`, the focused demo seed test, and
this handoff. The controller brief is unchanged from its already-recorded
commit. No fixture, GoTrue seed, package/lock/workspace file, migration,
generated type, application/extension/server code, ledger, or checkpoint was
modified. No Provider, reset, pgTAP, E2E, build, load, or network acquisition
ran. No upstream material was added; YouTube Digest MIT attribution and LLM
Wiki GPLv3 method-only isolation are unchanged. Local generated state is the
accepted demo graph plus the owner-b preservation marker in the disposable DB.
