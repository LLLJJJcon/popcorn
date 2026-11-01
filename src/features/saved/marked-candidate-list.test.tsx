import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SavedItemView } from "./api";
import { CandidateList } from "./candidate-list";
import type { CandidateExpression } from "@/contracts/knowledge";

const push = vi.fn(), refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
const savedItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", highlightId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", artifactId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const highlight = { id: highlightId, savedItemId, startSegmentId: "s1", startOffset: 4, endSegmentId: "s1", endOffset: 8, text: "高得要命", origin: "user" as const, reasonEn: null, status: "active" as const };
const item: SavedItemView = { id: savedItemId, kind: "subtitle_row", status: "ready", capturedAt: "2026-11-01T00:00:00Z", startSeconds: 62, rawText: "这杯咖啡高得要命。", englishTranslation: null, youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=62s", targetSegments: [{ id: "s1", text: "这杯咖啡高得要命。", startSeconds: 62, endSeconds: 66 }], highlights: [highlight], highlightStatus: "ready", gatewayAvailable: true };
const card: CandidateExpression = { expression: "高得要命", englishMeaning: "Too high.", englishExplanation: "A casual complaint.", tone: "Casual", communicativeFunction: "Complain", register: "Casual", evidenceText: item.rawText, segmentIds: ["s1"], startSeconds: 62, endSeconds: 66, highlightId, highlightKey: JSON.stringify(["s1",4,"s1",8,"高得要命"]), meaningHere: "Too high in this situation.", useItWhen: "Complain about an excessive degree.", comparedWith: "很高 states a fact; this shows annoyance.", howItFits: "The original form joins with 得.", toneAndWho: "Casual, with friends.", watchOut: null, examples: null, functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression" };
const success = (data: unknown) => Response.json({ ok: true, data, requestId: "req" });
const ready = (candidates: CandidateExpression[], highlightStates: unknown[] = []) => ({ state: "ready", artifactId, savedItemId, youtubeVideoId: "dQw4w9WgXcQ", canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", candidates, promptVersion: "analyze-saved-item-v3", highlightStates });
function renderList(overrides: Partial<SavedItemView> = {}, candidates?: CandidateExpression[], states: { highlightId: string; text: string; status: "failed" }[] = []) {
  return render(<CandidateList savedItemId={savedItemId} videoSourceId="source" youtubeUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" item={{ ...item, ...overrides }} analysis={candidates ? { state: "ready", artifact: { artifactId, savedItemId, candidates, promptVersion: "analyze-saved-item-v3", highlightStates: states } } : { state: "missing" }} />);
}

describe("marked-expression Analyze", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("requires a mark and gives a reason on the disabled Analyze action", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success({ state: "idle", highlightStates: [] })));
    renderList({ highlights: [] });
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByTitle("Mark at least one expression")).toBeInTheDocument();
  });
  it("keeps Analyze disabled for an already analyzed location even after a mark gets a new id", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success(ready([card]))));
    renderList({ highlights: [{ ...highlight, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" }] }, [card]);
    expect(screen.getByTitle("All marked expressions are analyzed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    await act(async () => { await Promise.resolve(); });
  });
  it("sends a body-free Analyze and preserves cards when the mark is removed", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith("/highlights/" + highlightId)) return Promise.resolve(success({ highlights: [], highlightStatus: "ready" }));
      if (init?.method === "POST") return Promise.resolve(success(ready([card])));
      return Promise.resolve(success({ state: "idle", highlightStates: [] }));
    });
    vi.stubGlobal("fetch", fetchMock); renderList();
    const action = screen.getByRole("button", { name: "Analyze" }); await waitFor(() => expect(action).toBeEnabled());
    await userEvent.click(action);
    await screen.findByText("Your learning card");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post?.[1]?.body).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Remove highlight 高得要命" }));
    expect(screen.getByText("Your learning card")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
  });
  it("keeps successful cards alongside a failed mark and retries only that mark", async () => {
    const failedHighlight = { ...highlight, id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", startOffset: 0, endOffset: 2, text: "这杯" };
    const states = [{ highlightId: failedHighlight.id, text: failedHighlight.text, status: "failed" as const }];
    const fetchMock = vi.fn().mockImplementation((_url: string, init?: RequestInit) => Promise.resolve(success(init?.method === "POST" ? ready([card]) : ready([card], states))));
    vi.stubGlobal("fetch", fetchMock); renderList({ highlights: [highlight, failedHighlight] }, [card], states);
    expect(screen.getByText("Couldn't analyze this one")).toBeInTheDocument();
    expect(screen.getByText("Your learning card")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toMatchObject({ highlightId: failedHighlight.id });
  });
  it("recovers failed mark states after a full-page refresh", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success({ state: "failed", jobId: artifactId, failureCategory: "model_output", highlightStates: [{ highlightId, text: highlight.text, status: "failed" }] })));
    renderList();
    expect(await screen.findByText("Couldn't analyze this one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("The model response could not be organized.");
  });
  it("recovers pending analysis on refresh without starting another job", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(success({ state: "processing", jobId: artifactId, status: "pending", artifact: { artifactId, savedItemId, candidates: [card], promptVersion: "analyze-saved-item-v3" }, highlightStates: [] })).mockResolvedValue(success(ready([card])));
    vi.stubGlobal("fetch", fetchMock); renderList();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText("Creating your learning cards…")).toBeInTheDocument();
    expect(screen.getByText("Your learning card")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(fetchMock.mock.calls.every(([, init]) => init?.method !== "POST")).toBe(true);
    vi.useRealTimers();
  });
});
