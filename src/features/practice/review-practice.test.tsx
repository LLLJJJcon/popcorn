import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { PracticeMaterialView } from "./material-schema";
import { completedReviewFixture, reviewTransferFixture } from "./review-fixtures.test-support";
import { ReviewPractice } from "./review-practice";
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
test("single Review reuses recorded examples, official completion and fixed Next", async () => {
  const done = vi.fn(), next = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(completion(ids.first), 201));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} mode="session" nextLabel="Finish" onNext={next} onCompleted={done}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这真的太夸张了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  await screen.findByRole("heading", { name: "Feedback" });
  expect(done).toHaveBeenCalledOnce();
  expect(JSON.parse(String(fetcher.mock.calls[1]![1].body))).toMatchObject({ responseChinese: "这真的太夸张了。", taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64) });
  expect(screen.queryByText("Stop for now")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  expect(next).toHaveBeenCalledOnce();
});
test("Review provider failure retains unsent text and retry, standalone returns to practice", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(Response.json({ ok: false, requestId: "x", error: { code: "PROVIDER_UNAVAILABLE", message: "Unavailable", retryable: true } }, { status: 503 })).mockResolvedValueOnce(apiResponse(completion(ids.first), 201));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这真的太夸张了。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这真的太夸张了。");
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
  expect(screen.getByText("Preparing a new situation…")).toBeInTheDocument();
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
    await screen.findByLabelText("Your answer in Chinese");
    fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "保留这份原始回答。" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  }
  await screen.findByRole("alert");
  expect(onUnavailable).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  if (stage === "post")
    expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("保留这份原始回答。");
});

// Catches a hidden answer leaking through header, context, About or source labels.
test("Review keeps the target out of visible and accessible text before explicit reveal", async () => {
  const item = transfer(ids.first, "第一");
  item.material.expression.englishMeaning = "Use 第一 to identify the first option.";
  item.material.expression.englishExplanation = "第一 fits an ordered choice.";
  item.material.expression.tone = "第一 is neutral";
  item.material.expression.register = "Use 第一 in everyday speech";
  item.material.source.videoTitle = "Learn 第一 in context";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(item)));
  const view = render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.click(screen.getByRole("button", { name: "About this expression" }));
  expect(view.container.textContent).not.toContain("第一");
  for (const element of view.container.querySelectorAll("[title],[aria-label],[aria-description],[aria-describedby]")) {
    for (const name of ["title", "aria-label", "aria-description", "aria-describedby"])
      expect(element.getAttribute(name) ?? "").not.toContain("第一");
  }
  expect(screen.getByRole("button", { name: "Show the expression" })).toBeEnabled();
});

