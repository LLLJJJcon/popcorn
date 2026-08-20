# Batch B controller AI contract — review fix 1

## Assignment

- Review target: controller AI contract for Batch B Tasks 1 and 4.
- Repair baseline: `281fd41` (includes candidate contract `31a923c` and independently accepted Task 2).
- Worktree: `/private/tmp/popcorn-batch-b-ai-contract-fix-1`.
- This is a controller-authorized repair of the unpublished migration 010. Do not add a migration 011.

## Blocking review findings

1. PostgreSQL treats a `CHECK` expression that evaluates to `NULL` as accepted.
   The activation/evaluation all-or-none expressions omit explicit `IS NOT NULL`
   predicates, so a row missing only the fingerprint can pass; the default
   `MATCH SIMPLE` composite foreign key then skips validation.
2. The composite provenance foreign keys do not include the stored model. A row can
   name an invented model while pointing at a real owner/config revision/fingerprint.

## Allowed files

- `supabase/tests/batch_b_ai_contract.sql`
- `supabase/migrations/202608160010_batch_b_ai_contract.sql`
- `docs/engineering/handoffs/batch-b/controller-ai-contract.md`

## Forbidden files

- Every other path, including generated types (no shape change is expected),
  application code, shared TypeScript contracts, root config/lockfile, ledger,
  upstream files, prompts, and Task 2 files.

## Required TDD protocol

1. Add focused tests proving both `practice_tasks` and `attempts` reject:
   - a provenance group missing only its fingerprint;
   - a complete-looking group whose model differs from the exact referenced user
   gateway config revision.
   Also add the two directly related contract regressions requested by review:
   - initial analysis registration rejects a saved item owned by the same user but
     attached to a different YouTube source;
   - revoking the pinned gateway terminalizes a pending `analyze_saved_item` job and
     clears its private input before any future worker egress.
2. Run only `supabase/tests/batch_b_ai_contract.sql` and record RED evidence showing
   all four new assertions fail for the intended reason.
3. Make the smallest migration-010 repair:
   - make every one of the five provenance fields explicitly non-null in the
     populated branch;
   - bind the stored model to the same immutable user gateway configuration row.
   Prefer extending the existing immutable provenance key/FK rather than triggers or
   new RPCs. Preserve nullable all-null legacy rows.
4. Run the focused pgTAP file to GREEN. Run `git diff --check`. Do not repeat DB
   reset/full pgTAP/typecheck/build; the controller will run the proportionate
   post-integration contract gate.
5. Update the existing handoff with RED/GREEN evidence, exact change, and risks.
6. Commit only allowed files and return commit SHA, test result, risks, and handoff
   path. Remove any temporary `node_modules` symlink before commit.

## Interfaces and safety

- Consume the existing five-field practice/attempt provenance group and immutable
  `user_model_gateway_configs` row.
- Produce a true all-null-or-exact-all-five invariant.
- Do not store or expose API keys, Vault IDs, origin, headers, prompts, or request
  bodies. This repair is provenance correctness, not a new egress/security feature.
- Preserve owner isolation, RLS/grants, `analyze_saved_item` queue behavior, and all
  source-level artifact behavior.

## Verification commands

```bash
./node_modules/.bin/supabase test db supabase/tests/batch_b_ai_contract.sql
git diff --check
```

## Upstream and license

- No upstream implementation is needed for this SQL constraint repair.
- Do not copy YouTube Digest code.
- LLM Wiki remains method-only; copy no GPLv3 code, tests, prompts, components, or assets.
