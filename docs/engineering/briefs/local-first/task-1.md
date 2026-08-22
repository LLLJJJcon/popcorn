# Local-First Task 1 Brief

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-local-first-amendments.md`, Task 1.
- Baseline: `60f388879fc41dfd0a89a9aa9e4b774c198796dd`.
- Worktree: `/private/tmp/popcorn-youtube-learning`.
- Owner: controller; independent reviewer required.
- Allowed scope: migration 015, model-gateway contracts/services/repository/runtime consumer,
  generated database types, settings UI, focused gateway pgTAP/Vitest, this brief and handoff.
- Forbidden scope: root configuration, lockfile, extension, auth replacement, local worker,
  source deletion, Progress, deployment, and unrelated database contracts.

## Contract

The task consumes the frozen OpenAI-compatible runtime result and immutable job pin
`{ configId, revision, fingerprint }`. It produces a user-entered, exact public HTTPS
`baseUrl`, persisted as immutable `canonical_origin + base_path`, while retaining legacy
catalog-backed rows. Public settings expose `{ configs }` only; API keys remain write-only
and Vault-backed. Consent binds the same exact full base URL.

## TDD and verification

RED was captured with six focused failures: missing base URL schema, catalog-only create
DTO, origin-only consent/view/settings DTOs, and the missing editable URL field. Database
tests were then added for same-URL multi-owner creation, unsafe destinations, exact path
consent, owner isolation, runtime resolution, and durable pin registration.

Required verification: focused Vitest, full pgTAP, TypeScript, scoped ESLint,
`git diff --check`, and one existing two-session gateway concurrency run.

## Upstream and license

This contract task does not need YouTube Digest code. No LLM Wiki GPLv3 source, tests,
prompts, components, or assets are copied; only the already-approved provider-agnostic
gateway method is retained. New project code is intended for the repository's MIT license.