test("reveal and examples persist the exact scenario before displaying the expression", async () => {
  const item = transfer(ids.first, "第一");
  let release!: (value: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.click(screen.getByRole("button", { name: "Show the expression" }));
  expect(screen.queryByRole("heading", { name: "第一" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Check my answer" })).toBeDisabled();
  const body = JSON.parse(String(fetcher.mock.calls[1]![1].body));
  expect(body).toMatchObject({ taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64) });
  expect(body.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(body).not.toHaveProperty("assistanceLevel");
  await act(async () => { release(apiResponse({ reviewState: { ...item.reviewState, expressionRevealedAt: "2026-11-01T00:00:00.000Z" } })); });
  expect(screen.getByRole("heading", { name: "第一" })).toBeInTheDocument();
});

test("failed regeneration retains question, draft and allowance and retries unknown outcome with one request id", async () => {
  const item = transfer(ids.first, "第一");
  const regenerated = reviewTransferFixture(ids.first, { ...item.material, task: { ...item.material.task, promptChinese: "朋友想改变计划，请你回应。" } }, 2);
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockRejectedValueOnce(Error("Network outcome unknown")).mockResolvedValueOnce(apiResponse(regenerated));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "保留我还没发出的文字。" } });
  fireEvent.click(screen.getByRole("button", { name: "Try a different situation" }));
  await screen.findByRole("alert");
  expect(screen.getByText(item.promptChinese)).toBeInTheDocument();
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("保留我还没发出的文字。");
  expect(screen.getByRole("button", { name: "Try a different situation" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("朋友想改变计划，请你回应。");
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).requestId).toBe(JSON.parse(fetcher.mock.calls[2]![1].body).requestId);
  expect(screen.queryByRole("button", { name: "Try a different situation" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("");
  const oldKey = `popcorn:due-answer:${ids.first}:${ids.first}:1:${"a".repeat(64)}`;
  expect(localStorage.getItem(oldKey)).toBe("保留我还没发出的文字。");
});

test("restored official first and latest revision render without completing this session again", async () => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "第一份正式回答。");
  item.reviewState.latestRevision = { id: ids.third, requestId: ids.second, attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), responseChinese: "这是最新修订。", evaluation: { ...completion(ids.first).evaluation, naturalness: { score: 5, englishFeedback: "Fully natural." } }, coaching: null, naturalVersion: null, createdAt: "2026-11-01T01:00:00.000Z" };
  const done = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} mode="session" onCompleted={done}/>);
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.getByRole("heading", { name: "Your first answer" }).parentElement).toHaveTextContent("第一份正式回答。");
  expect(screen.getByRole("heading", { name: "Your revision" }).parentElement).toHaveTextContent("这是最新修订。");
  expect(screen.getByText("Naturalness 4 → 5")).toBeInTheDocument();
  expect(screen.getByText(/Nice — tried → reused\. Next practice/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "First feedback" })).toBeInTheDocument();
  expect(done).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledOnce();
});

test("preparing GET polls the same operation and shows exact slow preparation status", async () => {
  vi.useFakeTimers();
  const pending = { status: "preparing", reviewTaskId: ids.first, requestId: ids.second, retryAfterMs: 1000 };
  const fetcher = vi.fn().mockImplementation(async () => apiResponse(pending));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await act(async () => {});
  for (let n = 0; n < 8; n++) await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByText("Preparing a new situation…")).toBeInTheDocument();
  expect(String(fetcher.mock.calls[1]![0])).toContain(`retryRequestId=${ids.second}`);
  expect(fetcher.mock.calls[1]![1].headers).toMatchObject({ "X-Popcorn-Review-Retry": "1" });
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
});

test("unknown preparation network outcome retries the same id, known failure starts a new deliberate cycle", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(Error("Unknown outcome")).mockImplementationOnce(async () => {
    return Response.json({ ok: false, requestId: "fixture", error: { code: "PROVIDER_UNAVAILABLE", message: "Fixture failed", retryable: true, details: { operation: { kind: "prepare", requestId: ids.second, state: "failed" } } } }, { status: 503 });
  }).mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByRole("alert");
  const idAt = (index: number) => new URL(String(fetcher.mock.calls[index]![0]), "http://fixture.test").searchParams.get("retryRequestId");
  expect(idAt(0)).toBeNull();
  expect(idAt(1)).toBe(idAt(0));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Your answer in Chinese");
  expect(idAt(2)).toMatch(/^[a-f0-9-]{36}$/);
  expect(idAt(2)).not.toBe(ids.second);
});

