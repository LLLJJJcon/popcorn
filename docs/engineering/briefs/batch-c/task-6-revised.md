# Batch C Revised Task 6 Brief

- Plan/task: `docs/superpowers/plans/2026-08-22-popcorn-batch-c-school-demo-revision.md`, Task 6.
- Baseline commit: `11b5980`.
- Controller worktree: `/private/tmp/popcorn-youtube-learning`.
- Owner: main Implementation Controller; implementation stays on `codex/popcorn-youtube-learning`.

## File boundary

Allowed:

- Create `tests/e2e/returning-learner.spec.ts`.
- Modify `playwright.config.ts` only to include both Web learning-loop specs in `chromium-web`.
- Create `docs/engineering/checkpoints/gate-c.md` after the candidate gate passes.
- Modify `docs/engineering/execution-ledger.md` after independent review passes.
- This controller brief.
- Create `docs/engineering/handoffs/batch-c/task-6-revised.md` with RED/GREEN and gate evidence.

Forbidden:

- Application, extension, database migration, generated type, shared contract, dependency, lockfile, and package-script changes.
- New Provider polling, live Provider use, source-deletion/offline E2E files, account deletion, analytics, load/concurrency infrastructure, deployment configuration, or generic input sources.

## Interfaces and deterministic proof

- Consumes accepted Local-First Tasks 1–4, Batch C Tasks 1–5, frozen `CONTRACT-015` due completion, and existing password/session helpers.
- Produces one independent local fixture that starts with one existing YouTube save, one `tried` expression, and one due review.
- The browser starts due Practice, submits one unassisted Chinese response under `CI=true`, and observes `tried -> reused`.
- Progress must change from no weekly attempt/completion/reuse to one of each, move the mastery distribution from Tried 1/Reused 0 to Tried 0/Reused 1, and report no currently due review after the next review is scheduled.
- An owner-scoped database count proves the existing save count remains exactly one before and after Practice.
- The fixture uses fixed identities/content/due time and is cleaned before and after. It may use current server time only for the completion produced by the product.

## TDD and verification

- RED: add the full returning-learner scenario, then run it through the existing `chromium-web` project. The baseline project matcher must reject it with no selected tests.
- GREEN: minimally extend the existing matcher to include `saved-learning-loop.spec.ts` and `returning-learner.spec.ts`; do not broaden it to all Web E2E files.
- Run the scoped Task 6 gate from the plan with direct local binaries where the current worktree dependency symlink requires them. Do not repeat full pgTAP: `CONTRACT-015` and `CONTRACT-016` already own those clean/full gates.
- Use fixed CI model fixtures only. A real user API key is reserved for revised Delivery Task 5.

## Upstream and license

- YouTube Digest pin: `zarazhangrui/youtube-digest@d03e1f61e017b032159ffd1821cac6e7693ce0c7`, MIT. This task changes no vendored/upstream-derived function; its accepted Side Panel queue and recovery tests are only rerun by the gate. Preserve `third_party/youtube-digest/LICENSE` and `extension/UPSTREAM.md` unchanged.
- LLM Wiki pin: `nashsu/llm_wiki@723e259309aea5e3850265b631f80224f66dd9f6` (`v0.6.9`), GPLv3. Do not copy code, tests, prompts, components, or assets. This task uses no LLM Wiki material.

## Review acceptance

An independent read-only reviewer must examine the complete Batch C candidate and return PASS with no P0/P1/P2 before `gate-c.md` and the ledger are frozen. The review must cover product scope, owner/RLS boundaries, exact mastery transitions, deletion retention, durable queue recovery, pinned upstream reuse/MIT preservation, and GPL isolation.
