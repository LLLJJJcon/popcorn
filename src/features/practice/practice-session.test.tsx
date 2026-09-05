import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { PracticeMaterialView } from "@/features/practice/material-schema";
import { PracticeSession } from "./practice-session";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const material: PracticeMaterialView = {
  task: {
    id: "11111111-1111-4111-8111-111111111111", userExpressionId: "33333333-3333-4333-8333-333333333333",
    kind: "use_it_now", nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "太离谱了",
    promptChinese: "朋友告诉你一杯普通咖啡卖一百元。你会怎么回应？",
    instructionsEnglish: "Reply with one natural Simplified Chinese sentence.",
    goalEnglish: "React critically to the unreasonable price.", dueAt: null, createdAt: "2026-08-21T02:03:04.000Z",
  },
  masteryState: "tried",
  source: {
    videoTitle: "Street Mandarin: prices", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk&t=62s",
    evidenceText: "这个价格也太离谱了吧。", startSeconds: 62,
  },
  expression: {
    englishMeaning: "That is outrageous.", englishExplanation: "A strong reaction when something feels unreasonable.",
    tone: "surprised and critical", communicativeFunction: "reacting to an unreasonable situation",
    register: "informal spoken Mandarin",
  },
};

const evaluation = {
  passed: true,
  accuracy: { score: 5, englishFeedback: "The expression conveys the intended reaction." },
  naturalness: { score: 4, englishFeedback: "The sentence sounds natural in casual speech." },
  contextualFit: { score: 5, englishFeedback: "It fits the situation directly." },
  independentUse: true, assistanceLevel: "none" as const,
};

function attemptResponse(overrides: Record<string, unknown> = {}) {
  return {
    attempt: {
      id: "44444444-4444-4444-8444-444444444444", userId: "22222222-2222-4222-8222-222222222222",
      practiceTaskId: material.task.id, userExpressionId: material.task.userExpressionId,
      responseChinese: "这个价格也太离谱了。", evaluation,
      submittedAt: material.task.createdAt, createdAt: material.task.createdAt, ...overrides,
    },
    coaching: { naturalRevisionChinese: "这个价格也太离谱了吧。" },
  };
}

function apiResponse(data: unknown) {
  return Response.json({ ok: true, data, requestId: "safe-request" });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PracticeSession", () => {
  test("shows grounded material while withholding a complete answer before submit", () => {
    render(<PracticeSession material={material} />);
    const main = screen.getByRole("main");
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(main).toContainElement(screen.getByRole("heading", { name: "太离谱了" }));
    expect(screen.getByRole("heading", { name: "太离谱了" })).toBeInTheDocument();
    expect(screen.getByText("That is outrageous.")).toBeInTheDocument();
    expect(screen.getByText(/current mastery: tried/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Street Mandarin: prices.*1:02/i })).toHaveAttribute("href", material.source.youtubeUrl);
    expect(screen.getByText(material.task.promptChinese)).toBeInTheDocument();
    expect(screen.getByText(material.task.instructionsEnglish)).toBeInTheDocument();
    expect(screen.getByText(material.task.goalEnglish)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show original evidence" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Your Chinese response")).toHaveValue("");
    expect(document.body).not.toHaveTextContent(/model answer|example response/i);
  });

  test("reveals existing hint metadata without fetching and submits the hint assistance level", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse(attemptResponse({
      evaluation: { ...evaluation, independentUse: false, assistanceLevel: "hint" },
    })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PracticeSession material={material} />);

    await user.click(screen.getByRole("button", { name: "Need a hint?" }));
    expect(screen.getByText(material.expression.englishExplanation)).toBeInTheDocument();
    expect(screen.getByText(/surprised and critical/i)).toBeInTheDocument();
    expect(screen.getByText(/reacting to an unreasonable situation/i)).toBeInTheDocument();
    expect(screen.getByText(/informal spoken Mandarin/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Your Chinese response"), "这个价格太离谱了。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    await screen.findByRole("heading", { name: "Feedback" });
    expect(JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body))).toMatchObject({ assistanceLevel: "hint" });
  });

  test("prevents duplicate submission while the configured model is working", async () => {
    let resolveRequest!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<PracticeSession material={material} />);

    await user.type(screen.getByLabelText("Your Chinese response"), "这个价格太离谱了。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));
    const checking = screen.getByRole("button", { name: "Checking your Chinese…" });
    expect(checking).toBeDisabled();
    await user.click(checking);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveRequest(apiResponse(attemptResponse()));
    expect(await screen.findByRole("heading", { name: "Feedback" })).toBeInTheDocument();
  });

  test("retains learner Chinese on recoverable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: false }, { status: 503 })));
    const user = userEvent.setup();
    render(<PracticeSession material={material} />);
    const response = screen.getByLabelText("Your Chinese response");
    await user.type(response, "这个价格也太离谱了！");
    await user.click(screen.getByRole("button", { name: "Check my response" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/response is still here/i);
    expect(response).toHaveValue("这个价格也太离谱了！");
  });

  test("adds a calm explanation after eight seconds without cancelling the request", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    render(<PracticeSession material={material} />);
    fireEvent.change(screen.getByLabelText("Your Chinese response"), { target: { value: "这个价格太离谱了。" } });
    fireEvent.click(screen.getByRole("button", { name: "Check my response" }));

    expect(screen.getByRole("status")).toHaveTextContent("Checking your Chinese…");
    expect(screen.queryByText(/configured model is still working/i)).not.toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(8_000); });
    expect(screen.getByText(/configured model is still working/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("never claims Vault evidence for a hint-assisted original", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => apiResponse(attemptResponse({
      evaluation: { ...evaluation, independentUse: false, assistanceLevel: "hint" },
    }))));
    const user = userEvent.setup();
    render(<PracticeSession material={material} />);
    await user.click(screen.getByRole("button", { name: "Need a hint?" }));
    await user.type(screen.getByLabelText("Your Chinese response"), "这个价格也太离谱了。");
    await user.click(screen.getByRole("button", { name: "Check my response" }));

    expect(await screen.findByText(/not added to your Vault/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in Vault" })).not.toBeInTheDocument();
  });
});