test("scenario conflict refreshes in place and never retries an old answer on the replacement question", async () => {
  const item = transfer(ids.first, "第一");
  const current = reviewTransferFixture(ids.first, { ...item.material, task: { ...item.material.task, promptChinese: "现在朋友想换个话题，请你回应。" } }, 2);
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockResolvedValueOnce(Response.json({ ok: false, requestId: "fixture", error: { code: "SCENARIO_CHANGED", message: "Scenario changed", retryable: false, details: { current } } }, { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这是上一题的回答。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  await screen.findByText("现在朋友想换个话题，请你回应。");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("");
  expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  expect(localStorage.getItem(`popcorn:due-answer:${ids.first}:${ids.first}:1:${"a".repeat(64)}`)).toBe("这是上一题的回答。");
  expect(fetcher).toHaveBeenCalledTimes(2);
});

test("gateway preparation failure exposes deliberate retry after setup without automatic model cycles", async () => {
  const fetcher = vi.fn().mockImplementationOnce(async () => {
    return Response.json({ ok: false, requestId: "fixture", error: { code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED", message: "Connect", retryable: false, details: { operation: { kind: "prepare", requestId: ids.second, state: "failed" } } } }, { status: 409 });
  }).mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("link", { name: "Set up model gateway" });
  expect(fetcher).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Your answer in Chinese");
  expect(fetcher.mock.calls[1]![0]).not.toBe(fetcher.mock.calls[0]![0]);
});

test("failed preparation reload reads its old cycle and only explicit retry supplies a fresh id", async () => {
  const failed = () => Response.json({ ok: false, requestId: "fixture", error: { code: "PROVIDER_UNAVAILABLE", message: "Failed", retryable: true, details: { operation: { kind: "prepare", requestId: ids.second, state: "failed" } } } }, { status: 503 });
  const fetcher = vi.fn().mockImplementationOnce(async () => failed()).mockImplementationOnce(async () => failed()).mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  view.unmount();
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  const resumed = new URL(String(fetcher.mock.calls[1]![0]), "http://fixture.test").searchParams.get("retryRequestId");
  expect(resumed === null || resumed === ids.second).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByLabelText("Your answer in Chinese");
  const newId = new URL(String(fetcher.mock.calls[2]![0]), "http://fixture.test").searchParams.get("retryRequestId");
  expect(newId).toMatch(/^[a-f0-9-]{36}$/);
  expect(newId).not.toBe(ids.second);
});

test("gateway setup return can load with plain GET after a preclaim configuration failure", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ ok: false, requestId: "fixture", error: { code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED", message: "Connect", retryable: false } }, { status: 409 })).mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一")));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("link", { name: "Set up model gateway" });
  view.unmount();
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  expect(fetcher.mock.calls[0]![0]).toBe(`/api/v1/practice/due/${ids.first}`);
  expect(fetcher.mock.calls[1]![0]).toBe(`/api/v1/practice/due/${ids.first}`);
});

test("uncertain revision survives reload and retries its one action id without re-completing the review", async () => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这是第一份回答。");
  const done = vi.fn();
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockRejectedValueOnce(Error("Unknown revision outcome")).mockResolvedValueOnce(apiResponse(item)).mockImplementationOnce(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    const revision = { id: ids.third, requestId: body.requestId, attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), responseChinese: body.responseChinese, evaluation: completion(ids.first).evaluation, coaching: null, naturalVersion: null, createdAt: "2026-11-01T01:00:00.000Z" };
    return apiResponse({ revision, reviewState: { ...item.reviewState, latestRevision: revision } });
  });
  vi.stubGlobal("fetch", fetcher);
  const view = render(<ReviewPractice reviewTaskId={ids.first} onCompleted={done}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Revise this answer" }));
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这是要保留的修订。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my revision" }));
  await screen.findByRole("alert");
  view.unmount();
  render(<ReviewPractice reviewTaskId={ids.first} onCompleted={done}/>);
  await screen.findByRole("button", { name: "Check my revision" });
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这是要保留的修订。");
  fireEvent.click(screen.getByRole("button", { name: "Check my revision" }));
  await screen.findByRole("heading", { name: "Your revision" });
  expect(JSON.parse(fetcher.mock.calls[1]![1].body).requestId).toBe(JSON.parse(fetcher.mock.calls[3]![1].body).requestId);
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByText(/Nice — tried → reused\. Next practice/)).toBeInTheDocument();
});

