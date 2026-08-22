# Local-First Task 4 Handoff

## Result

- Added a deterministic local extension generator with an explicit 18-file
  source allowlist plus generated `manifest.json` and `runtime-config.js`.
- Generated host permissions are exactly YouTube, the configured App origin,
  and the configured Supabase origin.
- Preserved the source manifest key and stable unpacked extension ID while
  removing the retired Chrome `identity` permission.
- Generated runtime configuration contains only the exact App origin, exact
  Supabase origin, and public anon key. It ignores all other environment fields
  and never writes private keys, passwords, tokens, or a source-machine path.
- `background.js` loads `runtime-config.js` before settings/auth/queue, obtains
  both App and Supabase values from that object, and no longer hardcodes the App
  or Supabase endpoint.
- Repeated builds replace stale output and produce the same file hashes.

## Output allowlist

```text
auth.js
background.js
content.js
icons/icon128.png
icons/icon16.png
icons/icon48.png
manifest.json
options.css
options.html
options.js
prompts/analysis.md
prompts/explain.md
prompts/note-cleanup.md
prompts/translation.md
runtime-config.js
settings.js
sidepanel.css
sidepanel.html
sidepanel.js
sync-queue.js
```

`runtime-config.js` and `manifest.json` are generated; all other entries are
copied individually from the pinned, already-adapted extension runtime.

## TDD evidence

RED:

```text
node_modules/.bin/vitest run tests/release/local-extension-config.test.ts
failed before collection because scripts/build-local-extension.mjs was absent

node --test --test-name-pattern='the worker loads generated runtime configuration before auth and settings' extension/tests/auth.test.js
1 test failed because background.js did not import runtime-config.js
```

Focused GREEN during implementation:

```text
node_modules/.bin/vitest run tests/release/local-extension-config.test.ts
1 file passed; 16 tests passed

node --test extension/tests/auth.test.js extension/tests/auth-worker.test.js extension/tests/sync-queue.test.js extension/tests/worker-restart.test.js
32 tests passed

node_modules/.bin/vitest run tests/provenance
2 files passed; 11 tests passed

node_modules/.bin/tsc --noEmit
passed

node --check scripts/build-local-extension.mjs
passed
```

The controller records the final fresh verification and independent review
after this candidate commit, then adds the root `extension:local` script and
creates the one production output.

## Risks and next dependency

The source manifest retains its historical non-user placeholder host entries
for existing source-runtime regression coverage; the generator always replaces
the complete `host_permissions` array, and only generated output is loadable
because the source tree contains a template rather than a populated
`runtime-config.js`. A reviewer should treat the generated manifest as the
shipping boundary.

The strict origin parser intentionally rejects trailing slashes, default-port
aliases, paths, and other normalized-but-inexact spellings. Users must provide
the canonical origin shown in `.env.local`. The controller still must add
`pnpm extension:local` to root `package.json`; this task does not modify root
configuration or commit a generated `dist/` directory.
