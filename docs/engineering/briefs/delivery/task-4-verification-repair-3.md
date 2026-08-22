# Delivery Task 4 Verification Repair 3 — Refresh the provenance freeze contract

## Assignment

- Parent: revised Delivery Task 4 final `pnpm verify` gate.
- Baseline/HEAD: `176f0f4ab7a4ebf58e959ddf0574762bcc07b436`.
- Worktree: `/private/tmp/popcorn-delivery-4`.

## Allowed files

- Modify `tests/provenance/no-llm-wiki-code.test.ts`.
- Create `docs/engineering/handoffs/delivery/task-4-verification-repair-3.md`.
- This brief.

All runtime, CI, acceptance, package/lockfile, migration, generated, license, and other test files are forbidden.

## RED and accepted facts

After unit 190/190, contract 181/181, and integration 330/330, `CI=true pnpm verify` fails 2 provenance assertions:

1. The old Foundation freeze contract still requires direct `node_modules/.bin/supabase start`, three standalone concurrency scripts, and vendor bash syntax on every push. Revised Delivery Task 4 intentionally requires project-local `pnpm exec supabase start`, package/release-check/fixture acceptance, and removes those repeated scripts because their migrations were already reverified after migration 017.
2. Delivery Task 2 accepted exact MIT `tsx@4.23.12` for the deterministic demo seed, but the exact dependency freeze list was not updated.

The current CI also exports a fixed local fixture `INTERNAL_JOB_SECRET` and local Supabase service role from `supabase status`; these are not live/GitHub secrets. The contract must still forbid `${{ secrets.* }}`, Provider credentials, live gateway credentials, and hard-coded production secrets.

## Minimal GREEN

- Refresh the existing fixture-only CI provenance test to match the revised one-job gate: frozen install, verify, extension test, `pnpm exec supabase start`, reset/pgTAP, package/release checker, top-level fixture acceptance, real event-range whitespace check, and always teardown.
- Assert the three standalone concurrency scripts and vendor syntax step are absent, not present.
- Preserve fixture mode, read-only permission, pinned Node/pnpm/actions, and no GitHub/live Provider credentials.
- Allow only the explicit fixed local job-secret sentinel and locally exported Supabase service role mechanism; do not weaken the ban on `${{ secrets.* }}`, Supadata/OpenAI/model-gateway keys, or embedded credential values.
- Add only exact `tsx: "4.23.12"` to the frozen devDependencies object. Preserve every other exact dependency and extension-test assertion.

## Verification

```bash
CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts -t 'fixture-only CI freeze gate'
CI=true pnpm vitest run tests/provenance/no-llm-wiki-code.test.ts
CI=true pnpm eslint tests/provenance/no-llm-wiki-code.test.ts
git diff --check
```

Commit implementation and a separate handoff. Return SHAs/tests/risks; do not integrate or push. No upstream content or license change is permitted.
