import { render, screen } from "@testing-library/react";
import { createElement } from "react";

import { DuePractice } from "@/features/practice/due-practice";
import { ExpressionCard } from "@/features/vault/expression-card";
import { VaultList } from "@/features/vault/vault-list";
import {
  createLearningMemoryHttpHandlers,
  createSupabaseReviewTaskRepository,
  rankExpressionSuggestions,
  type DuePracticeView,
  type ExpressionCardView,
  type LearningMemoryRepository,
} from "@/server/repositories/review-task-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EXPRESSION = "33333333-3333-4333-8333-333333333333";
const EXACT_EXPRESSION = "66666666-6666-4666-8666-666666666666";
const SIMILAR_EXPRESSION = "77777777-7777-4777-8777-777777777777";
const ZERO_EXPRESSION = "88888888-8888-4888-8888-888888888888";
const NOW = "2026-08-21T02:03:04.000Z";

const card: ExpressionCardView = {
  userExpressionId: EXPRESSION,
  expression: "太离谱了",
  englishMeaning: "That is outrageous.",
  englishExplanation: "A reaction to something unreasonable.",
  tone: "Surprised and critical.",
  communicativeFunction: "Reacting critically.",
  register: "Informal spoken Mandarin.",
  masteryState: "tried",
  occurrence: {
    evidenceText: "这个价格也太离谱了吧",
    segmentIds: ["segment-1"],
    startSeconds: 40,
    endSeconds: 43,
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=40s",
  },
  attempts: [{
    id: "44444444-4444-4444-8444-444444444444",
    responseChinese: "这个价格也太离谱了。",
    passed: true,
    accuracyScore: 5,
    accuracyFeedbackEnglish: "Accurate.",
    naturalnessScore: 4,
    naturalnessFeedbackEnglish: "Natural.",
    contextualFitScore: 5,
    contextualFitFeedbackEnglish: "Fits.",
    submittedAt: NOW,
  }],
};

const due: DuePracticeView = {
  reviewTaskId: "55555555-5555-4555-8555-555555555555",
  userExpressionId: EXPRESSION,
  expression: card.expression,
  englishMeaning: card.englishMeaning,
  masteryState: "tried",
  dueAt: NOW,
  intervalDays: 1,
};

function repository(): LearningMemoryRepository {
  return {
    listVault: vi.fn(async (userId) => userId === USER ? [card] : []),
    getVault: vi.fn(async (userId, id) => userId === USER && id === EXPRESSION
      ? { card, suggestions: [] }
      : null),
    listDue: vi.fn(async (userId) => userId === USER ? [due] : []),
  };
}

function queryClient(plans: Array<{ table: string; data: unknown[] }>) {
  const calls: Array<readonly [string, ...unknown[]]> = [];
  const remaining = [...plans];
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(["from", table]);
        const query = {
          select(columns: string) { calls.push(["select", table, columns]); return query; },
          eq(column: string, value: unknown) { calls.push(["eq", table, column, value]); return query; },
          in(column: string, value: unknown) { calls.push(["in", table, column, value]); return query; },
          lte(column: string, value: unknown) { calls.push(["lte", table, column, value]); return query; },
          order(column: string, value: unknown) { calls.push(["order", table, column, value]); return query; },
          async limit(value: number) {
            calls.push(["limit", table, value]);
            const plan = remaining.shift();
            if (!plan || plan.table !== table) throw new Error(`unexpected query ${table}`);
            return { data: plan.data, error: null };
          },
        };
        return query;
      },
    },
  };
}

function expressionRow(id: string, senseId: string) {
  return { id, user_id: USER, expression_sense_id: senseId, mastery_state: "tried", created_at: NOW };
}

function senseRow(id: string, expression: string, meaning: string) {
  return {
    id,
    user_id: USER,
    video_source_id: USER,
    expression_text: expression,
    normalized_expression_text: expression.normalize("NFKC").trim(),
    english_meaning: meaning,
    english_explanation: `${meaning} explanation`,
    tone: "Neutral.",
    communicative_function: "Reacting.",
    register: "Spoken Mandarin.",
  };
}

function occurrenceRow(id: string, senseId: string) {
  return {
    id,
    user_id: USER,
    video_source_id: USER,
    expression_sense_id: senseId,
    evidence_text: "source evidence",
    segment_ids: ["segment-1"],
    start_seconds: 40,
    end_seconds: 43,
    created_at: NOW,
  };
}

