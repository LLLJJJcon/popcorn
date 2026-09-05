import {
  createPracticeMaterialRepository,
} from "@/server/repositories/practice-material-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT = "44444444-4444-4444-8444-444444444444";
const SAVED = "55555555-5555-4555-8555-555555555555";
const ARTIFACT = "66666666-6666-4666-8666-666666666666";
const TASK = "77777777-7777-4777-8777-777777777777";
const EXPRESSION = "88888888-8888-4888-8888-888888888888";
const SENSE = "99999999-9999-4999-8999-999999999999";
const REVIEW = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OCCURRENCE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATED = "2026-09-05T08:00:00.000Z";

type Result = { readonly data: unknown; readonly error: unknown };
type PracticeMaterialQuery = {
  readonly table: string;
  filters: [string, unknown][];
  orders: [string, boolean][];
  limit: number | null;
};

function scriptedClient(results: readonly Result[]) {
  const calls: PracticeMaterialQuery[] = [];
  let cursor = 0;
  return {
    calls,
    client: {
      from(table: string) {
        const query: PracticeMaterialQuery = { table, filters: [], orders: [], limit: null };
        return {
          select() { return this; },
          eq(column: string, value: unknown) {
            query.filters.push([column, value]);
            return this;
          },
          order(column: string, options: { readonly ascending: boolean }) {
            query.orders.push([column, options.ascending]);
            return this;
          },
          limit(value: number) {
            query.limit = value;
            return this;
          },
          async maybeSingle() {
            calls.push(query);
            return results[cursor++] ?? { data: null, error: null };
          },
        };
      },
    },
  };
}

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK,
    user_id: USER,
    video_source_id: SOURCE,
    saved_item_id: SAVED,
    candidate_artifact_id: ARTIFACT,
    candidate_index: 0,
    future_user_expression_id: EXPRESSION,
    native_language: "en",
    target_language: "zh-CN",
    target_expression: "太离谱了",
    prompt_chinese: "朋友告诉你一杯咖啡要五十块，你会怎么回应？",
    instructions_english: "Reply naturally in Mandarin.",
    goal_english: "React to an unreasonable price.",
    status: "active",
    created_at: CREATED,
    ...overrides,
  };
}

function candidateArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: ARTIFACT,
    user_id: USER,
    video_source_id: SOURCE,
    saved_item_id: SAVED,
    artifact_type: "saved_item_analysis",
    prompt_version: "analyze-saved-item-v1",
    content: {
      candidates: [{
        expression: "太离谱了",
        englishMeaning: "That is outrageous.",
        englishExplanation: "A strong spoken reaction to something unreasonable.",
        tone: "surprised",
        communicativeFunction: "reaction",
        register: "informal",
        evidenceText: "这也太离谱了。",
        segmentIds: ["segment-1"],
        startSeconds: 42.9,
        endSeconds: 45,
        confidence: 0.95,
      }],
    },
    ...overrides,
  };
}

type DueGraphOverrides = Partial<Record<
  "review" | "task" | "expression" | "sense" | "occurrence" | "snapshot" | "source",
  Record<string, unknown>
>>;

function dueGraph(overrides: DueGraphOverrides = {}): readonly Result[] {
  return [
    { data: {
      id: REVIEW, user_id: USER, user_expression_id: EXPRESSION,
      mastery_state: "reused", status: "pending", due_at: "2026-09-05T07:00:00.000Z",
      ...overrides.review,
    }, error: null },
    { data: {
      id: TASK, user_id: USER, user_expression_id: EXPRESSION, review_task_id: REVIEW,
      kind: "due_practice", native_language: "en", target_language: "zh-CN",
      target_expression: "太离谱了", prompt_chinese: "同事说打印费要一百元，你会怎么回应？",
      instructions_english: "Reply naturally in Mandarin.", goal_english: "React to an unreasonable fee.",
      due_at: "2026-09-05T07:00:00.000Z", created_at: CREATED,
      ...overrides.task,
    }, error: null },
    { data: {
      id: EXPRESSION, user_id: USER, expression_sense_id: SENSE, mastery_state: "reused",
      ...overrides.expression,
    }, error: null },
    { data: {
      id: SENSE, user_id: USER, video_source_id: SOURCE, expression_text: "太离谱了",
      english_meaning: "That is outrageous.", english_explanation: "A strong spoken reaction.",
      tone: "surprised", communicative_function: "reaction", register: "informal",
      ...overrides.sense,
    }, error: null },
    { data: {
      id: OCCURRENCE, user_id: USER, video_source_id: SOURCE, expression_sense_id: SENSE,
      snapshot_id: SNAPSHOT, evidence_text: "这也太离谱了。", start_seconds: 42.9,
      created_at: "2026-08-16T00:00:00.000Z",
      ...overrides.occurrence,
    }, error: null },
    { data: {
      id: SNAPSHOT, user_id: USER, video_source_id: SOURCE, title: "Fixture video",
      ...overrides.snapshot,
    }, error: null },
    { data: {
      id: SOURCE, user_id: USER, canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
      ...overrides.source,
    }, error: null },
  ];
}

