import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { TodayPracticeResponse, TodayCandidateItem } from "@/contracts/today-practice";
import { TodayPractice } from "./today-practice";
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const candidate = (n: number): TodayCandidateItem => ({ id: id(n), kind: "new", expression: `表达${n}`, meaningHere: "A useful expression", mastery: null, dueAt: null, overdueDays: 0, roundNumber: null, sourceVideoTitle: "Daily Mandarin", sourceId: id(900), selection: { savedItemId: id(n + 100), candidateArtifactId: id(800), candidateIndex: n }, currentTaskId: null, roundStatus: null });
const data: TodayPracticeResponse = { summary: { reviewCount: 2, secondTryCount: 1, newCount: 11, estimatedMinutes: 28, needsAnalysisCount: 0, processingCount: 0, nextPracticeAt: null }, items: [{ ...candidate(20), kind: "review", reviewTaskId: id(20), userExpressionId: id(21), mastery: "tried", dueAt: "2026-10-30T00:00:00.000Z", roundNumber: null, overdueDays: 2 }, { ...candidate(30), kind: "second_try", roundNumber: 2, roundStatus: "retry_scheduled", currentTaskId: id(31) }, ...Array.from({ length: 11 }, (_, i) => candidate(i + 1))] };
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  push.mockReset();
});
test("full grouped counts, exact descriptions, ten New rows and Show all", async () => {
  render(<TodayPractice userId={id(999)} initialData={data}/>);
  await act(async () => { });
  expect(screen.getByText("2 reviews · 1 second try · 11 new · about 28 min")).toBeInTheDocument();
  expect(screen.getByText("Reviews, second tries and new expressions, in one place.")).toBeInTheDocument();
  expect(screen.getByText("Due for review — use a Vault expression again in a new situation.")).toBeInTheDocument();
  expect(screen.getByText("Round 2")).toBeInTheDocument();
  expect(screen.getByText("Overdue 2 days")).toBeInTheDocument();
  expect(screen.queryByText("表达11")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all 11" }));
  expect(screen.getByText("表达11")).toBeInTheDocument();
  expect(screen.queryByText(/Next practice:/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Start" })).toHaveAttribute("href", "/practice/session");
});
test("empty action follows analysis and null date is omitted", async () => {
  render(<TodayPractice userId={id(999)} initialData={{ summary: { ...data.summary, reviewCount: 0, secondTryCount: 0, newCount: 0, estimatedMinutes: 0, needsAnalysisCount: 1 }, items: [] }}/>);
  await act(async () => { });
  expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Analyze your saves" })).toHaveAttribute("href", "/saved?filter=needs-analysis");
  expect(screen.queryByText(/Next practice:/)).not.toBeInTheDocument();
});
test("open first round resumes identical task without activation and returns to practice", async () => {
  const open = { ...candidate(1), currentTaskId: id(700), roundStatus: "open" as const, roundNumber: 1 };
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(<TodayPractice userId={id(999)} initialData={{ ...data, items: [open] }}/>);
  await act(async () => { });
  fireEvent.click(screen.getByRole("button", { name: "表达1" }));
  await act(async () => { });
  expect(push).toHaveBeenCalledWith(`/practice/${id(700)}?returnTo=%2Fpractice`);
  expect(fetcher).not.toHaveBeenCalled();
});
test("preparation gateway error retains card and offers explicit settings", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false, requestId: "x", error: { code: "MODEL_GATEWAY_CONFIGURATION_REQUIRED", message: "Connect", retryable: false } }, { status: 409 })));
  render(<TodayPractice userId={id(999)} initialData={{ ...data, items: [candidate(1)] }}/>);
  await act(async () => { });
  fireEvent.click(screen.getByRole("button", { name: "表达1" }));
  await screen.findByText("Connect a model to continue.");
  expect(screen.getByRole("button", { name: "表达1" })).toBeEnabled();
  expect(screen.getByRole("link", { name: "Set up model gateway" })).toHaveAttribute("href", "/settings/model-gateway");
});
test("more than one hundred Reviews and two hundred New are never product-capped", async () => {
  const reviews = Array.from({ length: 101 }, (_, n) => ({ id: id(n + 1000), kind: "review" as const, reviewTaskId: id(n + 1000), userExpressionId: id(700), expression: `复习${n}`, meaningHere: "A retained expression", mastery: "tried" as const, dueAt: "2026-10-30T00:00:00.000Z", overdueDays: 2, roundNumber: null, sourceVideoTitle: null, sourceId: null }));
  const news = Array.from({ length: 211 }, (_, n) => candidate(n + 1));
  render(<TodayPractice userId={id(999)} initialData={{ summary: { ...data.summary, reviewCount: 101, secondTryCount: 0, newCount: 211, estimatedMinutes: 624 }, items: [...reviews, ...news] }}/>);
  await act(async () => { });
  expect(screen.getByText("复习100")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show all 211" }));
  expect(screen.getByText("表达211")).toBeInTheDocument();
  expect(screen.getByText("101 reviews · 0 second tries · 211 new · about 624 min")).toBeInTheDocument();
});
