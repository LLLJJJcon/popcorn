import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { PracticeMaterialView } from "@/features/practice/material-schema";
import { DuePractice } from "@/features/practice/due-practice";

const ids = {
  first: "11111111-1111-4111-8111-111111111111",
  second: "22222222-2222-4222-8222-222222222222",
  third: "33333333-3333-4333-8333-333333333333",
  fourth: "44444444-4444-4444-8444-444444444444",
};

const tasks = [
  { reviewTaskId: ids.fourth, userExpressionId: ids.fourth, expression: "第四", englishMeaning: "Fourth", masteryState: "owned" as const, dueAt: "2026-08-24T12:00:00.000Z", intervalDays: 30 },
  { reviewTaskId: ids.third, userExpressionId: ids.third, expression: "第三", englishMeaning: "Third", masteryState: "reused" as const, dueAt: "2026-08-23T12:00:00.000Z", intervalDays: 7 },
  { reviewTaskId: ids.second, userExpressionId: ids.second, expression: "第二", englishMeaning: "Second", masteryState: "tried" as const, dueAt: "2026-08-21T12:00:00.000Z", intervalDays: 1 },
  { reviewTaskId: ids.first, userExpressionId: ids.first, expression: "第一", englishMeaning: "First", masteryState: "tried" as const, dueAt: "2026-08-21T12:00:00.000Z", intervalDays: 1 },
];

function material(reviewTaskId: string, expression: string): PracticeMaterialView {
  const meanings: Record<string, string> = {
    第一: "First", 第二: "Second", 第三: "Third", 第四: "Fourth",
  };
  return {
    task: {
      id: reviewTaskId, userExpressionId: reviewTaskId, kind: "due_practice", nativeLanguage: "en",
      targetLanguage: "zh-CN", targetExpression: expression,
      promptChinese: "同事说一件让人惊讶的事。你会怎么回应？",
      instructionsEnglish: "Reply with one natural sentence in Simplified Chinese.",
      goalEnglish: "React naturally in this new situation.", dueAt: "2026-08-21T12:00:00.000Z",
      createdAt: "2026-08-21T12:00:00.000Z",
    },
    masteryState: "tried",
    source: {
      videoTitle: "Everyday Mandarin", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk&t=42s",
      evidenceText: `原来的${expression}例句。`, startSeconds: 42,
    },
    expression: {
      englishMeaning: meanings[expression] ?? "A conversational expression",
      englishExplanation: "Use it as a conversational reaction.",
      tone: "surprised", communicativeFunction: "reacting to surprising information",
      register: "informal spoken Mandarin",
    },
  };
}

function apiResponse(data: unknown, status = 200) {
  return Response.json({ ok: true, data, requestId: "safe-request" }, { status });
}

function transfer(reviewTaskId: string, expression: string) {
  const view = material(reviewTaskId, expression);
  return {
    id: view.task.id,
    reviewTaskId,
    targetExpression: view.task.targetExpression,
    promptChinese: view.task.promptChinese,
    instructionsEnglish: view.task.instructionsEnglish,
    goalEnglish: view.task.goalEnglish,
    material: view,
  };
}