test("regeneration in progress retries the same POST, blocks conflicting actions and retains revealed examples", async () => {
  vi.useFakeTimers();
  const item = transfer(ids.first, "第一");
  item.reviewState.expressionRevealedAt = "2026-11-01T00:00:00.000Z";
  item.reviewState.examplesOpenedAt = "2026-11-01T00:00:00.000Z";
  item.expressionRevealed = true;
  const next = reviewTransferFixture(ids.first, { ...item.material, task: { ...item.material.task, promptChinese: "新情境里的朋友需要你的回应。" } }, 2);
  next.reviewState.expressionRevealedAt = item.reviewState.expressionRevealedAt; next.reviewState.examplesOpenedAt = item.reviewState.examplesOpenedAt; next.expressionRevealed = true;
  let release!: (response: Response) => void;
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockImplementationOnce(async (_url: string, options: RequestInit) => Response.json({ ok: false, requestId: "fixture", error: { code: "REQUEST_IN_PROGRESS", message: "Pending", retryable: true, details: { operation: { kind: "regenerate", requestId: JSON.parse(String(options.body)).requestId, state: "in_progress" } } } }, { status: 409 })).mockImplementationOnce(() => new Promise<Response>(resolve => { release = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Try a different situation" }));
  await act(async () => {});
  await act(async () => { vi.advanceTimersByTime(1000); });
  expect(screen.getByLabelText("Your answer in Chinese")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Check my answer" })).toBeDisabled();
  expect(fetcher.mock.calls[1]![0]).toBe(fetcher.mock.calls[2]![0]);
  expect(fetcher.mock.calls[1]![1].body).toBe(fetcher.mock.calls[2]![1].body);
  await act(async () => { vi.advanceTimersByTime(7000); });
  expect(screen.getByText("Preparing a new situation…")).toBeInTheDocument();
  await act(async () => { release(apiResponse(next)); });
  expect(screen.getByRole("heading", { name: "第一" })).toBeInTheDocument();
  expect(screen.getByText("原来的第一例句。")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Try a different situation" })).not.toBeInTheDocument();
});

test("opening persisted examples while editing a revision preserves the unsent revision", async () => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这是正式首答。");
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockResolvedValueOnce(apiResponse({ reviewState: { ...item.reviewState, expressionRevealedAt: "2026-11-01T01:00:00.000Z", examplesOpenedAt: "2026-11-01T01:00:00.000Z" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Revise this answer" }));
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这份修订还没有提交。" } });
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await screen.findByText("原来的第一例句。");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这份修订还没有提交。");
});

test("inconsistent task text is rejected before an answer can be graded against another question", async () => {
  const item = transfer(ids.first, "第一");
  item.promptChinese = "这是另一道题，请你回应。";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(item)));
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("alert");
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
});

test("current completion HTTP must return official state rather than rebuilding it from local text", async () => {
  const flat = { ...completion(ids.first) };
  delete flat.reviewState;
  const done = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(apiResponse(flat, 201)));
  render(<ReviewPractice reviewTaskId={ids.first} onCompleted={done}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这份本地文字不能代替服务端首答。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  await screen.findByRole("alert");
  expect(done).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这份本地文字不能代替服务端首答。");
});

test("an official first answer restored after a lost success response opens its feedback", async () => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这份首答已经成功保存。");
  localStorage.setItem(`popcorn:due-answer:${ids.first}:${ids.first}:1:${"a".repeat(64)}`, "这份首答已经成功保存。");
  const done = vi.fn();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(item)));
  render(<ReviewPractice reviewTaskId={ids.first} onCompleted={done}/>);
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
  expect(done).not.toHaveBeenCalled();
});

test("a foreign current-question conflict is rejected without losing the owned draft", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(transfer(ids.first, "第一"))).mockResolvedValueOnce(Response.json({ ok: false, requestId: "fixture", error: { code: "SCENARIO_CHANGED", message: "Changed", retryable: false, details: { current: transfer(ids.second, "第二") } } }, { status: 409 }));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "请保留这份属于当前题目的回答。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("请保留这份属于当前题目的回答。");
  expect(screen.queryByText("Second")).not.toBeInTheDocument();
});

test("a successful marker envelope without persisted markers cannot reveal the target", async () => {
  const item = transfer(ids.first, "第一");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(item)).mockResolvedValueOnce(apiResponse({ reviewState: item.reviewState })));
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await screen.findByText("Examples couldn't open. Try again.");
  expect(screen.queryByRole("heading", { name: "第一" })).not.toBeInTheDocument();
  expect(screen.queryByText("原来的第一例句。")).not.toBeInTheDocument();
});

