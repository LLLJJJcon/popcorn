# Popcorn User Model Gateway Implementation Plan

> **Execution:** Use subagent-driven development, strict TDD, independent review,
> and verification-before-completion. Database migrations, generated database
> types, shared contracts, root configuration, lockfile, and final integration
> remain controller-owned.

**Goal:** Replace the deployment-wide AI gateway singleton with an owner-scoped,
consented, server-only model gateway configuration while preserving durable jobs
and extension isolation.

**Design:** Consume
`docs/superpowers/specs/2026-08-19-popcorn-user-model-gateway-design.md`.

## Task 1: CONTRACT-008 user gateway persistence and shared contracts

Controller-owned, sequential, and complete before Batch A Task 3 resumes.

- Add `202608160008_user_model_gateway_config.sql`.
- Add pgTAP RED/GREEN coverage for exact-origin catalog, owner isolation,
  immutable consent/config versions, one active config, service-role-only secret
  references, Vault write/read/rotate/revoke functions, and public grants.
- Add provider-neutral Zod request/view contracts. Write DTO may carry a key;
  view DTO exposes only `hasApiKey`.
- Regenerate database types and run clean reset, full pgTAP, contracts,
  provenance, typecheck, build, and diff checks.
- Freeze CONTRACT-008 after independent review.

## Task 2: User gateway service and authenticated Web settings API

Depends on Task 1. Implement in its own worktree.

- Add a repository/service boundary that explicitly filters by `user_id` even
  when using service role.
- Add authenticated GET/PUT/DELETE settings routes and a consent activation
  route. Responses use `Cache-Control: no-store` and never echo a key or Vault
  UUID.
- Saving validates an active catalog entry and canonical exact origin, creates
  an immutable config version and versioned consent, and stores the key through
  the Vault-backed secret store without probing the provider.
- Rotation and revocation are owner-bound and fail closed.
- CI uses an in-memory secret-store fake; production without the Vault backend
  fails closed.

## Task 3: Popcorn Web model gateway settings UI

Depends on Task 2. Implement in its own worktree.

- Add the minimal authenticated Web settings surface.
- Let the learner select an approved gateway, set display name/model, enter or
  rotate a write-only API key, and confirm the exact origin/data classes.
- Never persist the key in browser storage, URL, analytics, error text, or page
  rehydration. Never place the form in the extension.
- Show configured/active/revoked states without revealing secret material.

## Task 4: Resume Batch A Task 3 with a per-user resolver

Depends on Tasks 1 and 2; UI Task 3 may run in parallel if file ownership does
not overlap.

- Preserve the reviewed cross-line selection and Overview grounding fixes from
  Task 3 checkpoint `a0ab48f`.
- Replace `AI_GATEWAY_*` singleton selection with an injected per-user resolver.
- Artifact routes resolve the authenticated user's active configuration and pin
  config ID/revision/fingerprint in private durable job input. Public request
  bodies never accept provider, URL, model, or key.
- Workers re-check owner, catalog entry, configuration state, consent, and
  secret immediately before fetch and before artifact publication.
- Implement the bounded `openai-compatible` adapter behind the closed registry.
  CI fixture selection occurs before any config or secret read and makes zero
  network calls.
- Include configuration fingerprint in deterministic job/result keys.

## Task 5: Integration gate and downstream amendments

Controller-owned.

- Independently review the full Batch A Task 3 diff from its recorded baseline.
- Run full extension, server, contract, pgTAP, provenance, lint, typecheck,
  production build, and diff checks.
- Amend Batch B/C briefs so every AI task consumes the same per-user resolver.
- Amend Delivery configuration and terms gates per approved catalog origin.
- Continue Batch A Task 5 -> Task 6 -> controller Task 7.
