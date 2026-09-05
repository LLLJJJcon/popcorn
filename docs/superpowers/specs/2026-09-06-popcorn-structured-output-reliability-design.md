# Popcorn Structured Output Reliability Design

**Date:** 2026-09-06
**Status:** Approved by the user on 2026-09-06
**Baseline:** `97c23789f4285965757adba1ba09f44a78908b7a`

## 1. Problem

Popcorn uses a user-configured OpenAI-compatible model gateway for six runtime
learning operations:

1. YouTube video overview;
2. subtitle translation;
3. selected-Chinese explanation;
4. Saved-item candidate-expression analysis;
5. Practice situation activation;
6. Practice response evaluation, shared by original attempts, revisions, and
   due reviews.

Several operations currently ask the model to copy deterministic data such as
timestamps, stable IDs, saved-item identity, or assistance state. The server
then compares those copies byte-for-byte with data it already owns. Harmless
model behavior such as adding prose, wrapping JSON, using smart punctuation,
or adding an explanatory field can therefore reject an otherwise useful
answer.

The visible symptom is repeated generic failure. The concrete Saved analysis
incident at 165 seconds reached the configured model four times and received
`PROVIDER_OUTPUT_INVALID` four times. The worker and gateway were running, but
the existing error code could not distinguish JSON extraction, wire-schema,
or evidence-grounding failure. Generic durable retry then added 1, 2, 4, and 8
minute delays to a task whose useful model work should take seconds.

This work creates one reliability boundary for every Popcorn model operation.
The model performs language judgment. Popcorn derives identity, time, state,
and other deterministic facts in code.

## 2. Goals

- Apply the same structured-output reliability model to all six runtime AI
  operations consumed by the Web application and YouTube Side Panel.
- Strengthen every real system and user prompt with an exact task contract.
- Stop asking models to return information Popcorn can derive exactly.
- Recover useful JSON from common harmless wrappers without accepting
  ambiguous or fabricated content.
- Separate tolerant model-wire parsing from strict persisted/API contracts.
- Preserve valid independent items when a batch contains one invalid item.
- Fail malformed model output quickly after local recovery instead of repeating
  the same request on minute-scale backoff.
- Distinguish transport, extraction, schema, grounding, and persistence errors
  without storing sensitive model input or output.
- Keep the gateway compatible with OpenAI-compatible hosted and local models.
- Preserve previously generated artifacts when prompt versions advance.

## 3. Non-goals

- No direct model or Provider request from the browser extension.
- No dependency on OpenAI-only JSON Schema, tool calls, or function calling.
- No general JSON repair that inserts punctuation, invents missing fields, or
  rewrites content.
- No second model call whose purpose is to repair the first model response.
- No prompt, transcript, user response, raw model response, API key, or gateway
  credential in diagnostics.
- No new input source, chat experience, vector storage, knowledge graph,
  export, billing, quota, or commercial-grade orchestration.
- No change to the product's `tried -> reused -> owned` mastery vocabulary.

## 4. Design principles

### 4.1 Model output is an untrusted wire format

Each operation owns a small wire schema describing only information that
requires language judgment. Wire parsing may tolerate a documented set of
format variations. Persisted artifacts and public API responses continue to
use strict domain schemas.

The processing pipeline is:

```text
bounded Provider response
  -> assistant text extraction
  -> bounded JSON candidate extraction
  -> task wire normalization
  -> unique valid semantic payload
  -> deterministic server enrichment
  -> strict domain and grounding validation
  -> persistence/publication
```

### 4.2 Deterministic facts have one owner

Popcorn never asks a model to echo facts already known by the application.
Stable IDs, timestamps, ownership, gateway provenance, assistance state,
mastery state, retry state, and persistence identity are server-owned.

### 4.3 Tolerance is bounded and explicit

The parser may recover formatting. It may not guess meaning, evidence, or
identity. Every accepted alias or coercion is task-local and covered by a
fixture.

### 4.4 Useful partial results survive

Independent batch members are validated independently. A bad Saved candidate,
Overview chapter, Overview quote, or translation row does not destroy other
valid members. Atomic Practice evaluation and Explanation payloads still
require all mandatory semantic fields.

## 5. Shared gateway request contract

