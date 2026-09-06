# Final GitHub main whitespace gate

- Baseline: `40ac11e`; remote main parent: `57e3c92`.
- RED: `git diff --check origin/main..HEAD` reports exactly two trailing-whitespace lines in `docs/superpowers/specs/2026-09-04-popcorn-model-gateway-personal-ux.md` (lines 3 and 88).
- Cause: the GitHub push CI checks the entire first `main` integration diff because remote main previously contained only an independent initial README.
- Allowed: only those two whitespace removals plus `docs/engineering/handoffs/delivery/final-whitespace-gate.md`.
- Forbidden: prose/content changes, code, config, migrations, package, lockfile, `.env.local`, credentials, or any unrelated formatting.
- GREEN: `git diff --check origin/main..HEAD` and `git diff --check HEAD^..HEAD` must both exit 0; show that the spec content diff changes only removed trailing spaces.
- Commit and return SHA, RED/GREEN, exact changed lines, risks, and handoff path. MIT/GPL/upstream behavior is unchanged.
