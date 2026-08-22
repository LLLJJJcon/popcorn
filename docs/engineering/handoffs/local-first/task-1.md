# Local-First Task 1 Handoff

Status: candidate implementation complete; independent review pending.

Baseline: `60f388879fc41dfd0a89a9aa9e4b774c198796dd`.

## Implemented

- Public settings now accept `{ displayName, baseUrl, model, apiKey }` and expose only
  normalized non-secret `{ configs }` views with exact-base-URL consent.
- Migration 015 adds direct immutable transport fields while preserving legacy catalog
  rows, Vault key lifecycle, one-active semantics, revision/fingerprint pins, job
  registration/completion, revoke cleanup, and service-only resolver behavior.
- Repository queries use a left relation and normalize both transport representations.
- Settings UI has an editable `Gateway base URL` field and no catalog dependency.
- Generated Supabase types were regenerated from the local database for `public,private`.

## Evidence

- RED: focused contract/UI run had 6 failures and 31 passes before implementation.
- Focused Vitest: 5 files, 72 tests passed.
- Settings service follow-up: 11 tests passed, including direct RPC split and legacy/direct
  repository normalization.
- Full pgTAP: 8 files, 632 tests passed before the final direct durable-pin assertion;
  focused gateway jobs then passed 57 tests with that assertion.
- Two-session gateway concurrency: `model gateway concurrency invariant passed`.
- TypeScript, scoped ESLint, and diff check passed before handoff; rerun after review fixes.

## Compatibility and risk

Legacy catalog callers may still submit the historical bare origin to the service-only
activation RPC; the database stores and exposes the normalized full base URL. New public
requests must consent to the exact full URL. Direct destinations remain deliberately
limited to public HTTPS DNS hosts and the existing OpenAI-compatible adapter. DNS rebinding
protection is not added because this is a local personal school project; the bounded URL
contract, key nonleakage, owner isolation, Vault boundary, and durable queue guarantees stay.

No GPLv3 code was copied.