The structured gateway must carry a task request containing:

- `promptVersion`;
- task-specific `systemPrompt`;
- one `userPrompt` containing the bounded data payload;
- task-specific timeout and output-token limits.

The school-demo profile uses these upper bounds:

| Task | Timeout | Maximum output tokens |
| --- | ---: | ---: |
| Overview | 120 seconds | 900 |
| Translation | 30 seconds | 800 |
| Explanation | 30 seconds | 500 |
| Saved analysis | 30 seconds | 900 |
| Practice activation | 30 seconds | 250 |
| Practice evaluation | 30 seconds | 700 |

The OpenAI-compatible adapter continues to send ordinary
`/chat/completions` messages. It does not send `response_format`, tools, or
Provider-specific parameters as a prerequisite for correctness. A future
adapter may use native structured output only after an explicit capability is
configured; this design does not require that work.

The task system prompt contains the output contract and instruction-isolation
rules. Transcript text, video titles, saved text, candidate material, and
learner responses appear only as delimited untrusted data in the user message.
The system prompt explicitly states that text inside that data is never an
instruction.

Every structured task prompt states:

- return exactly one JSON object;
- no Markdown, prose, comments, or second object;
- exact allowed keys and a complete successful example;
- required and optional fields;
- primitive types, array limits, numeric ranges, and language requirements;
- no unknown keys in the requested response;
- which fields must not be returned because Popcorn supplies them;
- allowed source indexes and the rule against invented evidence.

Local recovery remains present even with strict prompts because different
compatible models do not follow formatting instructions equally well.

## 6. Bounded JSON extraction

### 6.1 Extraction order

The shared extractor operates on the already bounded assistant-content string:

1. Try the entire trimmed string as JSON.
2. Try the content of one whole-response Markdown fence.
3. Scan the response for complete top-level JSON objects using a state machine
   that understands quoted strings, escaped characters, and nested braces.
4. Inspect an explicit one-level wrapper only when its sole semantic container
   key is `result`, `data`, or `output`.
5. Pass each candidate to the operation's wire normalizer.
6. Accept only when exactly one candidate becomes a valid semantic payload.

Two JSON objects are ambiguous and rejected even when both validate. The
extractor does not select the first object. It does not recursively search
arbitrary nested keys.

The response retains the existing maximum byte limit. Scanning is linear,
bounded by that limit, and retains no more than eight complete object
candidates. Unterminated braces, invalid JSON, no valid payload, or multiple
valid objects produce an extraction-stage failure.

### 6.2 Safe normalization

Normalization is a per-task allowlist, not a global guessing engine. Permitted
examples include:

- discarding unknown non-conflicting keys;
- `feedback` to `englishFeedback` for Practice dimensions;
- an integer string such as `"4"` to numeric `4` when the entire string is an
  unambiguous integer within the declared range;
- common English smart quotes, dashes, non-breaking spaces, and ellipses to
  their ASCII equivalents in English-only semantic fields.

Normalization never changes:

- Chinese expressions, quotes, prompts, revisions, or transcript text;
- source indexes;
- IDs, timestamps, ownership, or gateway provenance;
- missing mandatory semantic content;
- conflicting duplicate values.

Known fields with the wrong semantic type remain invalid. Multiple occurrences
of the same source index with different content are conflicts and are not
resolved by choosing one.

### 6.3 Overview plain-text exception

Overview alone may accept a non-empty response within its existing content
limit as a summary-only artifact when it contains Latin letters, contains no
Han characters, and contains no JSON opening token or Markdown fence. A
response containing broken JSON is not saved as literal overview prose.
Chapters and key quotes remain optional enhancements.

## 7. Operation contracts

### 7.1 YouTube Overview

Model wire output:

```json
{
  "overview": "A concise English overview.",
  "chapters": [
    {
      "title": "Topic title",
      "summary": "Short English summary.",
      "sourceLineIndex": 12
    }
  ],
  "keyQuotes": [
    {
      "quote": "Exact Chinese subtitle text",
      "englishMeaning": "Short English meaning.",
      "sourceLineIndex": 18
    }
  ]
}
```

