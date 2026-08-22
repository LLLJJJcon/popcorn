# Local-First Task 1 Review Repair 1

- Original task baseline: `60f388879fc41dfd0a89a9aa9e4b774c198796dd`.
- Repair baseline: `b7de300348a2cf93711cf547c70c0b4bfc8f6a7d`.
- Worktree: `/private/tmp/popcorn-local-gateway-fix-1`.
- Plan: `docs/superpowers/plans/2026-08-22-popcorn-local-first-amendments.md`, Task 1.
- Upstream/license: no YouTube Digest code is needed; do not copy any LLM Wiki GPLv3
  code, tests, prompts, components, or assets. Project changes remain MIT-intended.

## Allowed files

- `src/contracts/model-gateway.ts`
- `tests/contract/model-gateway.test.ts`
- `supabase/tests/model_gateway.sql`
- `src/types/database.generated.ts` only for a verified terminal-newline normalization
- `docs/engineering/briefs/local-first/task-1.md`
- `docs/engineering/handoffs/local-first/task-1.md`
- this repair brief

No migration, service, repository, UI, root config, lockfile, extension, Progress, or
ledger change is allowed.

## Required TDD repair

1. Add a RED contract assertion showing `https://example.1a/v1` currently passes the
   TypeScript base URL contract while SQL rejects the same final DNS label.
2. Add the matching pgTAP assertion for direct configuration creation.
3. Make the TypeScript canonical-origin rule match the existing SQL rule: the last DNS
   label must begin with an ASCII letter. Do not loosen SQL or any public-host boundary.
4. Remove the EOF blank line reported in `task-1.md`.
5. Keep generated types at the repository's one-terminal-newline convention. Because the
   pinned Supabase CLI emits an additional empty EOF line, document and use a deterministic
   normalization of the temporary generated file before `diff -u`; do not hand-edit any
   generated signature.

## Verification

```bash
node_modules/.bin/vitest run tests/contract/model-gateway.test.ts
node_modules/.bin/supabase test db supabase/tests/model_gateway.sql
node_modules/.bin/supabase gen types typescript --local --schema public,private > /tmp/popcorn-database.generated.ts
perl -0pi -e 's/\n\n\z/\n/' /tmp/popcorn-database.generated.ts
diff -u src/types/database.generated.ts /tmp/popcorn-database.generated.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/contracts/model-gateway.ts tests/contract/model-gateway.test.ts
git diff --check b7de300348a2cf93711cf547c70c0b4bfc8f6a7d..HEAD
```

Update the existing Task 1 handoff with RED/GREEN evidence, commit the scoped repair, and
report the commit SHA. Do not self-approve; a new independent reviewer gates integration.
