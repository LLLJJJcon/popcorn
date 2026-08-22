# Local-First Amendments Checkpoint

## Accepted baseline

- Integration branch: `codex/popcorn-youtube-learning`
- Starting baseline: `41e7d46` (Batch C Task 3 accepted)
- Task 1 gateway contract accepted through `f7de4b6`.
- Task 2 local worker accepted through `76d82c3`.
- Task 3 password authentication accepted through `3fdf173`.
- Task 4 application slice integrated as `349d351`; the controller-owned root command and this checkpoint are recorded by the following commit.

## Usable local workflow

- A user configures a gateway display name, exact OpenAI-compatible HTTPS base URL, model, and API key in Popcorn settings.
- `pnpm worker:local` calls the existing durable server processor; it does not create a second queue or access Supabase directly.
- Web and extension use the same Supabase email/password account.
- With `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set, `pnpm extension:local` creates `dist/popcorn-extension` for Chrome's **Load unpacked** flow.
- The generated extension has a stable identity and exact YouTube/App/Supabase hosts. Its generated configuration contains only the public anon key and two public origins.

## Fresh Task 4 verification

- Release generator tests: 17/17 passed.
- Extension authentication, worker, queue, and restart tests: 32/32 passed.
- Provenance tests: 11/11 passed.
- TypeScript, generator syntax, scoped ESLint, and `git diff --check`: passed.
- A real `dist/popcorn-extension` was generated with exactly 20 allowlisted files.
- Next.js production build: passed with local placeholder runtime values.
- Independent application-slice review: PASS with no P0/P1/P2 findings.

The generated `dist/` tree is intentionally ignored because it contains machine-specific public origins. Users regenerate it from their own `.env.local`; no private provider or Supabase service key is copied into it.

## Deliberate school-project scope

This checkpoint adds no OAuth setup, hosted deployment infrastructure, multi-tenant billing, quotas, enterprise audit trail, or alternate job system. The remaining work is the planned source-deletion contract, the lightweight Vault/Chinese UI integration, delivery documentation, and a final local professor-demo smoke test.
