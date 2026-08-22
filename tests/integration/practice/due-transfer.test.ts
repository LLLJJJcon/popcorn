import { describe, expect, test, vi } from "vitest";

import { buildDueTransferTask } from "@/server/domain/create-transfer-task";
import { createDuePracticeHttpHandler } from "@/server/domain/complete-due-practice";

const USER = "11111111-1111-4111-8111-111111111111";
const REVIEW = "22222222-2222-4222-8222-222222222222";

describe("due Practice transfer boundary", () => {
  test("creates a different-context prompt that withholds a complete answer", () => {
    const originalPrompt = "这个价格也太离谱了吧，你会怎么说？";
    const transfer = buildDueTransferTask({
      id: "33333333-3333-4333-8333-333333333333", userId: USER, reviewTaskId: REVIEW,
      userExpressionId: "44444444-4444-4444-8444-444444444444", targetExpression: "太离谱了",
      originalPromptChinese: originalPrompt, dueAt: "2026-08-21T12:00:00.000Z", masteryState: "tried",
    });
    expect(transfer.promptChinese.normalize("NFKC")).not.toContain(originalPrompt.normalize("NFKC"));
    expect(JSON.stringify(transfer)).not.toContain("这个价格也太离谱了吧");
  });

  test("keeps public errors generic and no-store without raw provider, database, or gateway detail", async () => {
    const complete = vi.fn(async () => { throw new Error("apiKey=x baseUrl=https://secret database detail"); });
    const handler = createDuePracticeHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })),
      complete,
      appUrl: "https://popcorn.example",
      requestId: () => "safe-request-id",
    });
    const response = await handler(new Request(`https://popcorn.example/api/v1/practice/due/${REVIEW}`, {
      method: "POST", headers: { origin: "https://popcorn.example", "content-type": "application/json" },
      body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
    }), { params: Promise.resolve({ reviewTaskId: REVIEW }) });
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toContain("safe-request-id");
    expect(body).not.toMatch(/api.?key|base.?url|provider|database|secret/i);
  });

  test("rejects an invalid route identity before completion", async () => {
    const complete = vi.fn();
    const handler = createDuePracticeHttpHandler({
      authenticate: vi.fn(async () => ({ ok: true as const, userId: USER })), complete,
      appUrl: "https://popcorn.example", requestId: () => "safe-request-id",
    });
    const response = await handler(new Request("https://popcorn.example/api/v1/practice/due/nope", {
      method: "POST", headers: { origin: "https://popcorn.example", "content-type": "application/json" },
      body: JSON.stringify({ responseChinese: "太离谱了。", assistanceLevel: "none" }),
    }), { params: Promise.resolve({ reviewTaskId: "nope" }) });

    expect(response.status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});
