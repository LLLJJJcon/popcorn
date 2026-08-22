# Delivery Task 3 review prerequisite — initialize local signup profiles

## Assignment

- Trigger: independent review of revised Delivery Task 3 candidate `b4661d0`
- Baseline: `7e5920be87f015632d39ab4f31b8b08496716858`
- Worktree: `/private/tmp/popcorn-delivery-3-profile-prereq`
- Owner: controller, because this changes a database migration/shared auth invariant.
- Objective: every successfully committed `auth.users` insert, including Web and extension email/password signup, automatically receives exactly one default Popcorn profile before later requests; existing users missing a profile are backfilled.

## Allowed files

- Create `supabase/migrations/202608220017_local_signup_profiles.sql`
- Create `supabase/tests/local_signup_profiles.sql`
- Modify `tests/e2e/returning-learner.spec.ts`
- Modify `tests/e2e/saved-learning-loop.spec.ts`
- Modify `tests/contract/model-gateway-concurrency.sh`
- Modify `tests/contract/model-gateway-artifact-concurrency.sh`
- Modify `tests/contract/practice-promotion-concurrency.sh`
- Create/append `docs/engineering/handoffs/delivery/task-3-profile-prereq.md`
- This brief

All runtime application/extension files, prior migrations/tests, seed, generated types, root config, package/lockfile, CI, Task 3 user docs/tests, and Provider code are forbidden.

## Required RED

Before the migration exists, add focused pgTAP coverage proving the signup invariant is absent. The test must cover:

- the exact profile trigger/function exists and the trigger is `DEFERRABLE INITIALLY DEFERRED` so existing transaction-scoped SQL fixtures can still set deterministic profiles;
- inserting one realistic auth user and forcing the deferred constraint produces exactly one profile with `native_language='en'` and `target_language='zh-CN'`;
- the new owner can create and activate a user-entered OpenAI-compatible gateway through the existing service-only RPCs without a manual profile insert;
- direct execution of the trigger function is unavailable to `anon`, `authenticated`, and `service_role` (the trigger itself runs under its owner);
- no Provider/network call occurs.

Run the focused file and record the pre-migration failure.

## Minimal GREEN

- Add one small `SECURITY DEFINER` trigger function with `search_path=pg_catalog` that inserts only `(user_id, created_at, updated_at)` into `public.profiles`, using the new auth user's ID/time and `ON CONFLICT DO NOTHING`.
- Revoke direct function execution from every public/client/service role.
- Attach one `AFTER INSERT` constraint trigger to `auth.users`, `DEFERRABLE INITIALLY DEFERRED`, so GoTrue commit creates the profile atomically while existing transaction fixtures remain compatible.
- Backfill any existing `auth.users` row missing a profile, idempotently.
- Update the two real E2E setup helpers to consume the production-created profile rather than manually insert a parallel profile. Assert the profile exists before inserting the source graph.
- Make only the three standalone autocommit concurrency fixtures' explicit profile insert tolerant with `ON CONFLICT DO NOTHING`; do not otherwise change their proof.

Do not add account deletion, profile UI, metadata fields, multi-tenant provisioning infrastructure, background jobs, or new dependencies.

## Verification

Because this changes auth/database initialization, the following are proportionate and required:

```bash
pnpm db:reset
pnpm exec supabase test db supabase/tests/local_signup_profiles.sql
pnpm db:test
pnpm vitest run tests/contract/local-auth-seed.test.ts
pnpm typecheck
pnpm eslint tests/e2e/returning-learner.spec.ts tests/e2e/saved-learning-loop.spec.ts
bash -n tests/contract/model-gateway-concurrency.sh
bash -n tests/contract/model-gateway-artifact-concurrency.sh
bash -n tests/contract/practice-promotion-concurrency.sh
git diff --check
```

Run the three concurrency scripts only after the clean reset because this migration changes their auth fixture behavior. Do not run browser E2E, production build, live Provider, live YouTube, load, or unrelated application suites.

Also perform one real local GoTrue signup using a disposable account (do not print the password/token), verify its profile exists, create/activate a gateway with a disposable non-live key through the existing database functions or Web service path, and clean up the transaction/fixture without Provider egress.

## Security, upstream, and license

- The trigger may insert only the fixed Popcorn language-pair defaults; it must not trust user metadata.
- Profile creation remains in the same auth-user transaction and must fail closed if the database cannot create it.
- No secret, token, user password, gateway key, or Vault value may appear in output/handoff.
- No upstream code is needed. Preserve YouTube Digest MIT attribution and LLM Wiki GPLv3 method-only isolation; copy no GPL code, prompts, tests, prose, components, or assets.

## Submission

- Controller records RED then commits the minimal migration/test/fixture adjustment.
- Add a separate handoff commit with RED/GREEN, clean-reset/pgTAP/GoTrue evidence, exact diff, risks, and implementation SHA.
- Independent reviewer must inspect baseline-to-HEAD and return PASS before integration.
