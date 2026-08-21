import type { WebSessionResult } from "@/server/auth/web-session";

import {
  createExpressionSearchHttpHandler,
  createExpressionSearchRepository,
  type ExpressionSearchRepository,
} from "./expression-search-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const SOURCE = "33333333-3333-4333-8333-333333333333";
const UPDATED = "2026-08-21T02:03:04.000Z";

function row(overrides: Record<string, unknown> = {}) {
  return {
    user_expression_id: "44444444-4444-4444-8444-444444444444",
    expression_sense_id: "55555555-5555-4555-8555-555555555555",
    expression_text: "太离谱了",
    english_meaning: "absurd",
    communicative_function: "reaction",
    register: "informal",
    mastery_state: "reused",
    source_count: 2,
    updated_at: UPDATED,
    match_reason: "exact",
    ...overrides,
  };
}

describe("expression search repository", () => {
  test("calls the frozen RPC exactly once and preserves its authoritative order", async () => {
    const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{
      data: ReturnType<typeof row>[];
      error: null;
    }>>(async () => ({
      data: [
        row({ expression_text: "太离普了", match_reason: "trigram" }),
        row({
          user_expression_id: "66666666-6666-4666-8666-666666666666",
          expression_sense_id: "77777777-7777-4777-8777-777777777777",
          expression_text: "太离谱了",
          match_reason: "exact",
        }),
        row({
          user_expression_id: "88888888-8888-4888-8888-888888888888",
          expression_sense_id: "99999999-9999-4999-8999-999999999999",
          expression_text: "这太离谱了",
          match_reason: "substring",
        }),
      ],
      error: null,
    }));
    const repository = createExpressionSearchRepository({ rpc } as never);

    const result = await repository.searchExpressions(USER, { query: "太离谱了" });

    expect(rpc).toHaveBeenCalledExactlyOnceWith("search_expressions", {
      p_user_id: USER,
      p_query: "太离谱了",
      p_communicative_function: undefined,
      p_register: undefined,
      p_video_source_id: undefined,
      p_mastery_state: undefined,
      p_created_from: undefined,
      p_created_before: undefined,
      p_limit: 20,
    });
    expect(result.map(({ expressionText, matchReason }) => [expressionText, matchReason])).toEqual([
      ["太离普了", "trigram"],
      ["太离谱了", "exact"],
      ["这太离谱了", "substring"],
    ]);
  });

  test("passes every structured filter and the caller limit without application pre-limiting", async () => {
    const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{
      data: ReturnType<typeof row>[];
      error: null;
    }>>(async () => ({ data: [row({ match_reason: "communicative_function" })], error: null }));
    const repository = createExpressionSearchRepository({ rpc } as never);

    await repository.searchExpressions(USER, {
      query: "reaction",
      communicativeFunction: "reaction",
      register: "informal",
      videoSourceId: SOURCE,
      masteryState: "owned",
      createdFrom: "2026-08-01T00:00:00.000Z",
      createdBefore: "2026-09-01T00:00:00.000Z",
      limit: 50,
    });

    expect(rpc).toHaveBeenCalledExactlyOnceWith("search_expressions", {
      p_user_id: USER,
      p_query: "reaction",
      p_communicative_function: "reaction",
      p_register: "informal",
      p_video_source_id: SOURCE,
      p_mastery_state: "owned",
      p_created_from: "2026-08-01T00:00:00.000Z",
      p_created_before: "2026-09-01T00:00:00.000Z",
      p_limit: 50,
    });
  });

  test("supports empty-query recent results and all frozen lexical match reasons", async () => {
    const rpc = vi.fn<(name: string, args: Record<string, unknown>) => Promise<{
      data: ReturnType<typeof row>[];
      error: null;
    }>>(async () => ({
      data: ["recent", "prefix", "english_meaning", "register"].map((matchReason, index) => row({
        user_expression_id: `00000000-0000-4000-8000-00000000000${index + 1}`,
        expression_sense_id: `10000000-0000-4000-8000-00000000000${index + 1}`,
        match_reason: matchReason,
      })),
      error: null,
    }));
    const repository = createExpressionSearchRepository({ rpc } as never);

    await expect(repository.searchExpressions(USER, { query: "" })).resolves.toHaveLength(4);
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_user_id: USER, p_query: "", p_limit: 20 });
  });

  test("fails closed on malformed or cross-owner-shaped RPC results", async () => {
    const malformed = createExpressionSearchRepository({
      rpc: vi.fn(async () => ({ data: [row({ match_reason: "semantic" })], error: null })),
    } as never);
    await expect(malformed.searchExpressions(USER, { query: "absurd" })).rejects.toThrow();

    const crossOwner = createExpressionSearchRepository({
      rpc: vi.fn(async () => ({ data: [row({ user_id: OTHER })], error: null })),
    } as never);
    await expect(crossOwner.searchExpressions(USER, { query: "太离谱了" })).rejects.toThrow();
  });

  test("authenticates the owner and returns bounded validation and internal errors", async () => {
    const searchExpressions = vi.fn(async () => [
      {
        userExpressionId: "44444444-4444-4444-8444-444444444444",
        expressionSenseId: "55555555-5555-4555-8555-555555555555",
        expressionText: "太离谱了",
        englishMeaning: "absurd",
        communicativeFunction: "reaction",
        register: "informal",
        masteryState: "reused" as const,
        sourceCount: 2,
        updatedAt: UPDATED,
        matchReason: "english_meaning" as const,
      },
    ]);
    const repository: ExpressionSearchRepository = { searchExpressions };
    const authenticated = createExpressionSearchHttpHandler({
      authenticate: async () => ({ ok: true, userId: USER }),
      repository,
      requestId: () => "search-request",
    });
    const response = await authenticated(new Request(
      `https://popcorn.example/api/v1/vault?search=1&q=absurd&mastery=owned&source=${SOURCE}`,
    ));
    expect(response.status).toBe(200);
    expect(searchExpressions).toHaveBeenCalledExactlyOnceWith(USER, expect.objectContaining({
      query: "absurd",
      masteryState: "owned",
      videoSourceId: SOURCE,
    }));
    await expect(response.json()).resolves.toMatchObject({ ok: true, requestId: "search-request" });

    const denied = createExpressionSearchHttpHandler({
      authenticate: async (): Promise<WebSessionResult> => ({ ok: false, reason: "missing" }),
      repository,
      requestId: () => "denied-request",
    });
    expect((await denied(new Request("https://popcorn.example/api/v1/vault?search=1"))).status).toBe(401);

    expect((await authenticated(new Request(
      "https://popcorn.example/api/v1/vault?search=1&limit=51",
    ))).status).toBe(400);

    const failed = createExpressionSearchHttpHandler({
      authenticate: async () => ({ ok: true, userId: USER }),
      repository: { searchExpressions: async () => { throw new Error("database secret"); } },
      requestId: () => "failed-request",
    });
    const failure = await failed(new Request("https://popcorn.example/api/v1/vault?search=1&q=absurd"));
    expect(failure.status).toBe(500);
    expect(await failure.text()).not.toContain("database secret");
  });
});
