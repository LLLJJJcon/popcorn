# Delivery Task 3 signup-profile prerequisite handoff

## Scope

- Review trigger: revised Delivery Task 3 candidate `b4661d0`
- Baseline: `7e5920be87f015632d39ab4f31b8b08496716858`
- Controller brief: `0bf0225`
- Implementation: `2a731de`
- Worktree: `/private/tmp/popcorn-delivery-3-profile-prereq`

The independent docs review correctly found that a fresh Web/extension signup
created `auth.users` but not `public.profiles`, so the existing gateway RPC
rejected the new owner. This controller-owned prerequisite fixes that shared
database invariant without adding account UI, provisioning services, or new
dependencies.

## RED

Before migration 017 existed, the new focused pgTAP file executed completely
and reported 6/6 failures:

- no deferred auth-user profile trigger;
- no non-callable fixed-search-path trigger function;
- no profile after a realistic auth insert;
- gateway creation rejected the missing owner;
- exact-destination activation failed;
- no active gateway state existed.

The failing transaction rolled back and printed no token, password, or live
credential.

## Minimal implementation

- `202608220017_local_signup_profiles.sql` adds one `SECURITY DEFINER`,
  `search_path=pg_catalog` trigger function. It trusts only the new auth UUID
  and creation time and inserts the existing fixed `en` to `zh-CN` defaults.
- Direct execution is revoked from public, anon, authenticated, and
  service-role callers.
- One `AFTER INSERT`, `DEFERRABLE INITIALLY DEFERRED` constraint trigger keeps
  profile creation in the committed auth transaction while allowing existing
  transaction-scoped SQL fixtures to insert deterministic profiles before
  rollback.
- Existing auth users missing a profile are backfilled idempotently.
- The two real E2E fixture builders now verify and consume the automatically
  created profile instead of creating a parallel row.
- Three standalone autocommit concurrency fixtures keep their explicit setup
  compatible with `ON CONFLICT DO NOTHING`; their proofs are otherwise
  unchanged.

## GREEN and regression evidence

- Clean local `supabase db reset`: migrations 001–017 and seed applied.
- Focused signup/profile/gateway pgTAP: 6/6 PASS.
- Full pgTAP: 10 files, 663 tests, PASS.
- Local-auth seed contract: 1/1 PASS.
- TypeScript: PASS.
- Scoped E2E fixture ESLint: PASS.
- Three concurrency script syntax checks: PASS.
- Model gateway concurrency: PASS.
- Model gateway artifact lock concurrency: PASS.
- Practice promotion concurrency: PASS.
- `git diff --check`: PASS.

One real local GoTrue signup used a disposable account and password without
printing either token or credential. Its committed default profile existed,
the existing service-only RPCs created and activated a disposable
OpenAI-compatible gateway with exact consent, and the transaction/account
fixtures were then removed. No Provider endpoint was called.

## Boundaries and remaining risk

- No app/extension runtime, prior migration, seed, generated type, root config,
  package, lockfile, CI, Provider, or Task 3 user-document file changed.
- No account deletion feature was added. The approved personal-project plan
  only requires an accurate local Supabase reset path; the docs repair must
  remove its false per-user Studio deletion promise and use full local
  `pnpm db:reset` instead.
- The deferred trigger means profile availability begins when the auth
  transaction commits, matching GoTrue's response boundary. If a future auth
  integration attempts to use a profile inside the same uncommitted auth
  transaction, it must explicitly set constraints immediate; current Web and
  extension flows do not do that.
- No YouTube Digest or LLM Wiki material was added. MIT attribution and LLM
  Wiki GPLv3 method-only isolation remain unchanged.