test("regeneration cannot erase markers for examples the learner has already seen", async () => {
  const item = transfer(ids.first, "第一");
  item.reviewState.expressionRevealedAt = "2026-11-01T00:00:00.000Z"; item.reviewState.examplesOpenedAt = "2026-11-01T00:00:00.000Z"; item.expressionRevealed = true;
  const bad = reviewTransferFixture(ids.first, { ...item.material, task: { ...item.material.task, promptChinese: "错误响应里的新题。" } }, 2);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(item)).mockResolvedValueOnce(apiResponse(bad)));
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.click(screen.getByRole("button", { name: "Try a different situation" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("heading", { name: "第一" })).toBeInTheDocument();
  expect(screen.getByText("原来的第一例句。")).toBeInTheDocument();
  expect(screen.queryByText("错误响应里的新题。")).not.toBeInTheDocument();
});

test("an old unsent draft restores only into the retained legacy first question and keeps its old key", async () => {
  const oldKey = `popcorn:answer:review:${ids.first}`;
  localStorage.setItem(oldKey, "这是升级之前还没有发出的回答。");
  const first = transfer(ids.first, "第一");
  const next = reviewTransferFixture(ids.first, { ...first.material, task: { ...first.material.task, promptChinese: "这是换过情境之后的问题。" } }, 2);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(apiResponse(first)).mockResolvedValueOnce(apiResponse(next)));
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByLabelText("Your answer in Chinese");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这是升级之前还没有发出的回答。");
  fireEvent.click(screen.getByRole("button", { name: "Try a different situation" }));
  await screen.findByText("这是换过情境之后的问题。");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("");
  expect(localStorage.getItem(oldKey)).toBe("这是升级之前还没有发出的回答。");
});

test.each(["restored", "submitted"] as const)("%s official Review hides the pre-answer assistance notice before and after late examples", async stage => {
  const unopened = transfer(ids.first, "第一");
  const official = completion(ids.first, "第一份正式回答。");
  const completed = completedReviewFixture(unopened, official, "第一份正式回答。");
  const markers = { reviewState: { ...completed.reviewState, expressionRevealedAt: "2026-11-01T01:00:00.000Z", examplesOpenedAt: "2026-11-01T01:00:00.000Z" } };
  const fetcher = stage === "restored"
    ? vi.fn().mockResolvedValueOnce(apiResponse(completed)).mockResolvedValueOnce(apiResponse(markers))
    : vi.fn().mockResolvedValueOnce(apiResponse(unopened)).mockResolvedValueOnce(apiResponse(official, 201)).mockResolvedValueOnce(apiResponse(markers));
  const done = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} onCompleted={done}/>);
  const notice = "Seeing an example helps, but this review won't move your progress.";
  if (stage === "submitted") {
    await screen.findByLabelText("Your answer in Chinese");
    expect(screen.getByText(notice)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "第一份正式回答。" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
  }
  await screen.findByRole("heading", { name: "Feedback" });
  const result = screen.getByText(/Nice — tried → reused\. Next practice/).textContent;
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await screen.findByText("原来的第一例句。");
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  expect(screen.getByText(/Nice — tried → reused\. Next practice/)).toHaveTextContent(result!);
  expect(screen.getByText("第一份正式回答。")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Naturalness · 4/5" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Revise this answer" }));
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("第一份正式回答。");
  expect(screen.queryByText(notice)).not.toBeInTheDocument();
  expect(done).toHaveBeenCalledTimes(stage === "submitted" ? 1 : 0);
  expect(fetcher).toHaveBeenCalledTimes(stage === "submitted" ? 3 : 2);
});

