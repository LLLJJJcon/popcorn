# CONTRACT-014 expression search handoff

## Scope

- Baseline: `0974be1943db1c981ba62eed2b59ee7e474d4e33`; brief commit `93809e8`.
- Controller-owned files: migration 013, focused pgTAP, generated public database types, this handoff.
- No feature, route, UI, root configuration, lockfile, Provider, gateway, extension, or existing migration changed.

## RED

`supabase test db supabase/tests/expression_search.sql` failed because the exact
nine-argument `public.search_expressions` function did not exist. pgTAP reported
the missing contract before the fixture could call it.

## Implementation

- Added immutable private NFKC plus punctuation/whitespace normalization.
- Added a trigram index on the persisted normalized Chinese expression.
- Added a service-role-only, security-definer RPC with fixed `pg_catalog`
  search path and explicit owner predicates throughout.
- Ranking is exact, prefix, substring, trigram, English meaning,
  communicative function, register, then recent for an empty query. Trigram
  ties use similarity, then all ranks use recency and UUID.
- Filters cover function, register, video source, mastery, and a half-open
  creation interval. Parameters and result limit are bounded.
- Source overlap counts distinct sources only across the requested owner's
  identically normalized expression senses.
- The function uses no dynamic SQL and treats `%`/`_` as literal search text.

## GREEN and verification

- Focused expression-search pgTAP: 16/16 PASS.
- Clean local reset applied migrations 001–013 and deterministic seed.
- Full pgTAP: 7 files, 586/586 PASS.
- Generated TypeScript types exactly matched a fresh local generation after
  removing the Supabase CLI's extra trailing blank line.
- `tsc --noEmit`: PASS.
- `git diff --check`: PASS.

## Upstream and license

The relational staged retrieval design is a method-only adaptation of LLM Wiki
at `723e259309aea5e3850265b631f80224f66dd9f6`. No GPLv3 source, tests, prompts,
components, or assets were copied. The pinned YouTube Digest MIT adaptation at
`d03e1f61e017b032159ffd1821cac6e7693ce0c7` is unchanged.

## Residual risk

The 0.2 trigram threshold is deliberately fixture-frozen for short Chinese
typos and may need product tuning after personal usage data exists. Task 1 must
consume this RPC rather than pre-limit rows in application code and must retain
its bounded owner-authenticated repository boundary.