The prompt contains transcript line indexes and text, never stable IDs or
timestamps. The server maps indexes to stable IDs and timestamps and verifies
quotes against exact transcript evidence. Invalid chapters and quotes are
dropped individually. A valid overview is publishable without either optional
collection.

### 7.2 Subtitle translation

The model receives only ordered request-local indexes and Chinese text. It does
not receive timestamps or stable IDs.

Model wire output:

```json
{
  "translations": [
    { "sourceLineIndex": 0, "english": "First translation." },
    { "sourceLineIndex": 1, "english": "Second translation." }
  ]
}
```

The server maps each valid unique index back to the requested stable ID.
Unknown or duplicate-conflicting indexes are rejected individually. At least
one valid row publishes a partial artifact. Missing rows are returned as
missing so the Side Panel can retry only the missing set in one batch. A
translation never determines or returns time information.

### 7.3 Selected-Chinese Explanation

Model wire output:

```json
{
  "meaning": "English meaning.",
  "tone": "Tone description.",
  "communicativeFunction": "What the speaker is doing.",
  "contextualFit": "Why it fits this moment."
}
```

`selectedChinese`, segment IDs, selection offsets, and timestamps remain in the
server request context and are added after parsing. The model is not asked to
echo them. All four semantic fields are required; otherwise the operation
fails quickly with a wire-schema stage.

### 7.4 Saved candidate-expression analysis

The model receives:

- saved-item kind;
- optional focus text needed to distinguish a selection from a moment save;
- bounded transcript records shaped as `{sourceLineIndex, chinese}`.

It does not receive saved-item IDs, snapshot IDs, stable segment IDs, hashes,
timestamps, ownership, or gateway identity.

Model wire output:

```json
{
  "candidates": [
    {
      "expression": "而且高得要命",
      "englishMeaning": "and extremely high",
      "englishExplanation": "A spoken intensifier marks an extreme degree.",
      "tone": "Emphatic",
      "communicativeFunction": "Emphasizing an extreme degree",
      "register": "Conversational",
      "sourceLineIndices": [0],
      "confidence": 0.9
    }
  ]
}
```

The server maps indexes to persisted segments and generates `segmentIds`,
`evidenceText`, `startSeconds`, and `endSeconds`. `expression` must be an exact
substring of the selected evidence. When `sourceLineIndices` is absent, the
server may recover it only when the expression has exactly one match in the
bounded evidence window; zero or multiple matches are rejected. It never uses
fuzzy Chinese text matching.

`confidence` remains a semantic model estimate because it is not a fixed fact.
If omitted, Popcorn assigns `0.5`, a conservative low-confidence value that triggers
the existing confirmation notice rather than pretending certainty.

Each candidate is normalized and grounded independently. Invalid candidates
are discarded. One to three valid candidates may publish; zero valid
candidates fails the task.

### 7.5 Practice situation activation

The model returns only:

```json
{
  "promptChinese": "朋友告诉你一个特别夸张的价格。你会怎么回应？"
}
```

The prompt must be a short learner situation or question, must end in `?` or
`？`, and must not contain the target expression or a completed answer.

The server supplies the candidate's target expression and evidence. It also
supplies this exact stable product copy for the English instruction and goal:

- instruction: `Reply with one natural Simplified Chinese sentence.`
- goal: `Use the target expression naturally in this new situation.`

User, task, candidate, model, gateway, and persistence identity remain
server-owned.

### 7.6 Practice response evaluation

Original Practice, revision, and Due Practice use the same prompt builder,
wire normalizer, and deterministic decision function.

Model wire output:

```json
{
  "accuracy": {
    "score": 4,
    "englishFeedback": "The intended meaning is clear."
  },
  "naturalness": {
    "score": 3,
    "englishFeedback": "Move the adverb before the adjective."
  },
  "contextualFit": {
    "score": 5,
    "englishFeedback": "The response fits the situation."
  },
  "naturalRevisionChinese": "这个价格也高得要命。"
}
```

The prompt includes exact 1-to-5 rubrics for each dimension. Scores must be
integers. Feedback is concise English and must explain one actionable reason.
`naturalRevisionChinese` is optional and is retained only when it is valid
Chinese and contains the target expression. The prompt requires it to preserve
the learner's intended meaning; the server does not pretend it can prove that
semantic requirement with string matching alone.