test.each(["standalone", "session"] as const)("read-only completed Review preserves first/latest history and %s navigation without revision actions", async mode => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这是保留的正式首答。");
  item.reviewState.canRevise = false;
  item.reviewState.latestRevision = { id: ids.third, requestId: ids.second, attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), responseChinese: "这是已经保存的最新修订。", evaluation: { ...completion(ids.first).evaluation, naturalness: { score: 5, englishFeedback: "This saved revision sounds fully natural." } }, coaching: null, naturalVersion: null, createdAt: "2026-11-01T01:00:00.000Z" };
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)), next = vi.fn(), done = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first} mode={mode} onNext={next} onCompleted={done}/>);
  await screen.findByRole("heading", { name: "Your revision" });
  expect(screen.getByRole("heading", { name: "Your first answer" }).parentElement).toHaveTextContent("这是保留的正式首答。");
  expect(screen.getByRole("heading", { name: "Your revision" }).parentElement).toHaveTextContent("这是已经保存的最新修订。");
  expect(screen.getByText("This saved revision sounds fully natural.")).toBeInTheDocument();
  expect(screen.getByText(/Nice — tried → reused\. Next practice/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Revise this answer" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Check my revision" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "First feedback" }));
  expect(screen.getByRole("heading", { name: "Naturalness · 4/5" }).parentElement).toHaveTextContent("It sounds natural in conversation.");
  if (mode === "session") { fireEvent.click(screen.getByRole("button", { name: "Next" })); expect(next).toHaveBeenCalledOnce(); }
  else expect(screen.getByRole("link", { name: "Back to Today's practice" })).toHaveAttribute("href", "/practice");
  expect(done).not.toHaveBeenCalled();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0]![0]).toBe(`/api/v1/practice/due/${ids.first}`);
});

test.each(["这是尚未提交的修订草稿。", "这是已保存的正式首答。"])("read-only Review cannot restore an editable draft and retains its original stored value %#", async draft => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这是已保存的正式首答。");
  item.reviewState.canRevise = false;
  const key = `popcorn:due-answer:${ids.first}:${ids.first}:1:${"a".repeat(64)}`;
  localStorage.setItem(key, draft);
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item));
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.getByText("这是已保存的正式首答。")).toBeInTheDocument();
  expect(screen.queryByLabelText("Your answer in Chinese")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Revise this answer" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Check my revision" })).not.toBeInTheDocument();
  expect(localStorage.getItem(key)).toBe(draft);
  expect(fetcher).toHaveBeenCalledOnce();
});

test.each([undefined, true])("active or older Review capability %s keeps the existing revision form", async canRevise => {
  const item = completedReviewFixture(transfer(ids.first, "第一"), completion(ids.first), "这是仍可修订的首答。");
  if (canRevise !== undefined) item.reviewState.canRevise = canRevise;
  const fetcher = vi.fn().mockResolvedValueOnce(apiResponse(item)).mockImplementationOnce(async (_url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body));
    const revision = { id: ids.third, requestId: body.requestId, attemptId: ids.fourth, taskId: ids.first, scenarioVersion: 1, scenarioFingerprint: "a".repeat(64), responseChinese: body.responseChinese, evaluation: completion(ids.first).evaluation, coaching: null, naturalVersion: null, createdAt: "2026-11-01T01:00:00.000Z" };
    return apiResponse({ revision, reviewState: { ...item.reviewState, latestRevision: revision } });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ReviewPractice reviewTaskId={ids.first}/>);
  fireEvent.click(await screen.findByRole("button", { name: "Revise this answer" }));
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这是仍可修订的首答。");
  expect(screen.getByRole("button", { name: "Check my revision" })).toBeEnabled();
  expect(fetcher).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这是可以正常提交的修订。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my revision" }));
  await screen.findByRole("heading", { name: "Your revision" });
  expect(screen.getByRole("heading", { name: "Your revision" }).parentElement).toHaveTextContent("这是可以正常提交的修订。");
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[1]![0]).toBe(`/api/v1/practice/due/${ids.first}/revisions`);
});
