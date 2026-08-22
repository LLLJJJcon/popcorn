import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DuePractice } from "@/features/practice/due-practice";

const task = {
  reviewTaskId: "11111111-1111-4111-8111-111111111111",
  userExpressionId: "22222222-2222-4222-8222-222222222222",
  expression: "太离谱了",
  englishMeaning: "That is outrageous.",
  masteryState: "tried" as const,
  dueAt: "2026-08-21T12:00:00.000Z",
  intervalDays: 1,
};

afterEach(() => vi.unstubAllGlobals());

describe("DuePractice", () => {
  test("retains the response, prevents duplicate submit, and permits retry after a generic failure", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: "33333333-3333-4333-8333-333333333333", reviewTaskId: task.reviewTaskId,
        targetExpression: task.expression, promptChinese: "同事说东西太贵。你会怎么回应？",
        instructionsEnglish: "Reply naturally.", goalEnglish: "Use the target expression.",
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        transition: { from: "tried", to: "reused" }, nextDueAt: "2026-08-29T12:00:00.000Z",
      } }), { status: 201 }));
    vi.stubGlobal("fetch", fetch);
    render(createElement(DuePractice, { tasks: [task] }));

    fireEvent.click(screen.getByRole("button", { name: /start due practice/i }));
    await screen.findByText("同事说东西太贵。你会怎么回应？");
    const response = screen.getByLabelText(/your chinese response/i);
    fireEvent.change(response, { target: { value: "这也太离谱了吧。" } });
    fireEvent.click(screen.getByRole("button", { name: /check my response/i }));
    await screen.findByRole("alert");
    expect(response).toHaveValue("这也太离谱了吧。");

    fireEvent.click(screen.getByRole("button", { name: /check my response/i }));
    await screen.findByText(/moved from tried to reused/i);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  });
});
