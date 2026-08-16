# Foundation Task 2 Integration Gate: Contract Test Script

## Assignment

- Governing plan: `docs/superpowers/plans/2026-08-16-popcorn-foundation-contracts.md`, Task 2 integration follow-up.
- Baseline commit: `b1739e0e229e48a54f0cbb8eae96fc236c8b00bd`.
- Worktree: `/private/tmp/popcorn-foundation-2-contract-script`.
- Branch: `codex/popcorn-foundation-2-contract-script`.
- Objective: make the root `test:contract` command discover the frozen Foundation Task 2 contract suite at `tests/contract` instead of silently passing against the nonexistent `tests/contracts` path.

## Scope

Allowed modifications:

- `package.json`
- `tests/provenance/youtube-digest.test.ts` (or one narrowly scoped new root-configuration test under `tests/provenance/`)
- `docs/engineering/handoffs/foundation/task-2-contract-script.md`

Forbidden modifications:

- `pnpm-lock.yaml` and every other root configuration file
- all production source under `src/`
- all Task 2 contract files and tests under `tests/contract/`
- extension, vendor, provenance records, Supabase, migrations, generated types, plans, specs, and the execution ledger
- user artifacts or files outside this worktree

## Interfaces

Consumes the Foundation Task 2 test layout `tests/contract/` and the root `pnpm test:contract` interface established in Foundation Task 1. Produces only a corrected root command; it must not change runtime or contract behavior.

## Required TDD Evidence

1. First add a focused test that reads `package.json` and requires `scripts["test:contract"]` to target the exact directory `tests/contract` (and not rely on `--passWithNoTests` to hide the mismatch).
2. Run that focused test before changing `package.json`; capture the expected RED failure showing `tests/contracts` versus `tests/contract`.
3. Make the minimum one-line script correction.
4. Run the focused test GREEN, then verify `CI=true pnpm test:contract` actually executes the Task 2 suite after it is cherry-picked with Task 2. Because this isolated branch does not contain Task 2 yet, also run `CI=true pnpm test:provenance`, `CI=true pnpm lint`, `CI=true pnpm typecheck`, and `git diff --check`; explicitly record the integration-order limitation.

## Verification Commands

- `CI=true pnpm vitest run tests/provenance/youtube-digest.test.ts`
- `CI=true pnpm test:provenance`
- `CI=true pnpm lint`
- `CI=true pnpm typecheck`
- `git diff --check`
- Integration controller after cherry-pick: `CI=true pnpm test:contract`

## Upstream and License Constraints

- YouTube Digest upstream remains `zarazhangrui/youtube-digest` at `d03e1f61e017b032159ffd1821cac6e7693ce0c7`; do not modify or reuse upstream code for this root-script fix.
- LLM Wiki remains method-reference-only at v0.6.9 / `723e259309aea5e3850265b631f80224f66dd9f6`; do not copy GPLv3 code, tests, prompts, components, or assets.
- No dependency, lockfile, vendored code, third-party code, or license change is allowed or expected.

## Handoff and Commit

Commit the scoped change and an append-only handoff at `docs/engineering/handoffs/foundation/task-2-contract-script.md`. Return the commit SHA, exact RED/GREEN evidence, verification results, risks, and report path. Implement only this integration-gate fix.
