# CONTRACT-014 expression search review repair brief

- Plan/task: Batch C Task 1 prerequisite, CONTRACT-014 repair after independent review FAIL.
- Baseline commit: `129357e`.
- Worktree: `/private/tmp/popcorn-youtube-learning`; controller-owned repair.
- Allowed modifications: `supabase/migrations/202608160013_expression_search.sql`, `supabase/tests/expression_search.sql`, `docs/engineering/handoffs/batch-c/contract-014-expression-search-fix.md`, and this brief only. Generated types may change only if the public signature changes (not expected).
- Forbidden modifications: production TypeScript, feature files, existing migrations, root config, lockfile, Provider/gateway/extension, ledger before acceptance.
- RED requirements: persist the spaced/punctuated expression's `normalized_expression_text` exactly as the real promotion path does (NFKC + outer trim), proving exact/source-count currently fail; add non-null communicative-function filter, register `match_reason`, same-updated-at UUID tie, and index/operator alignment assertions.
- GREEN requirements: normalize both query and stored normalized values with the same immutable function; align the trigram expression index and actual `%` search predicate at the frozen 0.2 threshold; preserve exact→prefix→substring→trigram→metadata→recency order before limit, explicit owner scope, literal wildcard behavior, and service-only access.
- Verification: focused pgTAP, clean reset migrations 001–013, full pgTAP, generated-type exact comparison, TypeScript, diff-check. Do not rerun unrelated browser/build/application suites.
- Upstream/license: retain the method-only LLM Wiki reference at `723e259309aea5e3850265b631f80224f66dd9f6`; copy no GPLv3 code/tests/prompts/components/assets. YouTube Digest pinned MIT adaptation remains unchanged at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
