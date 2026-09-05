# Unified Learning Workspace Checkpoint

## Candidate

- Branch: `codex/popcorn-youtube-learning`
- Unified workspace plan baseline: `13c4a7e021b5149b994560372acb088f9b22def9`
- Task 1 implementation baseline used for the final full-range review: `8bb5cc9`
- Tasks 1–8 are accepted. Task 9 candidate includes the complete browser journey, responsive/accessibility repairs, user guide, and proportional final gates.
- The exact Task 9 candidate commit is recorded in `docs/engineering/execution-ledger.md` after the independent release review.

## Demonstrable learner journey

1. Save the current YouTube video's learning snapshot from the extension without pausing, seeking, navigating, or opening a form.
2. Use **Open Popcorn**. The smart root opens Home for an authenticated Web session and Sign in otherwise.
3. Open **Saved**, retain the source text and stored English even when later processing or a Provider request fails, and start immediate Practice from a candidate expression.
4. Submit one learner-written Chinese response, inspect feedback and a natural revision, and keep the response and source evidence visible through a retryable Provider failure.
5. Open **Vault** to inspect the expression, source occurrence, immediate revision history, and later due-Practice attempt.
6. Complete due **Practice**. Mastery advances only by the fixed `tried -> reused -> owned` rules and does not depend on saved-item volume.
7. Open **Progress** to confirm due completion and independent reuse evidence.

## Fresh Task 9 verification

- `pnpm lint`: passed with zero errors and three pre-existing unused-variable warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: passed — 297 unit, 182 contract, and 403 integration tests.
- `pnpm test:provenance`: passed — 16/16, including exact CI Node pin, YouTube Digest provenance, and LLM Wiki method-only isolation.
- `pnpm build`: passed — Next.js production compilation, type checking, and 25/25 static-page generation steps completed.
- `node --test extension/tests/*.test.js`: passed — 161/161.
- Browser acceptance: passed — 5/5 across the three Task 9 Playwright specs.
- Browser layout coverage includes 320, 899, 900, and 1440 CSS pixels; all primary actions remain in the viewport and pages do not horizontally overflow.
- `git diff --check`: passed before candidate commit.
- `pnpm db:test` was not repeated: no migration, generated database type, RPC, RLS, or schema file changed after the previously accepted database gates.

## Repairs found by the gate

- Active navigation now uses an AA-contrast coral token against paper.
- At 320 CSS pixels all six primary navigation actions are visible instead of relying on clipped horizontal scrolling.
- Active Vault details now merge immediate/draft and canonical due attempts, deduplicate exact IDs, sort stably, and reject malformed or contradictory history.
- An internal Practice-to-Vault navigation uses Next.js `Link` without changing its conditions or target.
- A stale Saved overview fixture follows the exported prompt version rather than a duplicated old version.
- The provenance gate compares the complete CI Node scalar exactly and rejects prefix lookalikes.
- The extension auth-worker static test distinguishes forbidden `message.source` from legitimate `message.sourceId`.
- The extension Saved API handler factory lives outside `route.ts`, so the Next.js 16 production route exports only `GET`.

## Scope and residual risks

- The product remains a personal, local-first school project: local Next.js, local Supabase, and an unpacked generated Chrome extension. No commercial quota, billing, load/SLO, hosted deployment, advanced analytics, or generic ingestion was added.
- Input remains the currently watched YouTube video only. There is no text, generic URL, image, screenshot, video-file, pgvector, graph, chat retrieval, or export feature.
- CI and automated acceptance use fixed fixtures. A professor demonstration that depends on live Supadata or a user-configured model gateway still depends on those external credentials, account balance, network/proxy, and Provider availability.
- The three lint warnings predate this candidate and are outside the changed learner-journey files; there are no lint errors.
- YouTube Digest remains pinned to `d03e1f61e017b032159ffd1821cac6e7693ce0c7` with MIT attribution. LLM Wiki `723e259309aea5e3850265b631f80224f66dd9f6` remains method-only inspiration; no GPLv3 source, tests, prompts, components, or assets were copied.