The model does not return `passed`, `assistanceLevel`, `independentUse`, user or
task IDs, submission time, mastery state, or review schedule.

The server computes:

```text
passed =
  accuracy.score >= 3
  && naturalness.score >= 3
  && contextualFit.score >= 3

independentUse =
  passed
  && assistanceLevel == "none"
```

The actual assistance level comes from the learner interaction. The existing
mastery and scheduling domain rules consume the resulting valid evaluation;
the model never decides mastery or dates.

## 8. Practice failure experience

A valid evaluation with `passed == false` is a learning result, not a Provider
or system failure.

The feedback panel displays:

- `Keep practising - N areas need work`;
- Accuracy, Naturalness, and Context fit scores with specific English feedback;
- visual emphasis only on dimensions below 3;
- one deterministic `Focus first` recommendation based on the lowest-scoring
  dimension, with a stable tie-break order;
- a valid natural Chinese revision when available;
- a real `Revise and check again` action when another evaluation will occur;
- whether the attempt entered the Vault;
- whether mastery changed and, for Due Practice, the next review date.

A failed original attempt is recorded but does not enter the Vault, create
independent-use evidence, or advance mastery. A revision after seeing feedback
is genuinely re-evaluated, but it does not retroactively turn the original
attempt into independent first-use evidence. Due Practice failure leaves
mastery unchanged, resets the success sequence under the existing schedule,
and clearly states the next review date.

Original Practice revisions use the existing revision endpoint and receive a
real new evaluation. Due Practice keeps its bounded one-evaluation session: its
post-feedback action is labeled `Compare with suggested revision` and presents
the learner rewrite beside the suggested revision without claiming that a model
checked the rewrite.

## 9. Failure classification and retry

Every failure is classified internally by a non-sensitive stage:

- `transport`;
- `timeout`;
- `rate_limit`;
- `provider_http`;
- `response_envelope`;
- `json_extract`;
- `wire_schema` plus a bounded field path;
- `grounding` plus a bounded rule name;
- `persistence`.

Diagnostics may include a request ID, job ID, response byte length, and safe
schema path. They never include prompts, model text, transcript content,
learner responses, account identifiers, keys, or credentials.

Retry policy:

- `json_extract`, `wire_schema`, and `grounding`: complete local recovery once,
  then terminate the model attempt without minute-scale automatic retry;
- connection failure before a response, HTTP 429, 502, 503, or 504: at most one
  retry after one second, or an explicit `Retry-After` no greater than three
  seconds;
- timeout, other 4xx responses, and output validation failure: no automatic
  Provider recall;
- Overview remains a single call because its bounded request already has the
  longest task budget;
- authentication/configuration failure: fail immediately with a Settings
  action;
- persistence failure: retain the durable job's recoverability without making
  another Provider request when the validated result is already available;
- explicit user retry must create or requeue a genuinely executable attempt,
  never only redisplay an exhausted deduplicated job.

The Web and extension show user-level categories such as `Model unavailable`,
`Model response could not be read`, `Still processing`, and `Retry available`.
They do not expose internal schema paths or Provider response bodies.

## 10. Partial publication and cache behavior

- Overview publishes a valid overview plus any independently valid chapters
  and quotes.
- Saved analysis publishes one to three independently valid candidates.
- Translation publishes valid unique rows and identifies missing rows.
- Practice evaluation is atomic across its three score dimensions; coaching is
  optional and may be discarded independently.
- Explanation is atomic across its four mandatory semantic fields.

Successful artifacts retain their current owner/source/snapshot/prompt/model
cache identity. Reopening the same video or Saved item reuses the successful
artifact and does not spend model usage again unless the source, selected input,
or gateway fingerprint changes, or the user explicitly requests regeneration.
Introducing a new prompt version does not automatically regenerate an existing
valid historical artifact.

## 11. Prompt-version compatibility

Every changed operation receives a new explicit prompt/wire version. Requests
without an existing valid compatible artifact generate only the latest version
and therefore do not reuse a failed terminal job produced under an older
contract.

Readers use a finite allowlist of known compatible historical versions. They
must continue to display existing valid Saved candidates, Overview artifacts,
translations, explanations, Practice drafts, and attempts. Unknown future or
unrecognized versions remain unavailable rather than being guessed.

