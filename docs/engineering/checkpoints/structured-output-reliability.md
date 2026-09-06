# Structured Output Reliability Checkpoint

## Outcome

Structured Output Reliability Tasks 1–9 are implemented, independently reviewed, repaired where necessary, integrated on `codex/popcorn-youtube-learning`, and accepted with focused verification.

- Design baseline: `fcc44c1219bbb98a8029da59a7d2dfc7f0cc782d`
- Accepted implementation head: `3656771`
- Final independent review: PASS — Critical 0, Important 0, Minor 0

## Final architecture

```text
separate system/user prompt
  -> bounded JSON candidate extraction
  -> operation-specific semantic wire normalization
  -> deterministic server enrichment
  -> existing strict domain schema
  -> persistence/API
  -> Saved, Practice, or extension consumer
```

The model supplies only semantic content. Stable IDs, timestamps, transcript evidence, pass/fail, assistance, independent-use, mastery, and review scheduling are computed from trusted server state. Fixed engineering fields are not requested from the model and are not accepted from it as authoritative.

Consumers still receive the existing strict domain artifacts. No database migration or public domain-schema replacement was introduced. Request-addressable cache reuse requires exact owner, source/input, model, gateway fingerprint, result key, finite prompt version, and strict schema agreement. Saved/Practice learning records remain readable across later gateway changes when ownership, source graph, finite provenance, and strict content remain valid.

## Accepted task commits and evidence

| Task | Integrated commits | Focused acceptance |
| --- | --- | --- |
| 1 — shared extraction/gateway/errors | `e5ce6af`, `b9956a9`, `cb3826b` | 141 tests; focused generated-route type issue repaired and re-reviewed |
| 2 — Overview/Translation/Explanation wire | `71cec13`, `1bbfcfd` | 91 tests |
| 3 — Saved semantic candidates | `b9c3994`, `dc1b64e` | 100 tests |
| 4 — Practice activation/evaluation wire | `a82b506` | 71 tests |
| 5 — finite compatibility/cache reuse | `1bc344d`, `cb06a7d` | 277 tests |
| 6 — extension partial result/retry | `92cb8e2`, `d18552e` | 93 extension tests; JS syntax |
| 7 — Saved status/recovery | `c4f4ecd`, `bcfcd2a` | 28 tests; typecheck |
| 8 — Practice non-pass/revision UX | `1965cc0` | 24 tests; typecheck |
| 9 — integration/final repairs | `c4e0a54`, `7bdedef`, `67315c9`, `7402722`, `7d9aa6d`, `ab524ce`, `3656771` | initial server 344, Web 52, extension 93; final-repair server 212, extension 72; final material repository 28; typecheck, JS syntax, diff checks |

## Review findings closed

1. Practice now preserves rate-limit, unavailable, invalid-model-output, and internal/persistence categories across activation, original/revision evaluation, and Due flows.
2. Explanation recovery polls the exact durable job, cancels stale modal/video ownership, and uses a fresh retry identity for one explicit retry.
3. Overview resolves same-source-index duplicates/conflicts before limits: exact duplicates collapse and conflicting items are all discarded.
4. Immediate Practice material lookup now uses the same Activation v1/v2 and all-null/all-present provenance gate as attempt submission, preventing a task from opening when it cannot be submitted.

## Verification boundary and remaining risk

The user requested feature-local acceptance for this reliability work. Therefore no full Vitest suite, complete extension suite, browser run, database reset, real Provider call, or full end-to-end test was repeated at this checkpoint. Those are deferred to the later school-demo gate, where one representative real video and configured gateway should be exercised end to end.

No migration, generated database type, root configuration, or lockfile changed. Existing YouTube Digest MIT reuse remains untouched, and no LLM Wiki GPLv3 code, prompt, test, component, or asset was copied.
