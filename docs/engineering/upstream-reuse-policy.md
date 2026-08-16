# Popcorn Upstream Reuse Policy

This policy freezes how Popcorn may use the two upstream projects named by the
approved product design. Every implementation and review must enforce the
immutable references and license boundaries below.

## YouTube Digest: code reuse

- Source repository: `zarazhangrui/youtube-digest`.
- Immutable pin: `d03e1f61e017b032159ffd1821cac6e7693ce0c7`.
- License: MIT. Popcorn must preserve the upstream copyright and license in
  `third_party/youtube-digest/LICENSE` and `THIRD_PARTY_NOTICES.md` for copied
  or substantially adapted work.
- Action: reuse or adapt the plan-identified implementation and tests before
  creating equivalent extension behavior. A parallel implementation requires
  a failing adaptation test and controller approval.
- Foundation static gate: reuse `extension/tests/release.test.js`; later tasks
  extend the applicable pinned tests rather than creating a parallel release
  check.

Every extension task brief, handoff, and review must record all of the
following concrete fields:

1. source repository;
2. immutable pin;
3. source file and function (or the exact source behavior when no symbol
   exists);
4. target file;
5. adaptation;
6. license action; and
7. reused test.

An entry such as "inspired by YouTube Digest" is not provenance and must fail
review. If the pinned source file or function is absent, or a required file is
outside the approved intake allowlist, the task stops for controller review.

## LLM Wiki: method only

- Source repository: `nashsu/llm_wiki`.
- Release and immutable pin: `v0.6.9` at
  `723e259309aea5e3850265b631f80224f66dd9f6`.
- License: GPLv3.
- Action: method only. Popcorn MUST NOT copy GPLv3 implementation code, tests,
  prompts, components, or assets.

The only allowed methods are concepts independently implemented in Popcorn relational/domain code:

- immutable raw sources followed by generated structured knowledge;
- schema-governed knowledge organization;
- two-stage analysis and knowledge update;
- source traceability;
- content hashing and incremental work avoidance;
- durable processing queues;
- asynchronous human review for ambiguous decisions; and
- index, operation log, and staged retrieval concepts.

These methods apply to private YouTube learning snapshots, source-grounded
expression knowledge, deterministic hashes, and durable `knowledge_jobs`.
Batch B two-stage/traceability/async confirmation independently adapts the
analysis, provenance, and human-decision methods. Batch C relational staged retrieval independently adapts the retrieval concepts without adding vector, graph, or chat behavior.

Popcorn forbids LLM Wiki code, tests, prompts, components, assets, desktop runtime, Markdown/Obsidian filesystem, LanceDB/vector, graphs/community, agent chat, Deep Research, web clipper, and MCP implementation. These bans also prohibit their implementation structure, not merely their names.

## Enforcement

Provenance tests, task handoffs, and independent reviews jointly enforce this
policy. New dependencies or copied upstream files require a controller-owned
license and allowlist decision before implementation.