Version migration must cover generation, artifact lookup, Saved rendering,
Practice activation, Practice material lookup, extension polling, and retry
registration. A constant replacement in only the producer is insufficient.

Files under `extension/prompts/*.md` are upstream/provenance assets and are not
loaded by the runtime. Runtime prompts remain server-owned under
`src/server/ai/prompts`. Documentation must not imply that editing an unused
extension prompt changes model behavior.

## 12. Security and product boundaries

- The extension communicates only with the authenticated Popcorn service.
- Model gateway keys remain in the existing server-side Vault boundary.
- User identity, gateway credentials, job identity, and durable IDs never enter
  model prompts merely to be echoed.
- Transcript and learner text are treated as untrusted data for prompt-injection
  purposes.
- Model output cannot directly select ownership, write targets, mastery,
  scheduling, or Provider configuration.
- The design remains appropriate for a local-first personal school project; it
  does not add commercial moderation, quotas, billing, or large-scale
  concurrency machinery.

## 13. Verification matrix

### 13.1 Shared extraction fixtures

- pure JSON;
- whole-response JSON fence;
- prose before and after one object;
- allowed single-level wrapper;
- braces and escaped quotes inside JSON strings;
- safe aliases, integer strings, and common English Unicode punctuation;
- unknown extra keys;
- unterminated or oversized JSON;
- missing mandatory fields;
- two JSON objects;
- conflicting duplicate values;
- prompt-injection text inside transcript and learner-response data.

The first seven cases recover when the task payload remains unambiguous. The
remaining cases fail safely.

### 13.2 Operation-specific tests

- Overview maps indexes to exact IDs/timestamps and does not preserve broken
  JSON as prose.
- Translation never sends time/IDs to the model, preserves valid rows, and
  reports only missing indexes for retry.
- Explanation does not ask the model to echo selection identity.
- Saved analysis derives all evidence/ID/time fields, rejects ambiguous or
  ungrounded Chinese, and preserves other valid candidates.
- Activation asks for only `promptChinese` and supplies fixed English copy in
  code.
- Practice uses one normalizer and decision function for original, revision,
  and Due flows.
- Practice boundary cases: all three scores are 3 and pass; any one score is 2
  and fails; assisted attempts never become independent use.
- Existing known prompt versions remain readable and usable.
- Output-format failures do not enter 1/2/4/8 minute retries.
- Transport failures receive only the documented short retry.
- Web and extension display the same safe status category for the same server
  state.

### 13.3 Targeted acceptance

This reliability change does not require the unrelated whole-product suite or
a complete Saved-to-Practice browser journey after every task. Each task runs
only the focused unit, contract, integration, or extension tests named in its
implementation plan.

The final controller gate runs the shared extractor contract tests once and the
focused test files for each of the six model operations once. It also performs
one consumer-boundary check per affected Web or extension surface to prove the
new enriched artifact shape still renders. It does not run database reset,
full pgTAP, the complete Vitest suite, the complete extension suite, production
build, or full Playwright flow unless a task actually changes that boundary or
its focused test reveals a regression there.

After focused automated acceptance passes, manual checking is limited to the
two originally failing actions with the user's configured gateway:

1. analyze one Saved moment and confirm candidates appear without minute-scale
   output-format retry;
2. submit one passing and one non-passing Practice response and confirm useful
   feedback appears.

The other four model operations use deterministic compatibility fixtures for
this change and do not require a real-Provider smoke.

## 14. Delivery and task boundaries

Implementation is split so concurrent agents never modify the same files:

1. controller-owned shared request/extraction contracts and prompt version
   compatibility;
2. Overview and translation adaptation;
3. Explanation and Saved analysis adaptation;
4. Practice activation and evaluation adaptation;
5. Web and extension status/partial-result UX;
6. controller integration, cross-feature fixtures, and manual smoke.

Shared contracts, migrations if proven necessary, generated database types,
root configuration, lockfiles, prompt-version compatibility policy, and final
integration remain controller-owned. Each implementation task receives a
baseline commit, isolated worktree, exact file allowlist, RED/GREEN evidence,
handoff report, independent review, and focused verification before
integration.