describe("Vault and due Practice boundaries", () => {
  test("production Vault reads promoted expressions and complete staged revision history with owner filters", async () => {
    const harness = queryClient([
      { table: "user_expressions", data: [{ id: EXPRESSION, user_id: USER, expression_sense_id: OTHER, mastery_state: "tried", created_at: NOW }] },
      { table: "expression_senses", data: [{
        id: OTHER, user_id: USER, video_source_id: USER, expression_text: card.expression,
        normalized_expression_text: card.expression, english_meaning: card.englishMeaning,
        english_explanation: card.englishExplanation, tone: card.tone,
        communicative_function: card.communicativeFunction, register: card.register,
      }] },
      { table: "expression_occurrences", data: [{
        id: OTHER, user_id: USER, video_source_id: USER, expression_sense_id: OTHER,
        evidence_text: card.occurrence.evidenceText, segment_ids: ["segment-1"],
        start_seconds: 40, end_seconds: 43, created_at: NOW,
      }] },
      { table: "video_sources", data: [{
        id: USER, user_id: USER, canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }] },
      { table: "practice_draft_attempts", data: [
        {
          id: card.attempts[0]!.id, user_id: USER, future_user_expression_id: EXPRESSION,
          response_chinese: card.attempts[0]!.responseChinese, passed: true,
          accuracy_score: 5, accuracy_feedback_english: "Accurate.", naturalness_score: 4,
          naturalness_feedback_english: "Natural.", contextual_fit_score: 5,
          contextual_fit_feedback_english: "Fits.", submitted_at: NOW,
        },
        {
          id: OTHER, user_id: USER, future_user_expression_id: EXPRESSION,
          response_chinese: "真的太离谱了。", passed: true,
          accuracy_score: 5, accuracy_feedback_english: "Accurate.", naturalness_score: 5,
          naturalness_feedback_english: "Natural.", contextual_fit_score: 5,
          contextual_fit_feedback_english: "Fits.", submitted_at: "2026-08-21T02:04:04.000Z",
        },
      ] },
    ]);

    const cards = await createSupabaseReviewTaskRepository(harness.client as never).listVault(USER);
    expect(cards[0]?.attempts.map((attempt) => attempt.responseChinese)).toEqual([
      "这个价格也太离谱了。", "真的太离谱了。",
    ]);
    expect(harness.calls).toEqual(expect.arrayContaining([
      ["eq", "user_expressions", "user_id", USER],
      ["eq", "expression_senses", "user_id", USER],
      ["eq", "expression_occurrences", "user_id", USER],
      ["eq", "video_sources", "user_id", USER],
      ["eq", "practice_draft_attempts", "user_id", USER],
      ["in", "practice_draft_attempts", "future_user_expression_id", [EXPRESSION]],
    ]));
  });

  test("production Practice reads only owner pending tasks due by server time in stable order", async () => {
    const harness = queryClient([
      { table: "review_tasks", data: [{
        id: due.reviewTaskId, user_id: USER, user_expression_id: EXPRESSION,
        mastery_state: "tried", status: "pending", due_at: NOW, interval_days: 1,
      }] },
      { table: "user_expressions", data: [{
        id: EXPRESSION, user_id: USER, expression_sense_id: OTHER, mastery_state: "tried",
      }] },
      { table: "expression_senses", data: [{
        id: OTHER, user_id: USER, expression_text: card.expression, english_meaning: card.englishMeaning,
      }] },
    ]);
    await expect(createSupabaseReviewTaskRepository(harness.client as never).listDue(USER, NOW))
      .resolves.toEqual([due]);
    expect(harness.calls).toEqual(expect.arrayContaining([
      ["eq", "review_tasks", "user_id", USER],
      ["eq", "review_tasks", "status", "pending"],
      ["lte", "review_tasks", "due_at", NOW],
      ["order", "review_tasks", "due_at", { ascending: true }],
      ["order", "review_tasks", "id", { ascending: true }],
    ]));
  });

  test("keeps exact normalized matches first and omits zero-overlap suggestions", () => {
    expect(rankExpressionSuggestions("太离谱了", [
      { userExpressionId: ZERO_EXPRESSION, expression: "天气真好", englishMeaning: "The weather is nice." },
      { userExpressionId: OTHER, expression: "离谱", englishMeaning: "Absurd B." },
      { userExpressionId: EXACT_EXPRESSION, expression: " 太离谱了 ", englishMeaning: card.englishMeaning },
      { userExpressionId: USER, expression: "离谱", englishMeaning: "Absurd A." },
    ])).toEqual([
      { userExpressionId: EXACT_EXPRESSION, expression: " 太离谱了 ", englishMeaning: card.englishMeaning, match: "exact" },
      { userExpressionId: USER, expression: "离谱", englishMeaning: "Absurd A.", match: "similar" },
      { userExpressionId: OTHER, expression: "离谱", englishMeaning: "Absurd B.", match: "similar" },
    ]);
  });

  test("limits deterministic exact suggestions to eight", () => {
    const candidates = Array.from({ length: 9 }, (_, index) => ({
      userExpressionId: `expression-${String(9 - index).padStart(2, "0")}`,
      expression: "太离谱了",
      englishMeaning: `Meaning ${9 - index}`,
    }));
    expect(rankExpressionSuggestions("太离谱了", candidates).map((value) => value.userExpressionId))
      .toEqual([
        "expression-01", "expression-02", "expression-03", "expression-04",
        "expression-05", "expression-06", "expression-07", "expression-08",
      ]);
  });

  test("Vault detail excludes itself while retaining a different exact match before positive similarity", async () => {
    const exactSense = "99999999-9999-4999-8999-999999999999";
    const similarSense = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const zeroSense = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const targetSense = senseRow(OTHER, card.expression, card.englishMeaning);
    const exact = senseRow(exactSense, card.expression, "Same text, different source.");
    const similar = senseRow(similarSense, "离谱", "Absurd.");
    const zero = senseRow(zeroSense, "天气真好", "The weather is nice.");
    const source = {
      id: USER,
      user_id: USER,
      canonical_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    };
    const harness = queryClient([
      { table: "user_expressions", data: [expressionRow(EXPRESSION, OTHER)] },
      { table: "expression_senses", data: [targetSense] },
      { table: "expression_occurrences", data: [occurrenceRow(OTHER, OTHER)] },
      { table: "video_sources", data: [source] },
      { table: "practice_draft_attempts", data: [] },
      { table: "user_expressions", data: [
        expressionRow(EXPRESSION, OTHER),
        expressionRow(EXACT_EXPRESSION, exactSense),
        expressionRow(SIMILAR_EXPRESSION, similarSense),
        expressionRow(ZERO_EXPRESSION, zeroSense),
      ] },
      { table: "expression_senses", data: [targetSense, exact, similar, zero] },
      { table: "expression_occurrences", data: [
        occurrenceRow(OTHER, OTHER),
        occurrenceRow(EXACT_EXPRESSION, exactSense),
        occurrenceRow(SIMILAR_EXPRESSION, similarSense),
        occurrenceRow(ZERO_EXPRESSION, zeroSense),
      ] },
      { table: "video_sources", data: [source] },
      { table: "practice_draft_attempts", data: [] },
    ]);

    const detail = await createSupabaseReviewTaskRepository(harness.client as never)
      .getVault(USER, EXPRESSION);
    expect(detail?.suggestions).toEqual([
      {
        userExpressionId: EXACT_EXPRESSION,
        expression: card.expression,
        englishMeaning: "Same text, different source.",
        match: "exact",
      },
      {
        userExpressionId: SIMILAR_EXPRESSION,
        expression: "离谱",
        englishMeaning: "Absurd.",
        match: "similar",
      },
    ]);
  });

  test("owner-scoped GET handlers return bounded public DTOs and a 404-equivalent cross-owner detail", async () => {
    const repo = repository();
    const handlers = createLearningMemoryHttpHandlers({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })),
      repository: repo,
      now: () => NOW,
      requestId: () => "safe-request",
    });

    const listResponse = await handlers.vault(new Request("https://popcorn.example/api/v1/vault"));
    const dueResponse = await handlers.due(new Request("https://popcorn.example/api/v1/practice/due"));
    const missingResponse = await handlers.vaultDetail(
      new Request("https://popcorn.example/api/v1/vault/missing"),
      { params: Promise.resolve({ userExpressionId: OTHER }) },
    );
    expect(listResponse.status).toBe(200);
    expect(dueResponse.status).toBe(200);
    expect(missingResponse.status).toBe(404);
    expect(repo.listVault).toHaveBeenCalledExactlyOnceWith(USER);
    expect(repo.listDue).toHaveBeenCalledExactlyOnceWith(USER, NOW);
    expect(repo.getVault).toHaveBeenCalledExactlyOnceWith(USER, OTHER);
    expect(await listResponse.text()).not.toMatch(/api.?key|gateway|fingerprint|prompt|provider|raw/i);
  });

  test("renders complete grounded cards, due Practice, and useful empty states", () => {
    const { rerender } = render(createElement(VaultList, { cards: [] }));
    expect(screen.getByText(/No expressions in your Vault yet/i)).toBeInTheDocument();
    rerender(createElement(VaultList, { cards: [card] }));
    expect(screen.getByRole("heading", { name: "太离谱了" })).toBeInTheDocument();
    expect(screen.getByText(card.englishExplanation)).toBeInTheDocument();
    expect(screen.getByText(card.occurrence.evidenceText)).toBeInTheDocument();
    expect(screen.getByText(card.attempts[0]!.responseChinese)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Watch source/i })).toHaveAttribute("href", card.occurrence.youtubeUrl);

    rerender(createElement(DuePractice, { tasks: [] }));
    expect(screen.getByText(/No Practice is due/i)).toBeInTheDocument();
    rerender(createElement(DuePractice, { tasks: [due] }));
    expect(screen.getByRole("heading", { name: "Practice" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Practice 太离谱了/i })).toHaveAttribute("href", `/vault#expression-${due.userExpressionId}`);
    expect(document.body).not.toHaveTextContent(/queue/i);
  });

  test("a card never renders private Provider provenance", () => {
    render(createElement(ExpressionCard, { card }));
    expect(document.body).not.toHaveTextContent(/api.?key|gateway|fingerprint|prompt|provider|raw/i);
  });
});
