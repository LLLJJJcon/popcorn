# Delivery Task 5 UX/autofill repair brief

## Identity

- Plan: `docs/superpowers/plans/2026-08-22-popcorn-github-delivery-revision.md`
- Task: revised Delivery Task 5, bounded pre-smoke UX/autofill repair approved by the user on 2026-09-03
- Baseline commit: `0b63409f3a6934afea1aea077cf5e89ae98a16a4`
- Implementation worktree: `/private/tmp/popcorn-task5-ux-fix`
- Product: Popcorn, an English-first personal learning app for English speakers learning Mandarin from the YouTube video they are watching

## Confirmed diagnosis and design

The sign-in page currently renders an unstyled document body: no page padding,
background, border, or card layout is applied. The model-gateway create form has
no form autocomplete boundary; its non-secret inputs have no stable `name`,
`id`, or autocomplete intent; and the API-key field is a password input marked
only `autocomplete="off"`. A browser password manager can therefore infer the
adjacent model text field and API-key password field as a username/password
pair and fill saved Popcorn login credentials. The user observed the fill but
did not press Save, so no incorrect gateway configuration was persisted.

Approved design:

- Give sign-in the same warm cream/paper, terracotta, rounded, editorial visual
  language already used by model-gateway settings.
- Use a responsive desktop two-part card and mobile single-column layout, with
  no new image, font, or asset dependency.
- Keep all user-facing copy English. Make Popcorn's YouTube-to-Mandarin purpose
  clear, identify the account as local, and retain one primary Sign in action
  plus one visually secondary Create account action.
- Preserve the fixed POST endpoint, exact two intents, credential bounds, and
  existing server/auth behavior.
- Give model-gateway forms and inputs explicit non-login identity. Use stable
  gateway-specific `id`/`name` values, `autocomplete="off"` on the gateway
  create/rotation form and non-secret create inputs, and
  `autocomplete="new-password"` on create/rotation API-key inputs. Preserve
  password masking, write-only clearing, DTOs, and all settings behavior.

## Allowed files

- `src/app/sign-in/page.tsx`
- `src/app/sign-in/sign-in-form.tsx`
- `src/app/sign-in/sign-in-form.test.tsx`
- `src/app/sign-in/page.test.tsx` (new, only if needed for the page structure)
- `src/app/sign-in/sign-in.module.css` (new)
- `src/app/settings/model-gateway/model-gateway-settings.tsx`
- `src/app/settings/model-gateway/model-gateway-settings.test.tsx`
- `docs/engineering/handoffs/delivery/task-5-ux-autofill-fix.md` (new)

## Forbidden files and actions

- Do not modify model-gateway API routes, services, contracts, database code,
  migrations, generated types, root configuration, lockfile, global CSS,
  Next configuration, launcher, worker, extension, Provider, prompt, or
  Delivery Task 5 evidence files.
- Do not read, copy, log, submit, or test with the credential-holding
  `/private/tmp/popcorn-delivery-5-live/.env.local` or any real user value.
- Do not add packages, images, fonts, analytics, CAPTCHA, OAuth, password
  managers, extra login methods, production hardening, or commercial flows.
- Do not change the gateway DTO, key storage, consent, activation, rotation,
  revocation, or network behavior.
- Do not copy LLM Wiki GPLv3 code, tests, prompts, components, or assets.

## Consumed and produced interfaces

Consumes:

- `POST /auth/sign-in` with `email`, `password`, and the existing `intent`
  values `sign-in` or `sign-up`.
- The existing `ModelGatewaySettings` local state, fixed API endpoints, DTOs,
  and write-only API-key behavior.
- The existing settings palette and design language in
  `model-gateway-settings.module.css` as a visual reference only.

Produces:

- A styled, responsive, accessible sign-in surface without changing auth.
- Gateway input metadata that distinguishes model/API-key configuration from
  login credentials for browser autocomplete/password-manager heuristics.
- No new server, database, extension, queue, Provider, or shared interface.

## Required TDD cycles

### Cycle 1: sign-in presentation

1. Add or strengthen a component/page test that observes the approved semantic
   layout: a Popcorn purpose/brand region, a clearly labelled local-account
   form region, and the existing two actions with primary/secondary roles.
2. Run it against the baseline and record RED caused by the missing approved
   structure, not by a test error.
3. Add the minimum page/form markup and CSS module needed for the approved
   responsive visual design.
4. Record GREEN. Visual styling itself will receive Controller browser review;
   do not add brittle tests that merely grep CSS source text.

### Cycle 2: gateway credential-autofill isolation

1. Strengthen the real settings component test to require:
   - the create form has `autocomplete="off"` and a stable accessible name;
   - create inputs have unique gateway-specific `id` and `name` values;
   - base URL, display name, and model use `autocomplete="off"`;
   - API key stays `type="password"` and uses
     `autocomplete="new-password"`;
   - the conditional rotation form and key have the same non-login boundary.
2. Run it against the baseline and record RED showing the current missing or
   wrong attributes.
3. Make only the metadata changes required to reach GREEN. Do not add fake or
   hidden username/password fields and do not change DTO data flow.
4. Re-run the settings behavior suite and record GREEN.

Before each test, name the production regression it catches. The test must
exercise the real React component. Do not assert on mocks, grep source, or
weaken existing security and write-only assertions.

## Verification commands

```bash
pnpm vitest run src/app/sign-in/sign-in-form.test.tsx src/app/sign-in/page.test.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm exec eslint src/app/sign-in/page.tsx src/app/sign-in/sign-in-form.tsx src/app/sign-in/sign-in-form.test.tsx src/app/sign-in/page.test.tsx src/app/settings/model-gateway/model-gateway-settings.tsx src/app/settings/model-gateway/model-gateway-settings.test.tsx
pnpm typecheck
git diff --check
git status --short
```

If `page.test.tsx` is not created, omit that nonexistent path from commands and
explain how the approved page structure was covered. Do not run database,
pgTAP, queue, concurrency, full application, live Provider, or load tests: this
repair changes only presentation and browser field metadata.

## Upstream reuse and license requirements

- YouTube Digest pin `d03e1f61e017b032159ffd1821cac6e7693ce0c7`
  is not in this task's execution path; do not edit, duplicate, or replace it.
- LLM Wiki `v0.6.9` / `723e259309aea5e3850265b631f80224f66dd9f6`
  is method-only inspiration and is not needed here. Copy no GPLv3 code, test,
  prompt, component, styling, or asset.
- Preserve existing repository license and attribution files unchanged.

## Commit and handoff contract

Implement only this task, commit all allowed changes, and write
`docs/engineering/handoffs/delivery/task-5-ux-autofill-fix.md` containing:

- RED and GREEN commands/results for both cycles;
- changed files and exact user-visible behavior;
- confirmation that auth/DTO/network/key-clearing behavior is unchanged;
- focused verification results;
- residual risks, including the fact that password-manager heuristics cannot
  be guaranteed across every third-party extension;
- commit SHA.

Return only `DONE` or `DONE_WITH_CONCERNS`, the commit SHA, a one-line test
summary, risks, and the absolute handoff path. Do not spawn subagents.