function completion(reviewTaskId: string) {
  return {
    reviewTaskId, practiceTaskId: reviewTaskId, attemptId: ids.fourth, masteryEventId: ids.third,
    nextReviewTaskId: ids.second, priorState: "tried", newState: "reused",
    nextDueAt: "2026-08-29T12:00:00.000Z", intervalDays: 7, created: true,
    transition: { from: "tried", to: "reused" },
    evaluation: {
      passed: true,
      accuracy: { score: 5, englishFeedback: "The expression carries the intended meaning." },
      naturalness: { score: 4, englishFeedback: "It sounds natural in conversation." },
      contextualFit: { score: 5, englishFeedback: "It fits this situation." },
      independentUse: true, assistanceLevel: "none",
    },
    coaching: { naturalRevisionChinese: "这件事也太夸张了吧。" },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DuePractice", () => {
  test("sorts due work, caps the session at three, and advances through the local queue", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")))
      .mockResolvedValueOnce(apiResponse(completion(ids.first), 201))
      .mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二")));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks} />);

    expect(screen.getByText("3 due · about 6 minutes")).toBeInTheDocument();
    const queue = screen.getByRole("list", { name: "This practice session" });
    expect(within(queue).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("第一"), expect.stringContaining("第二"), expect.stringContaining("第三"),
    ]);
    expect(screen.queryByText("第四")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("heading", { name: "第一" })).toBeInTheDocument();
    expect(screen.getByText("2 left in this session")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/practice/due/${ids.first}`);

    await user.type(screen.getByLabelText("Your Chinese response"), "这真的太夸张了。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    expect(await screen.findByText("Practice recorded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "第二" })).toBeInTheDocument();
    expect(screen.getByText("1 left in this session")).toBeInTheDocument();
    expect(fetchMock.mock.calls[2]?.[0]).toBe(`/api/v1/practice/due/${ids.second}`);
  });

  test("Stop returns to landing without completing an item", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.fourth, "第四")));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.slice(0, 1)} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await screen.findByRole("heading", { name: "第四" });
    await user.click(screen.getByRole("button", { name: "Stop for now" }));

    expect(screen.getByRole("button", { name: "Start practice" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.some(([, options]) => (options as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  test("links an empty learner to Saved and Vault", () => {
    render(<DuePractice tasks={[]} />);
    expect(screen.getByText(/you are caught up/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review Saved moments" })).toHaveAttribute("href", "/saved");
    expect(screen.getByRole("link", { name: "Browse your Vault" })).toHaveAttribute("href", "/vault");
  });

  test("retains the response and permits retry after a checking failure", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(transfer(ids.fourth, "第四")))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(apiResponse(completion(ids.fourth), 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.slice(0, 1)} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await screen.findByRole("heading", { name: "第四" });
    const response = screen.getByLabelText("Your Chinese response");
    await user.type(response, "这也太夸张了吧。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/response is still here/i);
    expect(response).toHaveValue("这也太夸张了吧。");

    await user.click(screen.getByRole("button", { name: "Check my response" }));
    expect(await screen.findByText("Practice recorded")).toBeInTheDocument();
  });

  test("resets the hint disclosure and assistance before the next queued item", async () => {
    const hinted = {
      ...completion(ids.first),
      evaluation: {
        ...completion(ids.first).evaluation,
        independentUse: false,
        assistanceLevel: "hint",
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")))
      .mockResolvedValueOnce(apiResponse(hinted, 201))
      .mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二")))
      .mockResolvedValueOnce(apiResponse(completion(ids.second), 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.filter((task) => [ids.first, ids.second].includes(task.reviewTaskId))} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await screen.findByRole("heading", { name: "第一" });
    await user.click(screen.getByRole("button", { name: "Need a hint?" }));
    expect(screen.getByText("Use it as a conversational reaction.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Your Chinese response"), "第一种回应。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    await screen.findByRole("heading", { name: "第二" });
    expect(screen.getByRole("button", { name: "Need a hint?" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Use it as a conversational reaction.")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Your Chinese response"), "第二种回应。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    await screen.findByText("Practice recorded");

    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toMatchObject({ assistanceLevel: "hint" });
    expect(JSON.parse(String((fetchMock.mock.calls[3]?.[1] as RequestInit).body))).toMatchObject({ assistanceLevel: "none" });
  });

  test("compares one local rewrite with the recorded feedback without another due POST", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(transfer(ids.fourth, "第四")))
      .mockResolvedValueOnce(apiResponse(completion(ids.fourth), 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.slice(0, 1)} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    await user.type(await screen.findByLabelText("Your Chinese response"), "第一版回应。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    await user.click(await screen.findByRole("button", { name: "Revise once" }));
    const response = screen.getByLabelText("Your Chinese response");
    await user.clear(response);
    await user.type(response, "我根据反馈改写了。");
    await user.click(screen.getByRole("button", { name: "Compare my rewrite" }));

    expect(await screen.findByText(/compared locally.*no new model check/i)).toBeInTheDocument();
    expect(screen.getByText("这件事也太夸张了吧。")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
  });

  test("rejects a malformed successful transfer envelope without losing the queued item", async () => {
    const malformed = { ...transfer(ids.fourth, "第四"), targetExpression: undefined };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(malformed)));
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.slice(0, 1)} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not open/i);
    expect(screen.getByText("1 due · about 2 minutes")).toBeInTheDocument();
  });

  test("rejects malformed completion data while preserving text and the due queue", async () => {
    const malformed = { ...completion(ids.fourth), masteryEventId: undefined };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse(transfer(ids.fourth, "第四")))
      .mockResolvedValueOnce(apiResponse(malformed, 201));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DuePractice tasks={tasks.slice(0, 1)} />);

    await user.click(screen.getByRole("button", { name: "Start practice" }));
    const response = await screen.findByLabelText("Your Chinese response");
    await user.type(response, "这份回答要保留。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/response is still here/i);
    expect(response).toHaveValue("这份回答要保留。");
    await user.click(screen.getByRole("button", { name: "Stop for now" }));
    expect(screen.getByText("1 due · about 2 minutes")).toBeInTheDocument();
  });
});
