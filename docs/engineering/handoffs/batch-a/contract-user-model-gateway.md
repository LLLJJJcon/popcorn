# CONTRACT-008 User Model Gateway Handoff

## Scope and baseline

- Plan: `2026-08-19-popcorn-user-model-gateway.md`, Task 1.
- Baseline: `6fbf2e9`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- No upstream source code was copied. YouTube Digest remains MIT-isolated in the
  extension; no GPLv3 LLM Wiki code, test, prompt, component, or asset was used.

## RED

- `vitest tests/contract/model-gateway.test.ts`: exit 1, 5/5 genuine failures
  because the gateway contracts were undefined.
- `supabase test db supabase/tests/model_gateway.sql`: exit 1; the catalog,
  owner-config, private secret-reference tables, and service RPCs were absent.
- First GREEN attempt exposed and then fixed PostgreSQL's prohibition on NUL in
  `text`; configuration fingerprints now use tagged length-prefixed
  serialization.
- Full contract run exposed the expected frozen taxonomy mismatch for
  `MODEL_GATEWAY_CONFIGURATION_REQUIRED`; the existing snapshot was amended.

## GREEN

- Contract schemas: 5/5 focused; full contract + provenance 162/162.
- Clean database reset applied migrations 001-008 twice.
- Full pgTAP: 368/368 across the new gateway suite and existing RLS suite.
- ESLint: pass.
- TypeScript: pass.
- Next.js production build: pass.
- Supabase DB lint: no new migration warning; two pre-existing Foundation
  shadowed-variable warnings only.
- Generated database types were mechanically refreshed; the CLI-only trailing
  blank line was removed. `git diff --check`: pass.

## Produced contracts

- Administrator-managed exact HTTPS origin catalog; v1 adapter is closed to
  `openai-compatible`.
- Owner-readable non-secret config versions and exact-origin consent state.
- Service-role-only Vault create, activate, resolve, rotate, and revoke RPCs.
- Authenticated users can read active catalog entries and their own non-secret
  config metadata but cannot write tables or execute secret-bearing RPCs.
- Resolver requires exact owner, config revision, active origin/config, current
  consent policy, and exact consented origin.
- Public TypeScript views reject API keys and Vault identifiers; write schemas
  never accept caller URL, adapter, or owner identity.

## Remaining work and risk

- CONTRACT-008 supplies persistence and shared DTOs only. The settings service,
  authenticated Web UI, per-user worker resolver, and bounded live adapter are
  later tasks and must be independently reviewed.
- Production must populate exact origin catalog rows and keep network-layer
  private-address/DNS-rebinding controls as a Delivery gate.
- No real gateway was contacted and no credential was added to the repository.

## Independent review fix 1

The first independent review returned FAIL and the controller reproduced every
blocking counterexample. Fix baseline `bd6c91d` adds:

- Zod and SQL rejection for IPv4 literals, localhost/local/internal names,
  metadata targets, and the already-rejected IPv6 literal form;
- SELECT-only service-role access to immutable user config rows, with all writes
  restricted to SECURITY DEFINER lifecycle RPCs;
- a trigger that prevents changing a referenced catalog origin's exact origin,
  base path, or adapter kind;
- a rename-only owner RPC plus strict rename/revoke/settings-view contracts;
- idempotent revocation that still marks a config revoked when the secret
  mapping is missing; and
- permission regression coverage for all six lifecycle/secret RPCs.

Fix RED: Zod 6/13 failed and gateway pgTAP 16/38 failed against the vulnerable
implementation. Fix GREEN: Zod 13/13, gateway pgTAP 39/39, full pgTAP 382/382,
contract/provenance 170/170, ESLint, TypeScript, production build, DB lint (only
the same two pre-existing Foundation warnings), generated types, and diff check
all pass after a second clean reset.
