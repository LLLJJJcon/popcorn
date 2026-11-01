import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { TodayPracticeItem, TodayCandidateItem, TodayNextInput } from "@/contracts/today-practice";
import type { PracticeSession } from "./practice-session";
import type { ReviewPractice } from "./review-practice";
import type { ComponentProps } from "react";
import { TodaySession } from "./today-session";
import { writeSession, readSession } from "./session-storage";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./practice-session", () => ({ PracticeSession: ({ material, onNext, nextLabel, onCompleted, onRoundCreated, onRemoved }: ComponentProps<typeof PracticeSession>) => <div><h2>{material.task.targetExpression}</h2><button onClick={() => onCompleted?.({ roundNumber: 1, status: "retry_scheduled", examplesOpened: false, firstAnswer: { attemptId: id(800), revision: 1, text: "这个价格太离谱了。", evaluation: { passed: false, independentUse: false, assistanceLevel: "none", accuracy: { score: 2, englishFeedback: "Try again." }, naturalness: { score: 2, englishFeedback: "Try again." }, contextualFit: { score: 2, englishFeedback: "Try again." } }, naturalVersion: null }, latestRevision: null, promotion: null, retryDueAt: "2026-11-02T00:00:00.000Z" })}>Complete first answer</button><button onClick={() => onRoundCreated?.(id(600))}>Try a new situation</button><button onClick={() => onRemoved?.({ taskId: material.task.id, undoUntil: new Date(Date.now() + 5000).toISOString(), roundState: { ...material.roundState!, status: "removed" } })}>Remove from practice</button><button onClick={onNext}>{nextLabel}</button></div> }));
vi.mock("./review-practice", () => ({ ReviewPractice: ({ reviewTaskId, onNext, nextLabel, onCompleted }: ComponentProps<typeof ReviewPractice>) => <div><h2>Review {reviewTaskId}</h2><button onClick={() => onCompleted?.({ reviewTaskId, practiceTaskId: reviewTaskId, attemptId: id(800), masteryEventId: id(801), nextReviewTaskId: id(802), priorState: "owned", newState: "owned", evaluation: { passed: true, independentUse: true, assistanceLevel: "none", accuracy: { score: 4, englishFeedback: "Good." }, naturalness: { score: 4, englishFeedback: "Good." }, contextualFit: { score: 4, englishFeedback: "Good." } }, nextDueAt: "2026-12-01T00:00:00.000Z", intervalDays: 30, created: true, transition: null, coaching: null })}>Complete review</button><button onClick={onNext}>{nextLabel}</button></div> }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const summary = { reviewCount: 0, secondTryCount: 0, newCount: 2, estimatedMinutes: 4, needsAnalysisCount: 0, processingCount: 0, nextPracticeAt: null };
const candidate = (n: number): TodayCandidateItem => ({ id: id(n), kind: "new", expression: `表达${n}`, meaningHere: "A useful expression", mastery: null, dueAt: null, overdueDays: 0, roundNumber: 1, sourceVideoTitle: "Daily Mandarin", sourceId: id(900), selection: { savedItemId: id(n + 100), candidateArtifactId: id(800), candidateIndex: n }, currentTaskId: id(n + 200), roundStatus: "open" });
const material = (n: number) => ({ task: { id: id(n), userExpressionId: id(50), kind: "use_it_now", nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: `表达${n}`, promptChinese: "朋友告诉你价格。你怎么想？", instructionsEnglish: "Tell your friend what you think.", goalEnglish: "Use the expression naturally.", dueAt: null, createdAt: "2026-11-01T00:00:00.000Z" }, masteryState: null, roundState: { roundNumber: 1, status: "open", firstAnswer: null, latestRevision: null, examplesOpened: false, promotion: null, retryDueAt: null }, source: { videoTitle: "Daily Mandarin", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "这个价格太离谱了。", startSeconds: 0 }, expression: { englishMeaning: "A useful expression", englishExplanation: "Use it naturally.", tone: "Casual", communicativeFunction: "React", register: "Informal" } });
const ok = (data: unknown) => Response.json({ ok: true, data, requestId: "fixture" });
let queue: TodayPracticeItem[] = [];
let nextBodies: TodayNextInput[] = [];
beforeEach(() => {
  queue = [candidate(1), candidate(2)];
  nextBodies = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/today"))
      return ok({ summary, items: queue });
    if (url.endsWith("/today/next")) {
      const body = JSON.parse(String(options?.body));
      nextBodies.push(body);
      const remaining = queue.filter(i => !(body.exclude ?? []).includes(i.id));
      return ok({ summary, item: remaining[0] ?? null, remainingCount: remaining.length, resumed: false });
    }
    if (url.endsWith("/restore")) {
      queue = [candidate(1), ...queue.filter(i => i.id !== id(1))];
      return ok({ roundState: material(201).roundState });
    }
    return ok(material(Number(url.split("/").at(-1)?.slice(-3))));
  }));
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  push.mockReset();
});
test("Next recalculates server queue, Finish clears it, summary survives Exit", async () => {
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  expect(screen.getByText("Today's practice · 2 left")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Complete first answer"));
  queue = [candidate(2)];
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("表达202");
  expect(screen.getByRole("button", { name: "Finish" })).toBeInTheDocument();
  expect(nextBodies[1]).not.toHaveProperty("currentTaskId");
  fireEvent.click(screen.getByText("Complete first answer"));
  queue = [];
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  await screen.findByText("All done for today");
  expect(screen.getAllByText("Practice again tomorrow")).toHaveLength(2);
  expect(readSession(id(999)).results).toHaveLength(2);
  expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
});
test("new round retains candidate and left count, current hint refreshes", async () => {
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  fireEvent.click(screen.getByText("Try a new situation"));
  await screen.findByText("表达600");
  expect(screen.getByText("Today's practice · 2 left")).toBeInTheDocument();
  expect(readSession(id(999)).current).toEqual({ currentItemId: id(1), currentTaskId: id(600) });
  expect(readSession(id(999)).results).toEqual([]);
});
test("Remove advances immediately and cross-item Undo preserves current item", async () => {
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  queue = [candidate(2)];
  fireEvent.click(screen.getByText("Remove from practice"));
  await screen.findByText("表达202");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  await waitFor(() => expect(readSession(id(999)).results).toEqual([]));
  expect(screen.getByText("表达202")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Complete first answer"));
  queue = [candidate(1)];
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("表达201");
});
test("thousands of display history records compact to eligible IDs before next", async () => {
  const history = Array.from({ length: 4000 }, (_, n) => ({ id: id(n + 10000), kind: "new" as const, expression: "表达", outcome: "added" as const, priorMastery: null, newMastery: "tried" as const, nextPracticeAt: null }));
  writeSession(id(999), { results: history, current: { currentItemId: id(1), currentTaskId: id(201) } });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  expect(nextBodies[0].exclude).toEqual([]);
  expect(JSON.stringify(nextBodies[0]).length).toBeLessThan(1000);
  expect(nextBodies[0].currentTaskId).toBe(id(201));
});
test("storage failures and stale hints do not prevent fresh server selection", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("blocked");
  });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  expect(screen.getByRole("link", { name: /Exit session/ })).toHaveAttribute("href", "/practice");
});
test("maintained owned Review is neither moved up nor tomorrow", async () => {
  queue = [{ id: id(10), kind: "review", reviewTaskId: id(10), userExpressionId: id(50), expression: "保持", meaningHere: "Keep steady", mastery: "owned", dueAt: "2026-10-01T00:00:00.000Z", overdueDays: 30, roundNumber: null, sourceVideoTitle: null, sourceId: null }];
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText(`Review ${id(10)}`);
  fireEvent.click(screen.getByText("Complete review"));
  queue = [];
  fireEvent.click(screen.getByRole("button", { name: "Finish" }));
  await screen.findByText("All done for today");
  expect(screen.getByText(/Nice — still owned/)).toBeInTheDocument();
  expect(screen.getByText("0 added to your Vault · 0 moved up")).toBeInTheDocument();
  expect(screen.queryByText("Practice again tomorrow")).not.toBeInTheDocument();
});
test("invalid stale navigation hint is sent only initially and server choice wins", async () => {
  writeSession(id(999), { results: [], current: { currentItemId: id(700), currentTaskId: id(701) } });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  expect(nextBodies[0].currentTaskId).toBe(id(701));
  expect(readSession(id(999)).current?.currentItemId).toBe(id(1));
  fireEvent.click(screen.getByText("Complete first answer"));
  queue = [candidate(2)];
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("表达202");
  expect(nextBodies[1].currentTaskId).toBeUndefined();
});
test("provider opening error keeps session and retry uses fresh state", async () => {
  const fetcher = vi.mocked(fetch);
  fetcher.mockImplementationOnce(async () => {
    throw Error("offline");
  });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("Practice couldn't open.");
  expect(screen.getByRole("link", { name: /Exit session/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("表达201");
});
test("same candidate official results deduplicate after a new round", async () => {
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  fireEvent.click(screen.getByText("Complete first answer"));
  fireEvent.click(screen.getByText("Try a new situation"));
  await screen.findByText("表达600");
  fireEvent.click(screen.getByText("Complete first answer"));
  expect(readSession(id(999)).results).toHaveLength(1);
  expect(screen.getByText("Today's practice · 2 left")).toBeInTheDocument();
});
test("two Reviews, one Second try and three New run through all six with no cap", async () => {
  const review = (n: number): TodayPracticeItem => ({ id: id(n), kind: "review", reviewTaskId: id(n), userExpressionId: id(50), expression: `复习${n}`, meaningHere: "Review expression", mastery: "owned", dueAt: "2026-10-01T00:00:00.000Z", overdueDays: 30, roundNumber: null, sourceVideoTitle: null, sourceId: null });
  queue = [review(10), review(11), { ...candidate(3), kind: "second_try", roundNumber: 2 }, candidate(4), candidate(5), candidate(6)];
  render(<TodaySession userId={id(999)}/>);
  for (let n = 0; n < 6; n++) {
    const expected = n < 2 ? `Review ${id(10 + n)}` : `表达${n + 201}`;
    await screen.findByText(expected);
    fireEvent.click(screen.getByText(n < 2 ? "Complete review" : "Complete first answer"));
    queue = queue.slice(1);
    fireEvent.click(screen.getByRole("button", { name: n === 5 ? "Finish" : "Next" }));
  }
  await screen.findByText("All done for today");
  expect(readSession(id(999)).results).toHaveLength(6);
  expect(nextBodies).toHaveLength(7);
});
test.each(["superseded", "removed", "promoted", "retry_scheduled"])("a task %s between selection and material read cannot reopen stale content", async (status) => {
  const fetcher = vi.mocked(fetch);
  const original = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (input, options) => {
    if (String(input).endsWith(`/tasks/${id(201)}`))
      return ok({ ...material(201), roundState: { ...material(201).roundState, status } });
    return original(input, options);
  });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("Practice couldn't open.");
  expect(screen.queryByText("表达201")).not.toBeInTheDocument();
  queue = [candidate(2)];
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  await screen.findByText("表达202");
});
test("finished session starts fresh when the server has new work, even for same candidate", async () => {
  writeSession(id(999), { results: [{ id: id(1), kind: "new", expression: "表达1", outcome: "practice_again_tomorrow", priorMastery: null, newMastery: null, nextPracticeAt: null }], current: null, finished: true });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("表达201");
  expect(nextBodies[0].exclude).toEqual([]);
  expect(readSession(id(999)).results).toEqual([]);
  expect(readSession(id(999)).finished).toBe(false);
});
test("finished empty queue keeps last summary while unfinished Exit keeps the session", async () => {
  queue = [];
  writeSession(id(999), { results: [{ id: id(1), kind: "new", expression: "表达1", outcome: "added", priorMastery: null, newMastery: "tried", nextPracticeAt: null }], current: null, finished: true });
  render(<TodaySession userId={id(999)}/>);
  await screen.findByText("All done for today");
  expect(screen.getByText("Added to your Vault")).toBeInTheDocument();
  expect(readSession(id(999)).results).toHaveLength(1);
});
