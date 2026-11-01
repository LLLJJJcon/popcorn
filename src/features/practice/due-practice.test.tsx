import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PracticeMaterialView } from "./material-schema";
import { completedReviewFixture, reviewTransferFixture } from "./review-fixtures.test-support";
import { DuePractice } from "./due-practice";
import type { Completion } from "@/contracts/review-practice";
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
  return reviewTransferFixture(reviewTaskId, view);
}
function completion(reviewTaskId: string, responseChinese = "这真的太夸张了。"): Completion {
  const result: Completion = {
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
  const expression = reviewTaskId === ids.second ? "第二" : "第一";
  return { ...result, reviewState: completedReviewFixture(transfer(reviewTaskId, expression), result, responseChinese).reviewState };
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function submit(text = "这真的太夸张了。") {
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
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
  const first = transfer(ids.first, "第一");
  const opened = { ...first.reviewState, expressionRevealedAt: "2026-11-01T00:00:00.000Z", examplesOpenedAt: "2026-11-01T00:00:00.000Z" };
  const assisted: Completion = { ...completion(ids.first), evaluation: { ...completion(ids.first).evaluation, independentUse: false, assistanceLevel: "model_answer" } };
  assisted.reviewState = completedReviewFixture({ ...first, reviewState: opened, expressionRevealed: true }, assisted, "第一种回应。").reviewState;
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(first)).mockResolvedValueOnce(apiResponse({ reviewState: opened })).mockResolvedValueOnce(apiResponse(assisted, 201)).mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二"))).mockResolvedValueOnce(apiResponse(completion(ids.second, "第二种回应。"), 201));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<DuePractice key={ids.first} reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.click(screen.getByRole("button", { name: "About this expression" }));
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await act(async () => { });
  await submit("第一种回应。");
  await screen.findByRole("heading", { name: "Feedback" });
  view.rerender(<DuePractice key={ids.second} reviewTaskId={ids.second}/>);
  await screen.findByLabelText("Your answer in Chinese");
  expect(screen.getByRole("button", { name: "About this expression" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByText("Use it as a conversational reaction.")).not.toBeInTheDocument();
  await submit("第二种回应。");
  await screen.findByRole("heading", { name: "Feedback" });
  expect(fetcher.mock.calls[1]![0]).toContain("/examples-opened");
  expect(JSON.parse(String(fetcher.mock.calls[2]![1].body))).not.toHaveProperty("assistanceLevel");
  expect(JSON.parse(String(fetcher.mock.calls[4]![1].body))).not.toHaveProperty("assistanceLevel");
});
test("natural comparison is local while a real revision scores once without changing the official outcome", async () => {
  const first = transfer(ids.first, "第一");
  const persisted = completedReviewFixture(first, completion(ids.first), "第一版回应。");
  const revision = { id: ids.third, requestId: ids.second, attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), responseChinese: "我根据反馈改写了。", evaluation: { ...completion(ids.first).evaluation, naturalness: { score: 5, englishFeedback: "Fully natural." } }, coaching: null, naturalVersion: null, createdAt: "2026-11-01T01:00:00.000Z" };
  const done = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(first)).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), reviewState: persisted.reviewState }, 201)).mockResolvedValueOnce(apiResponse({ revision, reviewState: { ...persisted.reviewState, latestRevision: revision } }, 201));
  vi.stubGlobal("fetch", fetcher);
  render(<DuePractice reviewTaskId={ids.first} onCompleted={done}/>);
  await submit("第一版回应。");
  fireEvent.click(await screen.findByRole("button", { name: "Show a natural version" }));
  expect(screen.getByRole("heading", { name: "Your answer" }).parentElement).toHaveTextContent("第一版回应。");
  expect(screen.getByRole("heading", { name: "A natural version" }).parentElement).toHaveTextContent("这件事也太夸张了吧。");
  expect(document.querySelectorAll("mark").length).toBeGreaterThan(0);
  expect(fetcher).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Revise this answer" }));
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "我根据反馈改写了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my revision" }));
  await screen.findByText("Naturalness 4 → 5");
  expect(screen.getByRole("heading", { name: "Your revision" }).parentElement).toHaveTextContent("我根据反馈改写了。");
  expect(screen.getByText(/Nice — tried → reused\. Next practice/)).toBeInTheDocument();
  expect(fetcher.mock.calls[2]![0]).toContain("/revisions");
  expect(JSON.parse(fetcher.mock.calls[2]![1].body)).toMatchObject({ attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, responseChinese: "我根据反馈改写了。" });
  expect(done).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "Show a natural version" })).not.toBeInTheDocument();
});
test("nonpass retains submitted response and omits absent revision", async () => {
  const failed: Completion = { ...completion(ids.first), priorState: "tried", newState: "tried", transition: null, coaching: null, evaluation: { ...completion(ids.first).evaluation, passed: false, independentUse: false, accuracy: { score: 2, englishFeedback: "Meaning needs work." } } };
  failed.reviewState = completedReviewFixture(transfer(ids.first, "第一"), failed, "这份回答需要修改。").reviewState;
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
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Your answer in Chinese");
  expect(fetcher.mock.calls[1]![0]).toContain(ids.first);
});
test("malformed or wrong-identity completion preserves answer and emits no evidence", async () => {
  const done = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), masteryEventId: undefined }, 201)).mockResolvedValueOnce(apiResponse({ ...completion(ids.first), reviewTaskId: ids.second }, 201));
  vi.stubGlobal("fetch", fetcher);
  render(<DuePractice reviewTaskId={ids.first} onCompleted={done}/>);
  await submit("这份回答要保留。");
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这份回答要保留。");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await act(async () => { });
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这份回答要保留。");
});
test("wrong transfer identity is rejected before answer controls appear", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.second, "第二"))));
  render(<DuePractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
});
