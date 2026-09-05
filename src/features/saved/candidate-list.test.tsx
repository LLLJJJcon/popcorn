import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";

import type { CandidateExpression } from "@/contracts/knowledge";
import { CandidateList } from "@/features/saved/candidate-list";

const SAVED_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIDEO_SOURCE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const ARTIFACT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const EXPRESSION_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const push = vi.fn();
const refresh = vi.fn();
const pageRuntime = vi.hoisted(() => ({
  authenticate: vi.fn(),
  detail: vi.fn(),
  deletionPreview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/features/saved/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/features/saved/api")>(),
  createSavedRuntime: async () => ({
    appUrl: "https://popcorn.example",
    authenticate: pageRuntime.authenticate,
    service: { detail: pageRuntime.detail },
    deletionPlanner: { preview: pageRuntime.deletionPreview },
  }),
}));

function candidate(overrides: Partial<CandidateExpression> = {}): CandidateExpression {
  return {
    expression: "挺有意思的",
    englishMeaning: "pretty interesting",
    englishExplanation: "A casual way to show measured interest.",
    tone: "warm and understated",
    communicativeFunction: "expressing interest",
    register: "conversational",
    evidenceText: "这个想法挺有意思的",
    segmentIds: ["seg-1"],
    startSeconds: 62,
    endSeconds: 65,
    confidence: 0.94,
    ...overrides,
  };
}

function artifact(candidates: readonly CandidateExpression[]) {
  return {
    state: "ready" as const,
    artifact: {
      artifactId: ARTIFACT_ID,
      savedItemId: SAVED_ITEM_ID,
      candidates,
    },
  };
}

