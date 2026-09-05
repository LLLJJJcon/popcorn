# Delivery recovery Task 5Q report

## Scope

Implemented the bounded Practice-evaluation recovery at baseline `8acfcd9`.
No client, public-contract, migration, configuration, credential, or test files changed.

## Code-level root cause

The OpenAI-compatible structured JSON client rejected any assistant content beginning with a Markdown fence before attempting JSON parsing. Practice output parsing then treated the required three-dimension evaluation and optional natural-revision coaching as one all-or-nothing object: an absent, malformed, or target-ungrounded coaching field prevented persistence of otherwise valid scoring. It also required the model's assistance claims to agree with the submission rather than deriving those fields from the trusted request.

## Recovery

- Structured JSON parsing now unwraps one complete Markdown fence before parsing. Any non-JSON, partial, or multi-part response still fails closed.
- Practice parsing validates the three scored dimensions and `passed` with the existing strict schema. When the attempt service supplies the trusted assistance level, it overwrites model-supplied `assistanceLevel` and `independentUse` before validation; no dimension score or feedback is synthesized.
- Coaching is independently safe-parsed and must include the exact target expression. Invalid, absent, or ungrounded coaching yields `null` while valid scoring continues to persistence.
- The OpenAI-compatible client uses a 60-second timeout only for `evaluate-practice-v2`; every other structured completion retains its prior timeout.

## Static verification

- Inspected the changed call path: `attempt-repository` passes the validated submission assistance level into the parser; persisted independence remains derived from that same input.
- Inspected parser boundaries: `EvaluationResultSchema` still requires all three integer 1--5 dimensions and their English feedback before an attempt record is built.
- Inspected timeout scope: the 60-second branch is keyed to the Practice evaluation prompt version, while overview, translation, explanation, and text-completion paths are unchanged.
- Ran `git diff --check`; no whitespace errors were reported.
- Per request, no tests were added or run, and no live Provider request was issued.

## Residual risk

This intentionally does not recover a response missing or invalid in any scored dimension; it still returns the existing provider-failure path and persists nothing. Coaching may be omitted from an otherwise successful response, in which case callers receive `null` coaching.

## Fix round 1

The first implementation left Due Practice on the compatibility path that omitted trusted assistance and subsequently compared the model's claims. Due Practice now passes `input.data.assistanceLevel` to the parser, which requires that trusted value and derives both assistance fields before strict evaluation parsing. The redundant model-claim rejection was removed. Both original/revision attempts and Due Practice therefore reject only invalid required scoring, not conflicting or absent model-declared assistance fields.
