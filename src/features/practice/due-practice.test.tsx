import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PracticeMaterialView } from "./material-schema";
import { DuePractice } from "./due-practice";
const ids = {
  first: "11111111-1111-4111-8111-111111111111",
  second: "22222222-2222-4222-8222-222222222222",
  third: "33333333-3333-4333-8333-333333333333",
  fourth: "44444444-4444-4444-8444-444444444444",
};
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
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function submit(text = "这真的太夸张了。") {
  await screen.findByLabelText("Your Chinese response");
  fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my response" }));
}
test("single Review has fixed Next and no local session cap or Stop controls", async () => {
  const next = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(completion(ids.first), 201)));
  render(<DuePractice reviewTaskId={ids.first} mode="session" onNext={next}/>);
  await submit();
  await screen.findByRole("heading", { name: "Feedback" });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(next).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  expect(screen.queryByText("Stop for now")).not.toBeInTheDocument();
});
test("hint and recorded assistance reset for next keyed item without client assistance claims", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse({ examplesOpened: true })).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), evaluation: { ...completion(ids.first).evaluation, independentUse: false, assistanceLevel: "model_answer" } }, 201)).mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二"))).mockResolvedValueOnce(apiResponse(completion(ids.second), 201));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<DuePractice key={ids.first} reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your Chinese response");
  fireEvent.click(screen.getByRole("button", { name: "About this expression" }));
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await act(async () => { });
  await submit("第一种回应。");
  await screen.findByRole("heading", { name: "Feedback" });
  view.rerender(<DuePractice key={ids.second} reviewTaskId={ids.second}/>);
  await screen.findByRole("heading", { name: "第二" });
  expect(screen.getByRole("button", { name: "About this expression" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Use it as a conversational reaction.")).not.toBeInTheDocument();
  await submit("第二种回应。");
  await screen.findByRole("heading", { name: "Feedback" });
  expect(fetcher.mock.calls[1]![0]).toContain("/examples-opened");
  expect(JSON.parse(String(fetcher.mock.calls[2]![1].body))).not.toHaveProperty("assistanceLevel");
  expect(JSON.parse(String(fetcher.mock.calls[4]![1].body))).not.toHaveProperty("assistanceLevel");
});
test("compares local rewrite without a second scoring request", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(completion(ids.first), 201));
  vi.stubGlobal("fetch", fetcher);
  render(<DuePractice reviewTaskId={ids.first}/>);
  await submit("第一版回应。");
  fireEvent.click(await screen.findByRole("button", { name: "Compare with suggested revision" }));
  fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: "我根据反馈改写了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Show comparison" }));
  const comparison = screen.getByRole("region", { name: "Compare with suggested revision" });
  expect(within(comparison).getByText("我根据反馈改写了。")).toBeInTheDocument();
  expect(within(comparison).getByText("这件事也太夸张了吧。")).toBeInTheDocument();
  expect(within(comparison).queryByText(/checked|evaluated|scored/i)).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
test("nonpass retains submitted response and omits absent revision", async () => {
  const failed = { ...completion(ids.first), priorState: "tried", newState: "tried", transition: null, coaching: null, evaluation: { ...completion(ids.first).evaluation, passed: false, independentUse: false, accuracy: { score: 2, englishFeedback: "Meaning needs work." } } };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(failed, 201)));
  render(<DuePractice reviewTaskId={ids.first}/>);
  await submit("这份回答需要修改。");
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.getByText("这份回答需要修改。")).toBeInTheDocument();
  expect(screen.getByText("Keep going — we'll bring this back tomorrow.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Compare with suggested revision" })).not.toBeInTheDocument();
});
test("malformed transfer remains retryable without exposing any material", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse({ ...transfer(ids.first, "第一"), targetExpression: undefined })).mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")));
  vi.stubGlobal("fetch", fetcher);
  render(<DuePractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Your Chinese response")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "第一" });
  expect(fetcher.mock.calls[1]![0]).toContain(ids.first);
});
test("malformed or wrong-identity completion preserves answer and emits no evidence", async () => {
  const done = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), masteryEventId: undefined }, 201)).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), reviewTaskId: ids.second }, 201));
  vi.stubGlobal("fetch", fetcher);
  render(<DuePractice reviewTaskId={ids.first} onCompleted={done}/>);
  await submit("这份回答要保留。");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your Chinese response")).toHaveValue("这份回答要保留。");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await act(async () => { });
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Your Chinese response")).toHaveValue("这份回答要保留。");
});
test("wrong transfer identity is rejected before answer controls appear", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二"))));
  render(<DuePractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Your Chinese response")).not.toBeInTheDocument();
});
