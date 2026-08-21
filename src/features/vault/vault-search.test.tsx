import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VaultSearch } from "./vault-search";

const SOURCE = "33333333-3333-4333-8333-333333333333";

function result(overrides: Record<string, unknown> = {}) {
  return {
    userExpressionId: "44444444-4444-4444-8444-444444444444",
    expressionSenseId: "55555555-5555-4555-8555-555555555555",
    expressionText: "太离谱了",
    englishMeaning: "absurd",
    communicativeFunction: "reaction",
    register: "informal",
    masteryState: "reused",
    sourceCount: 2,
    updatedAt: "2026-08-21T02:03:04.000Z",
    matchReason: "exact",
    ...overrides,
  };
}

function apiResponse(data: unknown) {
  return Response.json({ ok: true, data, requestId: "search-request" });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VaultSearch", () => {
  test("debounces browser requests and renders exact Chinese evidence fields", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse([result()]));
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);
    expect(screen.getByRole("status")).toHaveTextContent("Searching your Vault");
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      "/api/v1/vault?search=1&q=&limit=20",
      { credentials: "same-origin", cache: "no-store" },
    );
    const list = screen.getByRole("list", { name: "Vault search results" });
    const item = within(list).getByRole("listitem");
    expect(within(item).getByText("太离谱了")).toHaveAttribute("lang", "zh-CN");
    expect(item).toHaveTextContent("absurd");
    expect(item).toHaveTextContent("2 sources");
    expect(item).toHaveTextContent("reused");
    expect(item).toHaveTextContent("Exact match");
  });

  test("sends text and explicit filters only after the debounce", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);
    await screen.findByText("No learned expressions match these filters.");
    fetchMock.mockClear();

    fireEvent.change(screen.getByLabelText("Search expressions"), { target: { value: "reaction" } });
    fireEvent.change(screen.getByLabelText("Communicative function"), { target: { value: "reaction" } });
    fireEvent.change(screen.getByLabelText("Register"), { target: { value: "informal" } });
    fireEvent.change(screen.getByLabelText("Video source ID"), { target: { value: SOURCE } });
    fireEvent.change(screen.getByLabelText("Mastery"), { target: { value: "owned" } });
    fireEvent.change(screen.getByLabelText("Learned from"), { target: { value: "2026-08-01" } });
    fireEvent.change(screen.getByLabelText("Learned before"), { target: { value: "2026-09-01" } });
    expect(fetchMock).not.toHaveBeenCalled();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "https://popcorn.example");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      search: "1",
      q: "reaction",
      function: "reaction",
      register: "informal",
      source: SOURCE,
      mastery: "owned",
      from: "2026-08-01T00:00:00.000Z",
      before: "2026-09-01T00:00:00.000Z",
      limit: "20",
    });
  });

  test("supports keyboard navigation and clears every filter back to recent results", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse([
      result(),
      result({
        userExpressionId: "66666666-6666-4666-8666-666666666666",
        expressionSenseId: "77777777-7777-4777-8777-777777777777",
        expressionText: "麻烦你了",
        matchReason: "recent",
      }),
    ]));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<VaultSearch />);
    const input = screen.getByLabelText("Search expressions");
    const first = await screen.findByRole("link", { name: /太离谱了/ });
    const second = screen.getByRole("link", { name: /麻烦你了/ });

    input.focus();
    await user.keyboard("{ArrowDown}");
    expect(first).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(second).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();

    await user.type(input, "离谱");
    await user.type(screen.getByLabelText("Register"), "informal");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(input).toHaveValue("");
    expect(screen.getByLabelText("Register")).toHaveValue("");
    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      "/api/v1/vault?search=1&q=&limit=20",
    ));
  });

  test("shows generic accessible errors for failed and malformed responses", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ raw: "database provider secret" }, { status: 500 }))
      .mockResolvedValueOnce(apiResponse([result({ matchReason: "semantic" })]));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<VaultSearch />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Vault search is unavailable. Try again.");
    expect(document.body).not.toHaveTextContent(/database provider secret/i);

    rerender(<VaultSearch key="retry" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Vault search is unavailable. Try again.");
  });
});