describe("Saved candidate expressions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    pageRuntime.authenticate.mockReset();
    pageRuntime.detail.mockReset();
    pageRuntime.deletionPreview.mockReset();
    pageRuntime.deletionPreview.mockResolvedValue({
      videoSourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      videoTitle: "中文访谈",
      savedCount: 1,
      affectedExpressionCount: 0,
      mode: "remove_unpracticed_source",
    });
    vi.restoreAllMocks();
  });

  it("keeps the native action disabled in SSR, then enables one activation after hydration", async () => {
    const props = {
      savedItemId: SAVED_ITEM_ID,
      videoSourceId: VIDEO_SOURCE_ID,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      analysis: artifact([candidate()]),
    };
    const serverContainer = document.createElement("div");
    serverContainer.innerHTML = renderToString(<CandidateList {...props} />);
    expect(serverContainer.querySelector("button")).toBeDisabled();

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        id: TASK_ID,
        userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        userExpressionId: EXPRESSION_ID,
        kind: "use_it_now",
        nativeLanguage: "en",
        targetLanguage: "zh-CN",
        targetExpression: "挺有意思的",
        promptChinese: "请使用这个表达。",
        instructionsEnglish: "Reply in Mandarin.",
        goalEnglish: "Use the expression naturally.",
        dueAt: null,
        createdAt: "2026-08-21T00:00:00.000Z",
      },
      requestId: "safe-request",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList {...props} />);

    const action = screen.getByRole("button", { name: "Practice this expression" });
    await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledExactlyOnceWith(
      `/practice/${TASK_ID}?returnTo=${encodeURIComponent(`/saved/${VIDEO_SOURCE_ID}#saved-item-${SAVED_ITEM_ID}`)}`,
    );
  });

  it("renders three exact source-grounded candidates without numeric confidence", () => {
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={artifact([
        candidate(),
        candidate({
          expression: "话虽如此",
          englishMeaning: "that said",
          englishExplanation: "Introduces a qualification.",
          tone: "balanced",
          communicativeFunction: "qualifying a point",
          register: "neutral",
          evidenceText: "话虽如此，我们还是可以试试",
          segmentIds: ["seg-2"],
          startSeconds: 125,
          endSeconds: 129,
          confidence: 0.69,
        }),
        candidate({
          expression: "说白了",
          englishMeaning: "to put it plainly",
          englishExplanation: "Signals a direct summary.",
          tone: "direct",
          communicativeFunction: "summarizing plainly",
          register: "informal",
          evidenceText: "说白了，这就是时间问题",
          segmentIds: ["seg-3"],
          startSeconds: 3661,
          endSeconds: 3664,
          confidence: 0.82,
        }),
      ])}
    />);

    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(within(cards[0]!).getByText("挺有意思的")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("pretty interesting")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("A casual way to show measured interest.")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("warm and understated")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("expressing interest")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("conversational")).toBeInTheDocument();
    expect(within(cards[0]!).getByText("这个想法挺有意思的")).toBeInTheDocument();
    expect(within(cards[0]!).getByRole("link", { name: "Watch at 1:02 on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
    );
    expect(within(cards[2]!).getByRole("link", { name: "Watch at 1:01:01 on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3661s",
    );
    expect(within(cards[1]!).getByText("Needs your confirmation")).toBeInTheDocument();
    expect(screen.queryByText(/0\.69|69%|confidence/i)).not.toBeInTheDocument();
  });

  it.each([
    "analyze-saved-item-v1",
    "analyze-saved-item-v2",
  ])("renders the latest readable %s artifact and wires its domain candidate to activation", async (promptVersion) => {
    pageRuntime.authenticate.mockResolvedValue({ ok: true, userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    pageRuntime.detail.mockResolvedValue({
      sourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      youtubeVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      savedCount: 1,
      latestSavedAt: "2026-08-21T00:00:00.000Z",
      processingState: "ready",
      processingErrors: [],
      items: [{
        id: SAVED_ITEM_ID,
        kind: "subtitle_row",
        status: "ready",
        capturedAt: "2026-08-21T00:00:00.000Z",
        startSeconds: 62,
        rawText: "这个想法挺有意思的",
        englishTranslation: "This idea is pretty interesting.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
      }],
      artifacts: [
        {
          artifactId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          savedItemId: SAVED_ITEM_ID,
          type: "saved_item_analysis",
          promptVersion,
          content: { candidates: [candidate({ expression: "旧表达" })] },
        },
        {
          artifactId: ARTIFACT_ID,
          savedItemId: SAVED_ITEM_ID,
          type: "saved_item_analysis",
          promptVersion,
          content: { candidates: [candidate({ expression: "最新表达" })] },
        },
      ],
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        id: TASK_ID,
        userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        userExpressionId: EXPRESSION_ID,
        kind: "use_it_now",
        nativeLanguage: "en",
        targetLanguage: "zh-CN",
        targetExpression: "最新表达",
        promptChinese: "请使用这个表达。",
        instructionsEnglish: "Reply in Mandarin.",
        goalEnglish: "Use the expression naturally.",
        dueAt: null,
        createdAt: "2026-08-21T00:00:00.000Z",
      },
      requestId: "safe-request",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    const { default: SavedVideoPage } = await import("@/app/(app)/saved/[videoSourceId]/page");
    render(await SavedVideoPage({ params: Promise.resolve({ videoSourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }) }));

    expect(screen.getByTestId("raw-text")).toHaveTextContent("这个想法挺有意思的");
    expect(screen.queryByText("旧表达")).not.toBeInTheDocument();
    expect(screen.getByText("最新表达")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Delete 中文访谈?" })).toBeInTheDocument();
    expect(screen.queryByText(/already.*Vault|added.*Vault/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Practice this expression" }));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(vi.mocked(globalThis.fetch).mock.calls[0]![1]?.body))).toEqual({
      savedItemId: SAVED_ITEM_ID,
      candidateArtifactId: ARTIFACT_ID,
      candidateIndex: 0,
    });
  });

  it("falls back to the newest readable schema-valid candidate artifact when newer artifacts are unusable", async () => {
    const readableArtifactId = "12121212-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    pageRuntime.authenticate.mockResolvedValue({ ok: true, userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    pageRuntime.detail.mockResolvedValue({
      sourceId: VIDEO_SOURCE_ID,
      youtubeVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      savedCount: 1,
      latestSavedAt: "2026-08-21T00:00:00.000Z",
      processingState: "ready",
      processingErrors: [],
      items: [{
        id: SAVED_ITEM_ID,
        kind: "subtitle_row",
        status: "ready",
        capturedAt: "2026-08-21T00:00:00.000Z",
        startSeconds: 62,
        rawText: "这个想法挺有意思的",
        englishTranslation: "This idea is pretty interesting.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
      }],
      artifacts: [
        {
          artifactId: readableArtifactId,
          savedItemId: SAVED_ITEM_ID,
          type: "saved_item_analysis",
          promptVersion: "analyze-saved-item-v2",
          content: { candidates: [candidate({ expression: "仍然可用的表达" })] },
        },
        {
          artifactId: "13131313-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          savedItemId: SAVED_ITEM_ID,
          type: "saved_item_analysis",
          promptVersion: "analyze-saved-item-v999",
          content: { candidates: [candidate({ expression: "未知版本表达" })] },
        },
        {
          artifactId: "14141414-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          savedItemId: SAVED_ITEM_ID,
          type: "saved_item_analysis",
          promptVersion: "analyze-saved-item-v2",
          content: { candidates: [{ expression: "损坏的新表达" }] },
        },
      ],
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        id: TASK_ID,
        userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        userExpressionId: EXPRESSION_ID,
        kind: "use_it_now",
        nativeLanguage: "en",
        targetLanguage: "zh-CN",
        targetExpression: "仍然可用的表达",
        promptChinese: "请使用这个表达。",
        instructionsEnglish: "Reply in Mandarin.",
        goalEnglish: "Use the expression naturally.",
        dueAt: null,
        createdAt: "2026-08-21T00:00:00.000Z",
      },
      requestId: "safe-request",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));

    const { default: SavedVideoPage } = await import("@/app/(app)/saved/[videoSourceId]/page");
    render(await SavedVideoPage({ params: Promise.resolve({ videoSourceId: VIDEO_SOURCE_ID }) }));

    expect(screen.getByText("仍然可用的表达")).toBeInTheDocument();
    expect(screen.queryByText("未知版本表达")).not.toBeInTheDocument();
    expect(screen.queryByText("损坏的新表达")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Practice this expression" }));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      candidateArtifactId: readableArtifactId,
    });
  });

  it("keeps the production raw timeline visible and refuses an unknown candidate artifact version", async () => {
    pageRuntime.authenticate.mockResolvedValue({ ok: true, userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" });
    pageRuntime.detail.mockResolvedValue({
      sourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      youtubeVideoId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "中文访谈",
      channel: "中文频道",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      savedCount: 1,
      latestSavedAt: "2026-08-21T00:00:00.000Z",
      processingState: "ready",
      processingErrors: [],
      items: [{
        id: SAVED_ITEM_ID,
        kind: "subtitle_row",
        status: "ready",
        capturedAt: "2026-08-21T00:00:00.000Z",
        startSeconds: 62,
        rawText: "保留的原始字幕",
        englishTranslation: "Preserved raw subtitle.",
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s",
      }],
      artifacts: [{
        artifactId: "99999999-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        savedItemId: SAVED_ITEM_ID,
        type: "saved_item_analysis",
        promptVersion: "analyze-saved-item-v999",
        content: { candidates: [candidate({ expression: "未知版本表达" })] },
      }],
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const { default: SavedVideoPage } = await import("@/app/(app)/saved/[videoSourceId]/page");
    render(await SavedVideoPage({ params: Promise.resolve({ videoSourceId: "ffffffff-ffff-4fff-8fff-ffffffffffff" }) }));

    expect(screen.getByTestId("raw-text")).toHaveTextContent("保留的原始字幕");
    expect(screen.queryByRole("button", { name: "Practice this expression" })).not.toBeInTheDocument();
    expect(screen.queryByText("未知版本表达")).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps ambiguous candidates separate and posts only the three frozen identifiers", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        id: TASK_ID,
        userId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        userExpressionId: EXPRESSION_ID,
        kind: "use_it_now",
        nativeLanguage: "en",
        targetLanguage: "zh-CN",
        targetExpression: "可以说",
        promptChinese: "请在这个情境中用这个表达。",
        instructionsEnglish: "Reply in Mandarin.",
        goalEnglish: "Use the expression naturally.",
        dueAt: null,
        createdAt: "2026-08-21T00:00:00.000Z",
      },
      requestId: "safe-request",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    const ambiguous = [
      candidate({ expression: "可以说", englishMeaning: "one could say", evidenceText: "可以说这是第一次", confidence: 0.6 }),
      candidate({ expression: "可以说", englishMeaning: "it is permissible to say", evidenceText: "这里不可以说英文", segmentIds: ["seg-2"], startSeconds: 75, endSeconds: 77, confidence: 0.6 }),
    ];
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={artifact(ambiguous)}
    />);

    expect(screen.getAllByText("可以说")).toHaveLength(2);
    const actions = screen.getAllByRole("button", { name: "Practice this expression" });
    expect(actions).toHaveLength(2);
    await userEvent.click(actions[1]!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/practice/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        savedItemId: SAVED_ITEM_ID,
        candidateArtifactId: ARTIFACT_ID,
        candidateIndex: 1,
      }),
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      savedItemId: SAVED_ITEM_ID,
      candidateArtifactId: ARTIFACT_ID,
      candidateIndex: 1,
    });
    expect(push).toHaveBeenCalledExactlyOnceWith(
      `/practice/${TASK_ID}?returnTo=${encodeURIComponent(`/saved/${VIDEO_SOURCE_ID}#saved-item-${SAVED_ITEM_ID}`)}`,
    );
  });

  it("keeps an unavailable immutable analysis closed without offering recovery", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "unavailable" }}
    />);

    expect(screen.queryByRole("button", { name: "Practice this expression" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry analysis" })).not.toBeInTheDocument();
    expect(screen.getByText("Candidate analysis is unavailable.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("presents missing analysis as an accessible idle status with an Analyze action", () => {
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    const panel = screen.getByRole("region", { name: "Analysis status" });
    expect(within(panel).getByRole("status")).toHaveTextContent(
      "Choose a saved expression you want to learn, then click Analyze.",
    );
    expect(within(panel).getByRole("button", { name: "Analyze" })).toBeEnabled();
  });

  it("announces pending analysis and keeps its action disabled with visible activity", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
      requestId: "safe-request",
    }), { status: 202, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button"));
    await act(async () => {});

    expect(screen.getByRole("status")).toHaveTextContent(
      "Analyzing this expression and preparing it for practice…",
    );
    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Analysis in progress" })).toBeVisible();
  });

  it("keeps the raw-save experience progressive while recovery needs gateway configuration", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: { state: "gateway_required" },
      requestId: "safe-request",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    expect(screen.getByText("Choose a saved expression you want to learn, then click Analyze.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByRole("link", { name: "Set up model gateway" })).toHaveAttribute(
      "href",
      "/settings/model-gateway",
    );
  });

  it("renders candidates immediately when recovery reports that the immutable artifact is already ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      data: {
        state: "ready",
        artifactId: ARTIFACT_ID,
        savedItemId: SAVED_ITEM_ID,
        youtubeVideoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        candidates: [candidate()],
      },
      requestId: "safe-request",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("挺有意思的")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("polls the existing candidate endpoint after one processing recovery and renders recovered candidates", async () => {
    vi.useFakeTimers();
    let pollCount = 0;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockImplementation(async () => {
        pollCount += 1;
        return new Response(JSON.stringify({
          ok: true,
          data: pollCount === 30
            ? {
              state: "ready",
              artifactId: ARTIFACT_ID,
              savedItemId: SAVED_ITEM_ID,
              youtubeVideoId: "dQw4w9WgXcQ",
              canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              candidates: [candidate({ expression: "恢复的表达" })],
            }
            : { state: "processing", jobId: TASK_ID, status: "leased" },
          requestId: "safe-request",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      });
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });

    expect(fetchMock).toHaveBeenCalledTimes(31);
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["POST", ...Array(30).fill("GET")]);
    expect(fetchMock.mock.calls.slice(1)).toEqual(expect.arrayContaining([
      [expect.any(String), expect.objectContaining({ credentials: "same-origin", cache: "no-store" })],
    ]));
    expect(screen.getByText("恢复的表达")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Practice this expression" })).toBeInTheDocument();
  });

  it("polls at 1s then 5s, keeps processing safe at 60s, and stops with one status check at 5m", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockImplementation(async () => new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "leased" },
        requestId: "safe-request",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(screen.getByRole("status")).toHaveTextContent("Still analyzing in the background");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(61);
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(fetchMock).toHaveBeenCalledTimes(61);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(62);

    await act(async () => { await vi.advanceTimersByTimeAsync(235_000); });

    expect(screen.getByRole("status")).toHaveTextContent("Still queued");
    const checkStatus = screen.getByRole("button", { name: "Check status" });
    expect(checkStatus).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(108);
    expect(fetchMock.mock.calls.slice(1).every(([url]) => (
      url === `/api/v1/saved-items/${SAVED_ITEM_ID}/candidates?jobId=${TASK_ID}`
    ))).toBe(true);
    await act(async () => { fireEvent.click(checkStatus); });
    expect(fetchMock).toHaveBeenCalledTimes(109);
    expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(109);
  });

  it("uses wall-clock deadlines while a candidate status GET is permanently pending", async () => {
    vi.useFakeTimers();
    let pollSignal: AbortSignal | undefined;
    const processingResponse = () => new Response(JSON.stringify({
      ok: true,
      data: { state: "processing", jobId: TASK_ID, status: "leased" },
      requestId: "safe-request",
    }), { status: 200, headers: { "Content-Type": "application/json" } });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockImplementationOnce((_url, init) => {
        pollSignal = (init as RequestInit).signal ?? undefined;
        return new Promise<Response>(() => undefined);
      })
      .mockImplementation(async () => processingResponse());
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(59_000); });

    expect(screen.getByRole("status")).toHaveTextContent("Still analyzing in the background");
    await act(async () => { await vi.advanceTimersByTimeAsync(240_000); });

    expect(pollSignal?.aborted).toBe(true);
    const checkStatus = screen.getByRole("button", { name: "Check status" });
    expect(checkStatus).toBeEnabled();
    fireEvent.click(checkStatus);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Check status" })).toBeEnabled();
  });

  it("keeps the 60s background state and resumes slow cadence after a delayed status GET", async () => {
    vi.useFakeTimers();
    let resolvePoll: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolvePoll = resolve; }))
      .mockResolvedValue(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "leased" },
        requestId: "safe-request",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByRole("status")).toHaveTextContent("Still analyzing in the background");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvePoll?.(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "leased" },
        requestId: "safe-request",
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
      await Promise.resolve();
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("status")).toHaveTextContent("Still analyzing in the background");
  });

  it.each(["POST", "GET"])("rejects an unknown processing status from %s", async (method) => {
    vi.useFakeTimers();
    const unknown = new Response(JSON.stringify({
      ok: true,
      data: { state: "processing", jobId: TASK_ID, status: "mystery", ...(method === "POST" ? { created: true } : {}) },
      requestId: "safe-request",
    }), { status: method === "POST" ? 202 : 200, headers: { "Content-Type": "application/json" } });
    const fetchMock = vi.spyOn(globalThis, "fetch");
    if (method === "POST") {
      fetchMock.mockResolvedValueOnce(unknown);
    } else {
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({
          ok: true,
          data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
          requestId: "safe-request",
        }), { status: 202, headers: { "Content-Type": "application/json" } }))
        .mockResolvedValueOnce(unknown);
    }
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    if (method === "GET") await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(screen.getByRole("alert")).toHaveTextContent("Analysis is taking longer than expected. Try again.");
    expect(screen.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
  });

  it("shows a safe terminal model-output failure and submits one UUID for one in-flight Retry", async () => {
    vi.useFakeTimers();
    const retryJobId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    const retryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const randomUuid = vi.spyOn(crypto, "randomUUID").mockReturnValue(retryId);
    let resolveRetry: ((value: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "failed", jobId: TASK_ID, failureCategory: "model_output" },
        requestId: "safe-request",
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveRetry = resolve; }));
    const view = render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(screen.getByRole("alert")).toHaveTextContent("The model response could not be organized");
    const retry = screen.getByRole("button", { name: "Retry analysis" });
    fireEvent.click(retry);
    fireEvent.click(retry);
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe("{}");
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ retryId }));
    expect(randomUuid).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Analyzing…" })).toBeDisabled();

    await act(async () => {
      resolveRetry?.(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: retryJobId, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }));
      await Promise.resolve();
    });
    view.unmount();
  });

  it("restores an enabled retry action when candidate polling fails", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });

    expect(screen.getByRole("alert")).toHaveTextContent("Analysis is taking longer than expected. Try again.");
    expect(screen.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET")).toEqual(["POST", "GET"]);
  });

  it("cancels a pending candidate poll when unmounted", async () => {
    vi.useFakeTimers();
    let pollSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        data: { state: "processing", jobId: TASK_ID, status: "pending", created: true },
        requestId: "safe-request",
      }), { status: 202, headers: { "Content-Type": "application/json" } }))
      .mockImplementationOnce((_url, init) => {
        pollSignal = (init as RequestInit).signal ?? undefined;
        return new Promise<Response>(() => undefined);
      });
    const view = render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    view.unmount();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pollSignal?.aborted).toBe(true);
  });

  it("shows a safe retry error and never hides the recovery action behind internal details", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    }));
    render(<CandidateList
      savedItemId={SAVED_ITEM_ID}
      videoSourceId={VIDEO_SOURCE_ID}
      youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      analysis={{ state: "missing" }}
    />);

    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Analysis is taking longer than expected. Try again.");
    expect(screen.getByRole("button", { name: "Retry analysis" })).toBeEnabled();
    expect(screen.queryByText(/500|recovery failed|stack/i)).not.toBeInTheDocument();
  });
});
