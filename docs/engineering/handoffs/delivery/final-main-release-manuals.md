# Final main release manuals — handoff

## Scope

Updated the bilingual Popcorn operating documentation for the personal school
project. The manuals now cover the real GitHub clone/install path, one-time
local setup, Supadata dashboard/docs acquisition guidance, one-click lifecycle,
destructive database reset warning, user-owned OpenAI-compatible gateway
settings, exact public HTTPS DNS gateway validation constraints, unpacked Chrome
extension loading/reload, the YouTube → Saved → Practice → Vault → Progress
flow, recovery guidance, demo steps, and credential safety.

No application code, extension source, configuration, lockfile, migration, or
database file was changed. No credential values were read or included.

## Verification evidence

### RED (before editing)

Command:

```text
set +e
missing=0
rg -q 'https://github.com/LLLJJJcon/popcorn.git' README.md || { echo 'MISSING: README clone URL'; missing=1; }
rg -q 'YouTube.*Saved.*Practice.*Vault.*Progress' docs/operations/local-self-host.md || { echo 'MISSING: complete English learning-flow sequence'; missing=1; }
rg -q 'Supadata dashboard|SUPADATA_API_KEY' README.md || { echo 'MISSING: README Supadata setup pointer'; missing=1; }
if [ "$missing" -eq 0 ]; then echo 'RED CHECK UNEXPECTEDLY PASSED'; exit 1; else echo "RED_CHECK_EXIT=1 (missing=$missing)"; exit 1; fi
```

Result: exit `1`, reporting missing README clone URL, missing complete English
learning-flow sequence, and missing README Supadata setup pointer.

### GREEN (after editing)

Commands:

```text
set -e
rg -q 'https://github.com/LLLJJJcon/popcorn.git' README.md
grep -q 'YouTube video' docs/operations/local-self-host.md
grep -q 'Saved' docs/operations/local-self-host.md
grep -q 'Practice' docs/operations/local-self-host.md
grep -q 'Vault' docs/operations/local-self-host.md
grep -q 'Progress' docs/operations/local-self-host.md
grep -q 'Supadata dashboard' README.md
grep -q 'set -a' docs/operations/user-guide.zh-CN.md
grep -q 'source .env.local' docs/operations/user-guide.zh-CN.md
grep -q 'set +a' docs/operations/user-guide.zh-CN.md
grep -q '刷新或离开页面后只显示“Key saved”' docs/operations/user-guide.zh-CN.md
grep -q 'after refresh or leaving the page' docs/operations/local-self-host.md
grep -q 'exact public HTTPS DNS' docs/operations/local-self-host.md
grep -q 'port, credentials, query, or fragment' docs/operations/local-self-host.md
grep -q '禁止 IP' docs/operations/user-guide.zh-CN.md
grep -q '禁止端口、credentials、查询参数和片段' docs/operations/user-guide.zh-CN.md
```

Result: `REVIEW_FIX_REQUIRED_ITEMS=pass`, exit `0` (all required review items
present).

```text
python3 - <<'PY'
from pathlib import Path
import re
files = [Path('README.md'), Path('docs/operations/local-self-host.md'), Path('docs/operations/user-guide.zh-CN.md')]
for file in files:
    for target in re.findall(r'\[[^]]+\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
        target = target.split('#', 1)[0]
        if not target or '://' in target or target.startswith('mailto:'):
            continue
        if not (file.parent / target).resolve().exists():
            raise SystemExit(f'unresolved link: {file}: {target}')
print('MARKDOWN_RELATIVE_LINKS=pass')
PY
```

Result: `MARKDOWN_RELATIVE_LINKS=pass` (all relative links resolved locally).

Baseline-to-HEAD whitespace command:

```text
git diff --check a96edf151a8e3da660cd34588b756f64caffbc51..HEAD
```

Result: `BASELINE_DIFF_CHECK_EXIT=0`.

The working-tree whitespace command was also run:

```text
git diff --check
```

Result: exit `0` (`GIT_DIFF_CHECK=pass`). No unsupported `FINAL_GREEN` or
`FINAL_REVIEW_GREEN` status is asserted here.

## Changed files

- `README.md`
- `docs/operations/local-self-host.md`
- `docs/operations/user-guide.zh-CN.md`
- `docs/engineering/handoffs/delivery/final-main-release-manuals.md`

The task brief at `docs/engineering/briefs/delivery/final-main-release-manuals.md`
was not staged or committed.

## Commit

Manual implementation commit: `ac4394179fbb18101f2f4de3d39fc764b3bf842f`.
Review-fix commit: `fb2984b25284f4739e89e008c455bcf8c2c25b9c`.
This report-only update is committed separately after the review-fix commit;
the final report commit SHA is returned with this handoff.

## Residual risks

- The manual assumes Docker, Node.js, pnpm, Chrome, Supabase, Supadata, and a
  user-owned compatible model gateway are available; external provider uptime
  and quotas remain outside this repository.
- A real end-to-end YouTube transcript and model run still require the user's
  own local credentials. The docs intentionally contain only variable names
  and placeholders/generic instructions.
- This handoff does not claim a hosted deployment; the documented boundary is
  one-machine personal self-hosting.
