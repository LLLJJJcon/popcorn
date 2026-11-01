import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import type { ReviewPractice } from "./review-practice";
import { completedReviewFixture, reviewTransferFixture } from "./review-fixtures.test-support";
import type { Completion } from "@/contracts/review-practice";
import type { TodayPracticeItem } from "@/contracts/today-practice";
import type { PracticeSession } from "./practice-session";
import type { PracticeMaterialView } from "./material-schema";
import type { TodayCandidateItem } from "@/contracts/today-practice";
import { TodaySession } from "./today-session";
import { readSession } from "./session-storage";
const captured = vi.hoisted(() => ({ props: [] as ComponentProps<typeof PracticeSession>[], push: vi.fn(), reviewProps: [] as ComponentProps<typeof ReviewPractice>[] }));
vi.mock("./practice-session", async (original) => {
  const actual = await original<typeof import("./practice-session")>();
  return { ...actual, PracticeSession: (props: ComponentProps<typeof PracticeSession>) => {
      captured.props.push(props);
      return <actual.PracticeSession {...props}/>;
    } };
});
vi.mock("./review-practice", async (original) => {
  const actual = await original<typeof import("./review-practice")>();
  return { ...actual, ReviewPractice: (props: ComponentProps<typeof ReviewPractice>) => {
      captured.reviewProps.push(props);
      return <actual.ReviewPractice {...props}/>;
    } };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: captured.push }) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const candidate = (n: number): TodayCandidateItem => ({ id: id(n), kind: "new", expression: `表达${n + 200}`, meaningHere: "A useful expression", mastery: null, dueAt: null, overdueDays: 0, roundNumber: 1, sourceVideoTitle: "Daily Mandarin", sourceId: id(900), selection: { savedItemId: id(n + 100), candidateArtifactId: id(800), candidateIndex: n }, currentTaskId: id(n + 200), roundStatus: "open" });
