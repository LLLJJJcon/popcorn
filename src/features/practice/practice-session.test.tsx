import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PracticeTask } from "@/contracts/practice";

import { PracticeSession } from "./practice-session";

const task: PracticeTask = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "22222222-2222-4222-8222-222222222222",
  userExpressionId: "33333333-3333-4333-8333-333333333333",
  kind: "use_it_now",
  nativeLanguage: "en",
  targetLanguage: "zh-CN",
  targetExpression: "太离谱了",
  promptChinese: "朋友告诉你一杯普通咖啡卖一百元。你会怎么回应？",
  instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
  goalEnglish: "React critically to the unreasonable price using the target expression.",
  dueAt: null,
  createdAt: "2026-08-21T02:03:04.000Z",
};

const evaluation = {
  passed: true,
  accuracy: { score: 5, englishFeedback: "The expression conveys the intended reaction." },
  naturalness: { score: 4, englishFeedback: "The sentence sounds natural in casual speech." },
  contextualFit: { score: 5, englishFeedback: "It fits the situation directly." },
  independentUse: true,
  assistanceLevel: "none",
};

function apiResponse(data: unknown, status = 200) {
  return Response.json({ ok: true, data, requestId: "safe-request" }, { status });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PracticeSession", () => {
  test("shows learner-first context with no complete model answer before first submit", () => {
    render(<PracticeSession task={task} />);
    expect(screen.getByRole("heading", { name: "Use 太离谱了 now" })).toBeInTheDocument();
    expect(screen.getByText(task.promptChinese)).toBeInTheDocument();
    expect(screen.getByText(task.instructionsEnglish)).toBeInTheDocument();
    expect(screen.getByText(task.goalEnglish)).toBeInTheDocument();
    expect(screen.getByLabelText("Your Chinese response")).toHaveValue("");
    expect(screen.queryByText(/model answer|example response/i)).not.toBeInTheDocument();
  });

  test("retains learner Chinese on recoverable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      ok: false,
      error: { code: "PROVIDER_FAILED", message: "provider secret raw body", retryable: true },
      requestId: "safe-request",
    }, { status: 503 })));
    const user = userEvent.setup();
    render(<PracticeSession task={task} />);
    const response = screen.getByLabelText("Your Chinese response");
    await user.type(response, "这个价格也太离谱了！");
    await user.click(screen.getByRole("button", { name: "Check my response" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your response could not be checked. Try again.");
    expect(response).toHaveValue("这个价格也太离谱了！");
    expect(document.body).not.toHaveTextContent(/provider secret raw body/i);
  });

  test("renders separate feedback and appends a revision without clearing learner text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(apiResponse({
        id: "44444444-4444-4444-8444-444444444444",
        userId: task.userId,
        practiceTaskId: task.id,
        userExpressionId: task.userExpressionId,
        responseChinese: "这个价格也太离谱了。",
        evaluation,
        submittedAt: task.createdAt,
        createdAt: task.createdAt,
      }))
      .mockResolvedValueOnce(apiResponse({
        id: "55555555-5555-4555-8555-555555555555",
        userId: task.userId,
        practiceTaskId: task.id,
        userExpressionId: task.userExpressionId,
        responseChinese: "这个价格也太离谱了吧！",
        evaluation,
        submittedAt: task.createdAt,
        createdAt: task.createdAt,
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PracticeSession task={task} />);
    const response = screen.getByLabelText("Your Chinese response");
    await user.type(response, "这个价格也太离谱了。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));

    expect(await screen.findByRole("heading", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByText("Accuracy: 5/5")).toBeInTheDocument();
    expect(screen.getByText("Naturalness: 4/5")).toBeInTheDocument();
    expect(screen.getByText("Contextual fit: 5/5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Vault" })).toHaveAttribute(
      "href",
      `/vault#expression-${task.userExpressionId}`,
    );
    expect(response).toHaveValue("这个价格也太离谱了。");

    await user.clear(response);
    await user.type(response, "这个价格也太离谱了吧！");
    await user.click(screen.getByRole("button", { name: "Check revised response" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/practice/attempts");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "/api/v1/practice/attempts/44444444-4444-4444-8444-444444444444/revisions",
    );
    expect(response).toHaveValue("这个价格也太离谱了吧！");
  });
});
