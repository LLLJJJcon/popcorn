# Batch B Task 6 — complete Saved-to-Practice gate handoff

## Scope

- Task baseline: `5ad81925310dd2fb1df80bf659a5b89b1b25985a`
- Durable brief commit: `50bd6b1`
- Independently reviewed timestamp repair integrated as `a5cbe2f`
- Executor: main Implementation Controller

This task adds the fixed saved-analysis contract matrix, the complete local Web
E2E gate, Playwright Web project discovery, and the five-item `(app)` navigation.
No live Provider was called and no API key was used by the tests.

## TDD and failure evidence

### AI contract RED/GREEN

The initial fixed semantic matrix ran seven tests. Five positive cases failed
because case-only metadata was passed into the real strict candidate schema as an
unrecognized key; the two negative cases already passed. The fixture builder was
corrected without changing production code. Final result: 7/7 PASS.

The matrix now covers informal reaction, polite request, disagreement, online
slang, register ambiguity, malformed structured output, and schema-valid invented
evidence. Positive cases exercise the real prompt builder, CI gateway, and exact
persisted-evidence validator.

### Browser RED/GREEN

The baseline Playwright configuration returned `No tests found` because it only
matched extension specs. After adding the Web project and app layout, the real
browser run exposed and resolved these bounded issues:

1. The manually inserted historical seed user has no current GoTrue identity and
   cannot authenticate. The E2E now creates one deterministic local Auth user and
   its source graph through supported Admin/test APIs.
2. Next dev was initially bound to `localhost` while the app URL used
   `127.0.0.1`, so Next blocked dev assets. The Web server now binds to the exact
   loopback host; no application origin rule was loosened.
3. A real product defect staged the passed original attempt but returned HTTP 500:
   PostgREST emits `timestamptz` as `+00:00`, while deterministic scheduling
   requires canonical `Z`. A separate TDD fix normalized only this persisted
   boundary. Its focused test went RED 1/8 then GREEN 8/8, TypeScript/diff passed,
   and an independent reviewer returned PASS before integration.
4. The final due-list assertion originally counted five navigation list items plus
   one Practice item. It was scoped to `<main>`.

Final browser result: 1/1 PASS in 5.3 seconds.

## Browser proof

The scenario proves, against local Supabase and real Next routes/components:

- authenticated Home shows `Organize 1 recent save`;
- one YouTube video groups the actionable and untouched saves;
- exact persisted Chinese evidence and YouTube timestamp are visible;
- candidate selection alone creates no Vault, mastery, or review row;
- fixture-only activation presents a learner-first Mandarin task;
- a valid original response is evaluated and atomically promoted to `tried`;
- an optional second revision remains in attempt history;
- Vault shows the expression, exact occurrence, mastery, and both attempts;
- the one-day review is moved past due only by the test clock fixture, then one
  due Practice item is shown;
- the unselected saved item and its fields remain byte-for-byte/field-for-field
  unchanged and gain no artifact or draft;
- primary navigation exposes Home, Saved, Practice, Vault, and Progress.

The E2E intentionally requires a clean local `pnpm db:reset`: immutable promotion
receipts correctly prevent broad test cleanup. Progress is linked but not clicked;
its page belongs to Batch C.

## Batch B exit verification

- Related Batch B integration directories: 8 files, 125/125 PASS.
- Saved-analysis AI contract: 7/7 PASS.
- Saved-to-Practice Chromium Web E2E: 1/1 PASS.
- ESLint: exit 0; three pre-existing accepted unused-variable warnings remain in
  Task 3/5 files outside this task's allowlist.
- TypeScript: PASS.
- Next.js 16.3.1 webpack production build: PASS, 25/25 static pages generated and
  all dynamic routes collected.
- Clean migration reset through 001–012: PASS.
- pgTAP on the clean baseline: 570/570 PASS.
- `git diff --check`: PASS.

The first pgTAP run after the browser test saw the one intentional promoted graph
and failed four global-count assertions. After the required clean reset, all 570
tests passed; this was fixture ordering, not a migration failure.

## Files and boundaries

Task 6 candidate files:

- `tests/contract/ai/saved-analysis.test.ts`
- `tests/e2e/saved-learning-loop.spec.ts`
- `src/app/(app)/layout.tsx`
- `playwright.config.ts`
- this handoff

The separately accepted timestamp fix changes only its brief/handoff,
`record-valid-attempt.ts`, and its focused integration test. No migration, shared
contract, generated database type, dependency, lockfile, CI workflow, Provider
transport, prompt, gateway/Vault-secret path, extension, or existing page was
changed.

## Provenance and residual risk

No YouTube Digest code was duplicated. The existing source-grounded interfaces
remain the only transcript/evidence path. LLM Wiki influence remains method-only
(`Raw Source -> Structured Knowledge -> Learning Evidence`); no GPLv3 code, tests,
prompts, components, assets, wording, or styling were copied.

Remaining product-level validation is intentionally deferred to Delivery: a human
quality check against a user-configured compatible model gateway. CI and this
Batch gate remain fully deterministic and provider-free.