const material = (n: number): PracticeMaterialView => ({ task: { id: id(n), userExpressionId: id(50), kind: "use_it_now", nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: `表达${n}`, promptChinese: "朋友告诉你价格。你怎么想？", instructionsEnglish: "Tell your friend what you think.", goalEnglish: "Use the expression naturally.", dueAt: null, createdAt: "2026-11-01T00:00:00.000Z" }, masteryState: null, roundState: { roundNumber: 1, status: "open", firstAnswer: null, latestRevision: null, examplesOpened: false, promotion: null, retryDueAt: null }, source: { videoTitle: "Daily Mandarin", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "这个价格太离谱了。", startSeconds: 0 }, expression: { englishMeaning: "A useful expression", englishExplanation: "Use it naturally.", tone: "Casual", communicativeFunction: "React", register: "Informal" } });
const evaluation = { passed: false, independentUse: false, assistanceLevel: "none" as const, accuracy: { score: 2, englishFeedback: "Meaning needs work." }, naturalness: { score: 2, englishFeedback: "Word order needs work." }, contextualFit: { score: 2, englishFeedback: "Context needs work." } };
const failed = { ...material(201).roundState!, status: "retry_scheduled" as const, firstAnswer: { attemptId: id(800), revision: 1, text: "这个表达201太离谱了。", evaluation, naturalVersion: null }, retryDueAt: "2026-11-02T00:00:00.000Z" };
const answer = { attempt: { id: id(800), userId: id(999), practiceTaskId: id(201), userExpressionId: id(50), responseChinese: failed.firstAnswer.text, evaluation, submittedAt: "2026-11-01T00:00:00.000Z", createdAt: "2026-11-01T00:00:00.000Z" }, coaching: null, roundState: failed };
const summary = { reviewCount: 0, secondTryCount: 0, newCount: 2, estimatedMinutes: 4, needsAnalysisCount: 0, processingCount: 0, nextPracticeAt: null };
const ok = (data: unknown) => Response.json({ ok: true, data, requestId: "fixture" });
afterEach(() => {
  cleanup();
  captured.props = [];
  captured.reviewProps = [];
  captured.push.mockReset();
  sessionStorage.clear();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(deferred: "round" | "answer") {
  let queue = [candidate(1), candidate(2)];
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>(r => {
    resolve = r;
  });
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/today"))
      return ok({ summary, items: queue });
    if (url.endsWith("/today/next")) {
      const body = JSON.parse(String(options?.body));
      const eligible = queue.filter(i => !body.exclude.includes(i.id));
      return ok({ summary, item: eligible[0] ?? null, remainingCount: eligible.length, resumed: false });
    }
    if (url.endsWith("/rounds"))
      return deferred === "round" ? promise : ok({ taskId: id(600), roundNumber: 2 });
    if (url.endsWith("/attempts"))
      return deferred === "answer" ? promise : ok(answer);
    return ok(material(Number(url.split("/").at(-1)?.slice(-3))));
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, resolve: (value: Response) => resolve(value), advance: () => {
      queue = [candidate(2)];
    } };
}
async function typeAnswer() {
  await screen.findByRole("heading", { name: "表达201" });
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: failed.firstAnswer.text } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
}
test("real deferred new-round response cannot corrupt B after a queued Next", async () => {
  const request = setup("round");
  render(<main><TodaySession userId={id(999)}/></main>);
  await typeAnswer();
  await screen.findByRole("heading", { name: "Feedback" });
  const origin = captured.props.at(-1)!;
  fireEvent.click(screen.getByRole("button", { name: "Try a new situation" }));
  expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  request.advance();
  await act(async () => {
    origin.onNext?.();
  });
  await screen.findByRole("heading", { name: "表达202" });
  await act(async () => {
    request.resolve(ok({ taskId: id(600), roundNumber: 2 }));
    origin.onRoundCreated?.(id(600));
    origin.onNext?.();
  });
  expect(screen.getByRole("heading", { name: "表达202" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "表达600" })).not.toBeInTheDocument();
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
  expect(readSession(id(999)).results.map(r => r.id)).toEqual([id(1)]);
});
test("real late answer for A cannot record a result or navigation hint for current B", async () => {
  const request = setup("answer");
  render(<main><TodaySession userId={id(999)}/></main>);
  await screen.findByRole("heading", { name: "表达201" });
  const origin = captured.props.at(-1)!;
  await typeAnswer();
  request.advance();
  await act(async () => {
    origin.onNext?.();
  });
  await screen.findByRole("heading", { name: "表达202" });
  await act(async () => {
    request.resolve(ok(answer));
    origin.onCompleted?.(failed);
  });
  expect(screen.getByRole("heading", { name: "表达202" })).toBeInTheDocument();
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
  expect(readSession(id(999)).results.some(r => r.id === id(2))).toBe(false);
});
const promotedConflict = () => Response.json({ ok: false, requestId: "fixture", error: { code: "ALREADY_PROMOTED", message: "Already in your Vault", retryable: false, details: { userExpressionId: id(50) } } }, { status: 409 });
test("activation redirect from another tab stays in the session and freshly selects B", async () => {
  let queue: TodayCandidateItem[] = [{ ...candidate(1), currentTaskId: null, roundStatus: null, roundNumber: null }, candidate(2)];
  let resolve!: (r: Response) => void;
  const pending = new Promise<Response>(r => {
    resolve = r;
  });
  const bodies: unknown[] = [];
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/today"))
      return ok({ summary, items: queue });
    if (url.endsWith("/today/next")) {
      const body = JSON.parse(String(options?.body));
      bodies.push(body);
      return ok({ summary, item: queue[0] ?? null, remainingCount: queue.length, resumed: false });
    }
    if (url.endsWith("/practice/tasks"))
      return pending;
    return ok(material(202));
  });
  vi.stubGlobal("fetch", fetcher);
  render(<main><TodaySession userId={id(999)}/></main>);
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url.endsWith("/practice/tasks"))).toBe(true));
  queue = [candidate(2)];
  await act(async () => {
    resolve(ok({ redirect: `/vault/${id(50)}` }));
  });
  await screen.findByRole("heading", { name: "表达202" });
  expect(captured.push).not.toHaveBeenCalled();
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).not.toHaveProperty("currentTaskId");
});
test("real ALREADY_PROMOTED first-answer response continues B without adding external evidence", async () => {
  const request = setup("answer");
  render(<main><TodaySession userId={id(999)}/></main>);
  await typeAnswer();
  request.advance();
  await act(async () => {
    request.resolve(promotedConflict());
  });
  await screen.findByRole("heading", { name: "表达202" });
  expect(captured.push).not.toHaveBeenCalled();
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
});
test("real ALREADY_PROMOTED new-round response keeps only this session's official prior answer", async () => {
  const request = setup("round");
  render(<main><TodaySession userId={id(999)}/></main>);
  await typeAnswer();
  await screen.findByRole("heading", { name: "Feedback" });
  fireEvent.click(screen.getByRole("button", { name: "Try a new situation" }));
  request.advance();
  await act(async () => {
    request.resolve(promotedConflict());
  });
  await screen.findByRole("heading", { name: "表达202" });
  expect(captured.push).not.toHaveBeenCalled();
  expect(readSession(id(999)).results).toEqual([expect.objectContaining({ id: id(1), outcome: "practice_again_tomorrow" })]);
  expect(readSession(id(999)).results.some(result => result.outcome === "added")).toBe(false);
});
test("late A promotion conflict and captured invalidation cannot advance or rewrite current B", async () => {
  const request = setup("answer");
  render(<main><TodaySession userId={id(999)}/></main>);
  await screen.findByRole("heading", { name: "表达201" });
  const origin = captured.props.at(-1)!;
  await typeAnswer();
  request.advance();
  await act(async () => {
    origin.onNext?.();
  });
  await screen.findByRole("heading", { name: "表达202" });
  const nextCalls = () => request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today/next")).length;
  expect(nextCalls()).toBe(2);
  await act(async () => {
    request.resolve(promotedConflict());
    origin.onPromotedElsewhere?.();
  });
  expect(screen.getByRole("heading", { name: "表达202" })).toBeInTheDocument();
  expect(nextCalls()).toBe(2);
  expect(captured.push).not.toHaveBeenCalled();
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
});
const reviewItem: TodayPracticeItem = { id: id(10), kind: "review", reviewTaskId: id(10), userExpressionId: id(50), expression: "表达201", meaningHere: "A useful expression", mastery: "tried", dueAt: "2026-10-01T00:00:00.000Z", overdueDays: 1, roundNumber: null, sourceVideoTitle: "Daily Mandarin", sourceId: id(900) };
const failure = (code: string, status: number) => Response.json({ ok: false, requestId: "fixture", error: { code, message: "The review changed", retryable: false } }, { status });
function setupReview(deferred: "get" | "post") {
  let queue: TodayPracticeItem[] = [reviewItem, candidate(2)];
  let resolve!: (r: Response) => void;
  const pending = new Promise<Response>(r => {
    resolve = r;
  });
  const dueMaterial: PracticeMaterialView = { ...material(201), task: { ...material(201).task, kind: "due_practice", dueAt: "2026-10-01T00:00:00.000Z" }, masteryState: "tried" };
  const transfer = reviewTransferFixture(id(10), dueMaterial);
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/today"))
      return ok({ summary, items: queue });
    if (url.endsWith("/today/next")) {
      const body = JSON.parse(String(options?.body));
      const eligible = queue.filter(i => !body.exclude.includes(i.id));
      return ok({ summary, item: eligible[0] ?? null, remainingCount: eligible.length, resumed: false });
    }
    if (url.split("?")[0]!.endsWith(`/due/${id(10)}`)) {
      if (options?.method === "POST")
        return pending;
      return deferred === "get" ? pending : ok(transfer);
    }
    return ok(material(202));
  });
  vi.stubGlobal("fetch", fetcher);
  return { fetcher, transfer, resolve: (value: Response) => resolve(value), advance: () => {
      queue = [candidate(2)];
    } };
}
async function submitReview() {
  await screen.findByLabelText("Your answer in Chinese");
  fireEvent.change(screen.getByLabelText("Your answer in Chinese"), { target: { value: "这是我为复习写的原始回答。" } });
  fireEvent.click(screen.getByRole("button", { name: "Check my answer" }));
}
test("real Review GET404 advances only after fresh today confirms another tab completed it", async () => {
  const request = setupReview("get");
  render(<main><TodaySession userId={id(999)}/></main>);
  await waitFor(() => expect(request.fetcher.mock.calls.some(([url]) => url.split("?")[0]!.endsWith(`/due/${id(10)}`))).toBe(true));
  request.advance();
  await act(async () => {
    request.resolve(failure("FORBIDDEN", 404));
  });
  await screen.findByRole("heading", { name: "表达202" });
  expect(readSession(id(999)).results).toEqual([]);
  expect(captured.push).not.toHaveBeenCalled();
  expect(request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today"))).toHaveLength(3);
});
test("real Review POST409 continues B after fresh today confirms completed review", async () => {
  const request = setupReview("post");
  render(<main><TodaySession userId={id(999)}/></main>);
  await submitReview();
  request.advance();
  await act(async () => {
    request.resolve(failure("CONFLICT", 409));
  });
  await screen.findByRole("heading", { name: "表达202" });
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
  expect(captured.push).not.toHaveBeenCalled();
});
test.each(["CONFLICT", "PROVIDER_UNAVAILABLE"])("Review %s while still eligible retains its text and retry", async (code) => {
  const request = setupReview("post");
  render(<main><TodaySession userId={id(999)}/></main>);
  await submitReview();
  await act(async () => {
    request.resolve(failure(code, code === "CONFLICT" ? 409 : 503));
  });
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Your answer in Chinese")).toHaveValue("这是我为复习写的原始回答。");
  expect(screen.getByRole("heading", { name: "▢▢▢▢▢" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "表达202" })).not.toBeInTheDocument();
  expect(readSession(id(999)).results).toEqual([]);
  expect(request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today"))).toHaveLength(code === "CONFLICT" ? 2 : 1);
});
test("Review GET404 still eligible preserves the item and explicit retry", async () => {
  const request = setupReview("get");
  render(<main><TodaySession userId={id(999)}/></main>);
  await waitFor(() => expect(request.fetcher.mock.calls.some(([url]) => url.split("?")[0]!.endsWith(`/due/${id(10)}`))).toBe(true));
  await act(async () => {
    request.resolve(failure("FORBIDDEN", 404));
  });
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "表达202" })).not.toBeInTheDocument();
  expect(request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today"))).toHaveLength(2);
  expect(readSession(id(999)).results).toEqual([]);
});
test("late Review conflict and obsolete unavailable callback cannot advance current B", async () => {
  const request = setupReview("post");
  render(<main><TodaySession userId={id(999)}/></main>);
  await screen.findByLabelText("Your answer in Chinese");
  const origin = captured.reviewProps.at(-1)!;
  await submitReview();
  request.advance();
  await act(async () => {
    origin.onNext?.();
  });
  await screen.findByRole("heading", { name: "表达202" });
  const nextCalls = () => request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today/next")).length;
  await act(async () => {
    request.resolve(failure("CONFLICT", 409));
    await origin.onUnavailable?.();
  });
  expect(screen.getByRole("heading", { name: "表达202" })).toBeInTheDocument();
  expect(nextCalls()).toBe(2);
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
});
test("same-answer Review 201 replay remains a normal official completion", async () => {
  const request = setupReview("post");
  render(<main><TodaySession userId={id(999)}/></main>);
  await submitReview();
  const replay: Completion = { reviewTaskId: id(10), practiceTaskId: id(201), attemptId: id(800), masteryEventId: id(801), nextReviewTaskId: id(802), priorState: "tried", newState: "reused", nextDueAt: "2026-11-08T00:00:00.000Z", intervalDays: 7, created: false, transition: { from: "tried", to: "reused" }, evaluation: { ...evaluation, passed: true, independentUse: true, accuracy: { score: 4, englishFeedback: "Accurate." }, naturalness: { score: 4, englishFeedback: "Natural." }, contextualFit: { score: 4, englishFeedback: "Fits." } }, coaching: null };
  replay.reviewState = completedReviewFixture(request.transfer, replay, "这是我为复习写的原始回答。").reviewState;
  await act(async () => {
    request.resolve(ok(replay));
  });
  await screen.findByRole("heading", { name: "Feedback" });
  expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  expect(readSession(id(999)).results).toEqual([expect.objectContaining({ id: id(10), kind: "review", outcome: "moved_up" })]);
  expect(request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today/next"))).toHaveLength(1);
  expect(captured.push).not.toHaveBeenCalled();
});
test("late fresh-review confirmation cannot advance B after a queued item change", async () => {
  const request = setupReview("post");
  const original = request.fetcher.getMockImplementation()!;
  let todayCount = 0;
  let confirm!: (r: Response) => void;
  const pending = new Promise<Response>(r => {
    confirm = r;
  });
  request.fetcher.mockImplementation(async (url, options) => {
    if (url.endsWith("/today") && ++todayCount === 2)
      return pending;
    return original(url, options);
  });
  render(<main><TodaySession userId={id(999)}/></main>);
  await screen.findByLabelText("Your answer in Chinese");
  const origin = captured.reviewProps.at(-1)!;
  await submitReview();
  await act(async () => {
    request.resolve(failure("CONFLICT", 409));
  });
  await waitFor(() => expect(todayCount).toBe(2));
  request.advance();
  await act(async () => {
    origin.onNext?.();
  });
  await screen.findByRole("heading", { name: "表达202" });
  await act(async () => {
    confirm(ok({ summary, items: [candidate(2)] }));
  });
  expect(screen.getByRole("heading", { name: "表达202" })).toBeInTheDocument();
  expect(request.fetcher.mock.calls.filter(([url]) => url.endsWith("/today/next"))).toHaveLength(2);
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(2), currentTaskId: id(202) });
});