describe("Practice material repository", () => {
  test("builds an owner-scoped immediate material view from the frozen candidate provenance", async () => {
    const scripted = scriptedClient([
      { data: draft(), error: null },
      { data: candidateArtifact(), error: null },
      { data: { id: SAVED, user_id: USER, video_source_id: SOURCE, snapshot_id: SNAPSHOT }, error: null },
      { data: { id: SNAPSHOT, user_id: USER, video_source_id: SOURCE, title: "Fixture video" }, error: null },
      { data: { id: SOURCE, user_id: USER, canonical_url: "https://www.youtube.com/watch?v=abcdefghijk" }, error: null },
    ]);
    const repository = createPracticeMaterialRepository(scripted.client as never);

    const material = await repository.findImmediateMaterial(USER, TASK);

    expect(material).toMatchObject({
      task: {
        id: TASK,
        kind: "use_it_now",
        targetExpression: "太离谱了",
      },
      masteryState: "tried",
      source: {
        videoTitle: "Fixture video",
        youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk&t=42s",
        evidenceText: "这也太离谱了。",
        startSeconds: 42.9,
      },
      expression: {
        englishMeaning: "That is outrageous.",
        englishExplanation: "A strong spoken reaction to something unreasonable.",
        tone: "surprised",
        communicativeFunction: "reaction",
        register: "informal",
      },
    });
    expect(JSON.stringify(material)).not.toMatch(/api[_-]?key|gateway|fingerprint|promptVersion|userId/i);
    expect(scripted.calls).toHaveLength(5);
    for (const call of scripted.calls) {
      expect(call.filters).toContainEqual(["user_id", USER]);
      expect(call.limit).toBe(1);
    }
    expect(scripted.calls[1]?.filters).toEqual(expect.arrayContaining([
      ["id", ARTIFACT],
      ["video_source_id", SOURCE],
      ["saved_item_id", SAVED],
      ["artifact_type", "saved_item_analysis"],
    ]));
  });

  test("fails closed for malformed or cross-owner immediate provenance", async () => {
    const crossOwner = scriptedClient([{ data: draft({ user_id: OTHER }), error: null }]);
    await expect(createPracticeMaterialRepository(crossOwner.client as never)
      .findImmediateMaterial(USER, TASK)).resolves.toBeNull();

    const malformed = scriptedClient([
      { data: draft(), error: null },
      { data: candidateArtifact({ content: { candidates: [{ expression: "太离谱了" }] } }), error: null },
    ]);
    await expect(createPracticeMaterialRepository(malformed.client as never)
      .findImmediateMaterial(USER, TASK)).resolves.toBeNull();
  });

  test("builds due material from the exact expression graph and selects occurrence provenance deterministically", async () => {
    const scripted = scriptedClient([
      { data: {
        id: REVIEW, user_id: USER, user_expression_id: EXPRESSION,
        mastery_state: "reused", status: "pending", due_at: "2026-09-05T07:00:00.000Z",
      }, error: null },
      { data: {
        id: TASK, user_id: USER, user_expression_id: EXPRESSION, review_task_id: REVIEW,
        kind: "due_practice", native_language: "en", target_language: "zh-CN",
        target_expression: "太离谱了", prompt_chinese: "同事说打印费要一百元，你会怎么回应？",
        instructions_english: "Reply naturally in Mandarin.", goal_english: "React to an unreasonable fee.",
        due_at: "2026-09-05T07:00:00.000Z", created_at: CREATED,
      }, error: null },
      { data: { id: EXPRESSION, user_id: USER, expression_sense_id: SENSE, mastery_state: "reused" }, error: null },
      { data: {
        id: SENSE, user_id: USER, video_source_id: SOURCE, expression_text: "太离谱了",
        english_meaning: "That is outrageous.", english_explanation: "A strong spoken reaction.",
        tone: "surprised", communicative_function: "reaction", register: "informal",
      }, error: null },
      { data: {
        id: OCCURRENCE, user_id: USER, video_source_id: SOURCE, expression_sense_id: SENSE,
        snapshot_id: SNAPSHOT, evidence_text: "这也太离谱了。", start_seconds: 42.9,
        created_at: "2026-08-16T00:00:00.000Z",
      }, error: null },
      { data: { id: SNAPSHOT, user_id: USER, video_source_id: SOURCE, title: "Fixture video" }, error: null },
      { data: { id: SOURCE, user_id: USER, canonical_url: "https://www.youtube.com/watch?v=abcdefghijk" }, error: null },
    ]);
    const repository = createPracticeMaterialRepository(scripted.client as never);

    const material = await repository.findDueMaterial(USER, REVIEW);

    expect(material).toMatchObject({
      task: { id: TASK, kind: "due_practice", dueAt: "2026-09-05T07:00:00.000Z" },
      masteryState: "reused",
      source: {
        videoTitle: "Fixture video",
        youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk&t=42s",
        evidenceText: "这也太离谱了。",
        startSeconds: 42.9,
      },
      expression: { englishMeaning: "That is outrageous.", communicativeFunction: "reaction" },
    });
    expect(JSON.stringify(material)).not.toMatch(/api[_-]?key|gateway|fingerprint|promptVersion|userId/i);
    expect(scripted.calls).toHaveLength(7);
    for (const call of scripted.calls) {
      expect(call.filters).toContainEqual(["user_id", USER]);
      expect(call.limit).toBe(1);
    }
    expect(scripted.calls[4]).toMatchObject({
      table: "expression_occurrences",
      filters: expect.arrayContaining([
        ["expression_sense_id", SENSE],
        ["video_source_id", SOURCE],
      ]),
      orders: [["created_at", true], ["id", true]],
      limit: 1,
    });
  });

  test("fails closed when the due graph crosses owner, expression, source, or mastery boundaries", async () => {
    const mismatched = scriptedClient([
      { data: {
        id: REVIEW, user_id: USER, user_expression_id: EXPRESSION,
        mastery_state: "tried", status: "pending", due_at: "2026-09-05T07:00:00.000Z",
      }, error: null },
      { data: {
        id: TASK, user_id: USER, user_expression_id: EXPRESSION, review_task_id: REVIEW,
        kind: "due_practice", native_language: "en", target_language: "zh-CN",
        target_expression: "太离谱了", prompt_chinese: "同事说打印费要一百元，你会怎么回应？",
        instructions_english: "Reply naturally in Mandarin.", goal_english: "React to an unreasonable fee.",
        due_at: "2026-09-05T07:00:00.000Z", created_at: CREATED,
      }, error: null },
      { data: { id: EXPRESSION, user_id: USER, expression_sense_id: SENSE, mastery_state: "owned" }, error: null },
    ]);

    await expect(createPracticeMaterialRepository(mismatched.client as never)
      .findDueMaterial(USER, REVIEW)).resolves.toBeNull();
  });

  test("fails closed when an owner-filtered due query returns a cross-owner sense", async () => {
    const crossOwner = scriptedClient(dueGraph({ sense: { user_id: OTHER } }));

    await expect(createPracticeMaterialRepository(crossOwner.client as never)
      .findDueMaterial(USER, REVIEW)).resolves.toBeNull();
  });

  test.each([
    { name: "task expression", graph: { task: { user_expression_id: OTHER } } },
    { name: "task review", graph: { task: { review_task_id: OTHER } } },
    { name: "occurrence sense", graph: { occurrence: { expression_sense_id: OTHER } } },
  ] satisfies ReadonlyArray<{ name: string; graph: DueGraphOverrides }>) (
    "fails closed when the $name crosses the due expression graph",
    async ({ graph }) => {
      const crossExpression = scriptedClient(dueGraph(graph));

      await expect(createPracticeMaterialRepository(crossExpression.client as never)
        .findDueMaterial(USER, REVIEW)).resolves.toBeNull();
    },
  );

  test.each([
    { name: "occurrence source", graph: { occurrence: { video_source_id: SAVED } } },
    { name: "snapshot id", graph: { snapshot: { id: SAVED } } },
    { name: "snapshot source", graph: { snapshot: { video_source_id: SAVED } } },
    { name: "source id", graph: { source: { id: SAVED } } },
  ] satisfies ReadonlyArray<{ name: string; graph: DueGraphOverrides }>) (
    "fails closed when the $name crosses the due source graph",
    async ({ graph }) => {
      const crossSource = scriptedClient(dueGraph(graph));

      await expect(createPracticeMaterialRepository(crossSource.client as never)
        .findDueMaterial(USER, REVIEW)).resolves.toBeNull();
    },
  );
});
