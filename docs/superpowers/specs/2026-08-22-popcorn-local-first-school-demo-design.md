# Popcorn Local-First School Demo Design Addendum

**Status:** Approved by the user on 2026-08-22.

**Supersedes:** Production-scale deployment, observability, compliance, and
multi-environment requirements in the 2026-08-16 plans. Requirements already
implemented and accepted remain historical evidence; they are not reopened
unless this addendum changes their interface.

## Outcome

Popcorn is a school capstone and personal self-hosted GitHub project. The
required release is one reproducible local installation that a professor can
see working and another person can clone and run for personal use. Commercial
SaaS readiness is not a goal.

The reference topology is:

```text
Chrome + unpacked Popcorn extension
        |
        v
local Next.js Web/API ---- local Supabase Auth/Postgres/Vault
        |
        +---- local durable-job trigger
        +---- server-only Supadata transcript provider
        +---- user-configured OpenAI-compatible model gateway
```

Hosted Next.js/Supabase deployment may be documented as an optional variation,
but it is not an acceptance gate.

## Product Boundary

- Support only the currently watched `https://www.youtube.com/watch?v=...`
  video.
- Keep the learner direction English-native learning Mandarin.
- Save in the background without pausing playback, navigating, or showing a
  save form.
- Preserve all six save entry points: video, player moment, subtitle line,
  subtitle selection, Key Quote, and AI Explanation.
- Store learning-material snapshots and source locators, never a video file.
- Keep mastery exactly `tried -> reused -> owned`.
- Do not add generic URL/text/image/screenshot inputs, pgvector, a knowledge
  graph, chat retrieval, export, or advanced Progress.
- A save request never synchronously calls transcript, translation, or AI
  Providers.
- Durable jobs and extension saves must recover after a worker stops, the
  browser goes offline, or authentication expires.

## User Model Gateway

The Web settings page owns one active user configuration with these fields:

- display name;
- exact OpenAI-compatible HTTPS base URL, including an optional bounded path;
- model identifier;
- write-only API key.

The base URL is user configuration, not an administrator-seeded catalog
requirement. The adapter protocol remains OpenAI-compatible; supporting every
Provider-specific protocol or a local unauthenticated model server is out of
scope.

The Popcorn server worker is authorized to resolve and use the active user's
API key for Overview, translation, explanation, saved-item analysis, and
Practice evaluation. The key must never enter the extension, browser-readable
responses, logs, fixtures, RPC return values, Git, handoffs, or screenshots.
The global `OPENAI_API_KEY` and `OPENAI_MODEL` environment variables are
retired.

## Local Authentication and Extension Configuration

The reference self-hosted path uses email/password Supabase authentication.
OAuth is optional and not required. Web and extension may present sign-in or
account-creation forms on their dedicated account/settings surfaces; saving a
YouTube moment never presents a form.

Extension configuration is generated for one exact App origin and one exact
Supabase origin. The stable public manifest key remains fixed so the unpacked
extension ID is deterministic. The generated extension may contain the public
Supabase anon key, but never a service-role key, transcript key, model key,
password, token, or job secret.

## Local Jobs and External Providers

The reference local setup uses a small `worker:local` trigger that calls the
existing bounded internal job endpoint with `INTERNAL_JOB_SECRET`. Supabase Cron
remains available only for an optional HTTPS deployment. The durable database
queue, leases, idempotency, and owner scope remain authoritative.

`SUPADATA_API_KEY` is a separate server-only prerequisite for resolving a new
real YouTube transcript. Fixture CI and the deterministic demo seed do not call
Supadata or a model Provider. Final manual validation uses one real public
Mandarin YouTube video and one real user-configured model gateway.

## Proportionate Reliability and Security

Required:

- user/RLS isolation and explicit owner binding for service-role work;
- write-only model credentials and non-leaking errors;
- idempotent saves, attempts, mastery updates, and durable job recovery;
- one already-recorded concurrent proof for atomic due completion;
- YouTube Digest MIT attribution and LLM Wiki GPLv3 method-only isolation;
- source deletion preview that retains practiced evidence;
- fixture-only automated tests plus one real manual smoke.

Not required:

- multi-region, high availability, distributed locks, load tests, quotas,
  billing, rate-limit platforms, WAF/firewall projects, SLOs, alerting, formal
  backup drills, operator status APIs, structured logging platforms, corporate
  compliance reviews, preview/production environment matrices, or Vercel
  deployment.

Account deletion UI is not a classroom-demo gate. Personal local users receive
documented account reset/removal instructions; source deletion remains a
product feature.

## Verification Policy

- Every feature or fix still follows RED, minimal GREEN, an independent
  read-only review, and focused integration verification.
- Do not repeat the 624-test pgTAP suite, concurrency scripts, complete app
  suite, or production build for a task that changes none of their relevant
  boundaries.
- Run one broad Batch C candidate gate after Tasks C2-C5.
- Run one final release gate from a fresh clone/configuration.
- GitHub CI uses only deterministic fixtures. Concurrent mutation scripts are
  release evidence, not mandatory on every push unless their contracts change.

## Release Acceptance

1. A fresh clone can install dependencies, start local Supabase, initialize a
   local account, start Web and the local job trigger, generate/load the
   extension, and configure a model gateway by following the README.
2. Fixture acceptance demonstrates the complete returning-learner path and
   worker recovery without live Providers.
3. Manual smoke uses one public Mandarin YouTube video, resolves native Chinese
   captions, saves without interrupting playback, and completes one real model
   request with the user's configured gateway.
4. Saved, Practice, Vault/search, Due Practice, and Progress are visible.
5. The release report records commit, extension checksum, migration version,
   commands, video ID/date, and known limitations without credentials.
6. Accepted work is integrated from `codex/` branches into GitHub `main`, and a
   demo release tag is created only after final verification.
