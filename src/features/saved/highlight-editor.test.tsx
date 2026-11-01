import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HighlightEditor, projectSavedSelection } from "./highlight-editor";

const savedItemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const highlightId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const targets = [
  { id: "s1", text: "这杯咖啡高得要命。", startSeconds: 10, endSeconds: 12 },
  { id: "s2", text: "我还是自己做吧。", startSeconds: 12, endSeconds: 15 },
];
const mark = { id: highlightId, savedItemId, startSegmentId: "s1", startOffset: 4, endSegmentId: "s1", endOffset: 8, text: "高得要命", origin: "model" as const, reasonEn: "Express an excessive degree", status: "active" as const };
const success = (data: unknown) => Response.json({ ok: true, data, requestId: "req" });

describe("Saved highlight editor", () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("shows pending and empty suggestions without hiding editable Chinese", () => {
    const { rerender } = render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[]} highlightStatus="pending" onChange={vi.fn()} />);
    expect(screen.getByText("Finding expressions…")).toBeInTheDocument();
    expect(screen.getByTestId("raw-text")).toHaveTextContent(targets[0]!.text);
    rerender(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[]} highlightStatus="ready" onChange={vi.fn()} />);
    expect(screen.getByText("No suggestions for this line — select any words you want to learn.")).toBeInTheDocument();
  });
  it("offers setup instead of suggest when there is no gateway", () => {
    render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[]} highlightStatus="unavailable" gatewayAvailable={false} onChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Set up model gateway" })).toHaveAttribute("href", "/settings/model-gateway");
    expect(screen.queryByRole("button", { name: "Suggest again" })).not.toBeInTheDocument();
  });
  it("switches Suggest again to setup if the gateway was removed after loading", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success({ highlights: [], highlightStatus: "unavailable", queued: false, gatewayRequired: true })));
    render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[]} highlightStatus="unavailable" gatewayAvailable onChange={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Suggest again" }));
    expect(await screen.findByRole("link", { name: "Set up model gateway" })).toBeInTheDocument();
  });
  it("deletes and restores a mark through owned endpoints with an undo announcement", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(success({ highlights: [], highlightStatus: "ready" })).mockResolvedValueOnce(success({ highlights: [mark], highlightStatus: "ready" }));
    vi.stubGlobal("fetch", fetchMock);
    const change = vi.fn();
    render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[mark]} highlightStatus="ready" onChange={change} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove highlight 高得要命" }));
    expect(await screen.findByText("Removed ·")).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/v1/saved-items/${savedItemId}/highlights/${highlightId}`);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("DELETE");
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/v1/saved-items/${savedItemId}/highlights/${highlightId}/restore`);
    await waitFor(() => expect(change).toHaveBeenLastCalledWith([mark], "ready"));
  });
  it("projects reversed and cross-line text ranges while trimming outer punctuation", () => {
    render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[mark]} highlightStatus="ready" onChange={vi.fn()} />);
    const first = screen.getByTestId("raw-text").querySelector('[data-segment-id="s1"] [data-target-text]')!.firstChild!;
    const last = screen.getByTestId("raw-text").querySelector('[data-segment-id="s2"] [data-target-text]')!.firstChild!;
    const range = document.createRange(); range.setStart(first, 2); range.setEnd(last, 8);
    const projected = projectSavedSelection(range, screen.getByTestId("raw-text"), targets);
    expect(projected).toMatchObject({ startSegmentId: "s1", startOffset: 2, endSegmentId: "s2", endOffset: 7 });
    expect(projected?.text).toBe("咖啡高得要命。\n我还是自己做吧");
  });
  it("does not offer Mark for punctuation or non-Chinese selection", () => {
    render(<HighlightEditor savedItemId={savedItemId} segments={[{ ...targets[0]!, text: "hello。" }]} highlights={[]} highlightStatus="ready" onChange={vi.fn()} />);
    const range = document.createRange(); range.selectNodeContents(screen.getByTestId("raw-text"));
    expect(projectSavedSelection(range, screen.getByTestId("raw-text"), [{ ...targets[0]!, text: "hello。" }])).toBeNull();
    fireEvent.mouseUp(screen.getByTestId("raw-text"));
    expect(screen.queryByRole("button", { name: "Mark" })).not.toBeInTheDocument();
  });
  it("expires undo after five seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(success({ highlights: [], highlightStatus: "ready" })));
    render(<HighlightEditor savedItemId={savedItemId} segments={targets} highlights={[mark]} highlightStatus="ready" onChange={vi.fn()} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove highlight 高得要命" })); });
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});
