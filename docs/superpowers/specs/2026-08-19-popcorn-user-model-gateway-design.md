# Popcorn User Model Gateway Design Amendment

**Status:** Approved scope amendment, 2026-08-19. This document supersedes the
deployment-wide AI gateway assumptions in the original desktop/web design and
in the Batch A Task 3 repair design. All other Popcorn product boundaries remain
unchanged.

## Goal

Let each signed-in learner choose a server-approved AI gateway, give it a local
display name, choose a model, and supply that gateway's API key without exposing
provider credentials or provider hosts to the extension.

## Product boundary

- Configuration lives in authenticated Popcorn Web settings, never in the
  extension.
- The learner selects an exact HTTPS destination from an administrator-managed
  origin catalog. The first adapter kind is `openai-compatible`; later adapter
  kinds extend a closed server registry.
- The learner configures `displayName`, `model`, and an API key. The key is
  write-only and is persisted only through Supabase Vault. Public reads return
  `hasApiKey`, never the key or a Vault identifier.
- Activating a configuration requires explicit consent to the normalized exact
  origin and the versioned data classes: video title, necessary Chinese
  transcript excerpts or selection, timestamps, and the versioned prompt.
- Changing an origin or the egress-consent policy requires new consent. Rotating
  a key or renaming the display label does not.
- Ordinary learners cannot submit arbitrary outbound URLs in v1. Adding a
  destination is an administrative deployment action. Custom arbitrary origins
  remain deferred until a production egress proxy can prevent DNS rebinding and
  private-network access at connection time.

## Trust and data flow

```text
Popcorn Web settings
  -> authenticated configuration API
  -> approved exact-origin catalog lookup
  -> immutable consent + immutable configuration version
  -> API key stored in Supabase Vault; application tables keep only secret_ref

Artifact route
  -> authenticated owner lookup
  -> active configuration version + consent
  -> durable job stores config version/fingerprint, never key
  -> returns 202 without calling a provider

Worker
  -> verifies job/config/consent ownership and active state
  -> resolves the Vault secret immediately before use
  -> closed adapter registry + fixed provider path
  -> validates and grounds untrusted output
  -> publishes artifact only if consent remains active
```

The extension sends only authenticated Popcorn requests. It never receives or
stores a gateway origin, model, API key, Vault reference, or provider response.

## Persistence contracts

`model_gateway_origins` is an administrator-owned catalog containing a stable
identifier, exact canonical HTTPS origin, fixed base path, adapter kind, and
active state. Authenticated users may read only active non-secret catalog data.

`user_model_gateway_configs` stores owner-scoped, non-secret configuration
versions. V1 permits one active configuration per user. A version records the
origin reference, adapter kind, model, fingerprint, consent policy version,
consented origin, consent timestamp, state, and revision.

`private.user_model_gateway_secrets` maps a configuration to an opaque Vault
secret UUID. It is service-role-only. No public table, public job payload,
artifact, log, error, test fixture, handoff, or extension storage contains the
secret value or Vault identifier.

Durable AI jobs pin the immutable configuration ID/revision and include the
non-secret configuration fingerprint in their dedupe/result key. A worker uses
the current credential for that pinned configuration so key rotation can repair
pending work without changing semantic result identity.

## Outbound policy

- HTTPS only; default port 443; no user info, query, fragment, wildcard origin,
  IP literal, localhost, or private/link-local/metadata/reserved address.
- The catalog owns the base path. An adapter may append only its fixed endpoint,
  initially `chat/completions`; users cannot add headers, paths, templates, or
  transport parameters.
- Redirects are errors. TLS hostname verification, hard timeout, request byte
  bounds, incremental response byte bounds, and sanitized errors are mandatory.
- User consent and catalog membership are both required. Neither substitutes
  for network-layer egress controls in production.
- CI selects fixed fixtures before reading configuration or Vault and proves
  zero outbound calls.

## Lifecycle

- Save/activate: create an immutable configuration version and consent; save does
  not probe the provider.
- Rotate: replace the Vault secret atomically; pending jobs use the new key.
- Revoke: mark consent/configuration revoked before destroying the secret and
  clearing pending private inputs. Revocation blocks new requests and artifact
  publication; an already in-flight third-party request cannot be recalled.
- Missing, revoked, mismatched, or unapproved configuration fails closed with a
  bounded public error and never falls back to another user's or deployment's
  gateway.

## Acceptance gates

- Two-user RLS and service-role tests prove configuration and consent isolation.
- Public APIs never return keys, secret references, private job input, or raw
  provider errors.
- Origin canonicalization, catalog membership, closed adapter selection,
  ownership, consent, version pinning, rotation, revocation, crash recovery, and
  zero-network CI each have RED/GREEN evidence.
- Real provider calls remain a Delivery-only manual smoke test after the exact
  destination's terms, retention, and data use have been reviewed.
