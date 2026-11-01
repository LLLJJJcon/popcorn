import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PracticeMaterialView } from "./material-schema";
import { ReviewPractice } from "./review-practice";
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("single Review reuses recorded examples, official completion and fixed Next", async () => {
  const done = vi.fn(), next = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(completion(ids.first), 201));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} mode="session" nextLabel="Finish" onNext={next} onCompleted={done}/>);
  await screen.findByRole("heading", { name: "第一" });
  fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: "这真的太夸张了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my response" }));
  await screen.findByRole("heading", { name: "Feedback" });
  expect(done).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetcher.mock.calls[1]![1].body))).toEqual({ responseChinese: "这真的太夸张了。" });
  expect(screen.queryByText("Stop for now")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  expect(next).toHaveBeenCalledOnce();
});
test("Review provider failure retains unsent text and retry, standalone returns to practice", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(Response.json({ ok: false, requestId: "x", error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true } }, { status: 503 })).mockResolvedValueOnce(apiResponse(completion(ids.first), 201));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("heading", { name: "第一" });
  fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: "这真的太夸张了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my response" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your Chinese response")).toHaveValue("这真的太夸张了。");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.getByRole("link", { name: "Back to Today's practice" })).toHaveAttribute("href", "/practice");
});
test("slow Review preparation preserves the request and gateway setup is explicit", async () => {
  vi.useFakeTimers();
  let resolve!: (r: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(r => {
    resolve = r;
  }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await act(async () => { });
  await act(async () => {
    vi.advanceTimersByTime(8000);
  });
  expect(screen.getByText(/configured model is still working/)).toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
  await act(async () => {
    resolve(Response.json({ ok: false, requestId: "x", error: { code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED", message: "Connect", retryable: false } }, { status: 409 }));
  });
  expect(screen.getByText("Connect a model to continue.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Set up model gateway" })).toHaveAttribute("href", "/settings/model-gateway");
});
test.each(["get", "post"] as const)("standalone Review %s conflict keeps original error and retry behavior", async (stage) => {
  const onUnavailable = vi.fn(async () => true);
  const code = stage === "get" ? "FORBIDDEN" : "CONFLICT", status = stage === "get" ? 404 : 409;
  const rejected = Response.json({ ok: false, requestId: "fixture", error: { code, message: "The review changed", retryable: false } }, { status });
  const fetcher = stage === "get" ? vi.fn().mockResolvedValueOnce(rejected) : vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(rejected);
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} onUnavailable={onUnavailable}/>);
  if (stage === "post") {
    await screen.findByLabelText("Your Chinese response");
    fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: "保留这份原始回答。" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my response" }));
  }
  await screen.findByRole("alert");
  expect(onUnavailable).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  if (stage === "post")
    expect(screen.getByLabelText("Your Chinese response")).toHaveValue("保留这份原始回答。");
});
