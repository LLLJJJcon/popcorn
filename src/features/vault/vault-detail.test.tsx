import { render, screen } from "@testing-library/react";

import VaultExpressionPage from "@/app/(app)/vault/[userExpressionId]/page";
import { VaultDetail } from "@/features/vault/vault-detail";
import type {
  ExpressionCardView,
  ExpressionSuggestion,
} from "@/server/repositories/review-task-repository";

const USER = "11111111-1111-4111-8111-111111111111";
const EXPRESSION = "33333333-3333-4333-8333-333333333333";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((href: string): never => { throw new Error(`redirect:${href}`); }),
  notFound: vi.fn((): never => { throw new Error("not-found"); }),
}));
const runtime = vi.hoisted(() => ({
  authenticate: vi.fn(),
  getVault: vi.fn(),
}));

vi.mock("next/navigation", () => navigation);
vi.mock("@/server/repositories/review-task-repository", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/server/repositories/review-task-repository")>();
  return {
    ...original,
    createLearningMemoryRuntime: vi.fn(async () => ({
      appUrl: "https://popcorn.example",
      authenticate: runtime.authenticate,
      repository: { getVault: runtime.getVault },
    })),
  };
});

function card(overrides: Partial<ExpressionCardView> = {}): ExpressionCardView {
  return {
    userExpressionId: EXPRESSION,
    expression: "太离谱了",
    englishMeaning: "That is outrageous.",
    englishExplanation: "Use this to react to something surprisingly unreasonable.",
    tone: "Surprised and critical.",
    communicativeFunction: "Reacting critically.",
    register: "Informal spoken Mandarin.",
    masteryState: "reused",
    sourceDeleted: false,
    sourceTitle: "A measured Mandarin conversation",
    occurrence: {
      evidenceText: "这个价格也太离谱了吧",
      segmentIds: ["segment-1"],
      startSeconds: 40,
      endSeconds: 43,
      youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=40s",
    },
    attempts: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        responseChinese: "这个价格太离谱了。",
        passed: false,
        accuracyScore: 4,
        accuracyFeedbackEnglish: "Accurate, but add context.",
        naturalnessScore: 4,
        naturalnessFeedbackEnglish: "Natural spoken wording.",
        contextualFitScore: 3,
        contextualFitFeedbackEnglish: "Make the reaction more specific.",
        submittedAt: "2026-08-20T02:03:04.000Z",
      },
      {
        id: "55555555-5555-4555-8555-555555555555",
        responseChinese: "这个价格也太离谱了吧。",
        passed: true,
        accuracyScore: 5,
        accuracyFeedbackEnglish: "Accurate.",
        naturalnessScore: 5,
        naturalnessFeedbackEnglish: "Natural.",
        contextualFitScore: 5,
        contextualFitFeedbackEnglish: "Fits.",
        submittedAt: "2026-08-21T02:03:04.000Z",
      },
    ],
    ...overrides,
  };
}

const suggestions: readonly ExpressionSuggestion[] = [{
  userExpressionId: "66666666-6666-4666-8666-666666666666",
  expression: "离谱",
  englishMeaning: "absurd",
  match: "similar",
}];

afterEach(() => {
  vi.clearAllMocks();
});

describe("VaultDetail", () => {
  test("renders full grounded metadata, timestamped evidence, and every ordered attempt", () => {
    const { container } = render(<VaultDetail card={card()} suggestions={suggestions} />);

    expect(screen.getByRole("heading", { name: "太离谱了" })).toBeInTheDocument();
    expect(screen.getByText("That is outrageous.")).toBeInTheDocument();
    expect(screen.getByText(/Use this to react/)).toBeInTheDocument();
    expect(screen.getByText("reused")).toBeInTheDocument();
    expect(screen.getByText("Surprised and critical.")).toBeInTheDocument();
    expect(screen.getByText("Reacting critically.")).toBeInTheDocument();
    expect(screen.getByText("Informal spoken Mandarin.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "A measured Mandarin conversation" })).toBeInTheDocument();
    expect(screen.getByText("这个价格也太离谱了吧")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Watch this moment on YouTube" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=40s",
    );
    expect(screen.getByRole("heading", { name: "Attempt history" })).toBeInTheDocument();
    const first = screen.getByText("这个价格太离谱了。");
    const second = screen.getByText("这个价格也太离谱了吧。");
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(container).toHaveTextContent("Accuracy 4/5");
    expect(container).toHaveTextContent("Naturalness 5/5");
    expect(container).toHaveTextContent("Contextual fit 5/5");
    expect(screen.getByRole("link", { name: /离谱/ })).toHaveAttribute(
      "href",
      "/vault/66666666-6666-4666-8666-666666666666",
    );
  });

  test("keeps tombstoned evidence generic while retaining attempt history", () => {
    const deleted = card({ sourceDeleted: true, sourceTitle: null, occurrence: null });
    render(<VaultDetail card={deleted} suggestions={[]} />);

    expect(screen.getByText("Source deleted")).toBeInTheDocument();
    expect(screen.getByText(deleted.attempts[0]!.responseChinese)).toBeInTheDocument();
    expect(screen.queryByText("A measured Mandarin conversation")).not.toBeInTheDocument();
    expect(screen.queryByText("这个价格也太离谱了吧", { selector: "blockquote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /YouTube/i })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/40s|43s|dQw4w9WgXcQ/);
  });
});

describe("Vault expression route", () => {
  test("authenticates once and reads the expression through the owner-scoped repository", async () => {
    runtime.authenticate.mockResolvedValue({ ok: true, userId: USER });
    runtime.getVault.mockResolvedValue({ card: card(), suggestions });

    const view = await VaultExpressionPage({ params: Promise.resolve({ userExpressionId: EXPRESSION }) });
    render(view);

    expect(runtime.authenticate).toHaveBeenCalledExactlyOnceWith(new Request("https://popcorn.example"));
    expect(runtime.getVault).toHaveBeenCalledExactlyOnceWith(USER, EXPRESSION);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  test("redirects an unauthenticated learner before reading Vault", async () => {
    runtime.authenticate.mockResolvedValue({ ok: false, reason: "missing" });

    await expect(VaultExpressionPage({ params: Promise.resolve({ userExpressionId: EXPRESSION }) }))
      .rejects.toThrow("redirect:/sign-in");
    expect(runtime.authenticate).toHaveBeenCalledTimes(1);
    expect(runtime.getVault).not.toHaveBeenCalled();
  });

  test.each(["not-a-uuid", "22222222-2222-4222-8222-222222222222"])(
    "returns not found for malformed or unavailable expression %s",
    async (userExpressionId) => {
      runtime.authenticate.mockResolvedValue({ ok: true, userId: USER });
      runtime.getVault.mockResolvedValue(null);

      await expect(VaultExpressionPage({ params: Promise.resolve({ userExpressionId }) }))
        .rejects.toThrow("not-found");
      expect(runtime.getVault).toHaveBeenCalledTimes(userExpressionId === "not-a-uuid" ? 0 : 1);
    },
  );
});
