# CONTRACT-008A Credential Presence Handoff

## Scope

- Baseline: `8bd4504`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Controller-owned prerequisite for user model gateway plan Task 2.
- No upstream code, GPLv3 material, secret, or live Provider access was used.

## RED

Focused pgTAP exited 1 because
`public.has_user_model_gateway_secret(unknown, unknown)` did not exist. The
service-only RPC-count assertion also failed, proving the new cases were not
passing through old behavior.

## GREEN

- Added a stable SECURITY DEFINER SQL function with fixed `pg_catalog`
  `search_path`.
- The function returns only `exists`, requires exact `user_id + config_id`, and
  only counts pending or active configs with a private secret mapping.
- It never joins `vault.decrypted_secrets` and never returns a Vault identifier.
- Public, anon, and authenticated execution is revoked; service role alone is
  granted execution.
- Focused gateway pgTAP: 64/64.
- Full pgTAP: 407/407.
- Application tests: 17 files, 307/307.
- TypeScript and diff checks: pass.
- Next.js webpack production build: pass. Turbopack was also attempted twice but
  this execution environment denied its CSS helper's temporary port bind; the
  failure occurred before application compilation and is recorded as an
  environment limitation, not hidden as a passing gate.
- Generated-type comparison: exact except the repository's intentional removal
  of the CLI-only final blank line.

## Remaining gate

An independent read-only Agent must review the complete `8bd4504..HEAD` diff and
return PASS before this amendment is frozen for Task 2 consumption.
