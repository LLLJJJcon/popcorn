import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { VaultSearch } from "./vault-search";

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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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
    expect(within(item).getByRole("link", { name: /太离谱了/ })).toHaveAttribute(
      "href",
      "/vault/44444444-4444-4444-8444-444444444444",
    );
  });

  test("keeps mastery choices prominent and advanced learner filters inside a disclosure", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => apiResponse([])));
    render(<VaultSearch />);

    const search = screen.getByRole("searchbox", { name: "Search expressions" });
    expect(search).toBeVisible();
    expect(screen.getByRole("button", { name: "Any" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tried" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Reused" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Owned" })).toBeVisible();

    const filters = screen.getByText("Filters").closest("details");
    expect(filters).not.toBeNull();
    expect(within(filters!).getByLabelText("Communicative function")).toBeInTheDocument();
    expect(within(filters!).getByLabelText("Register")).toBeInTheDocument();
    expect(within(filters!).getByLabelText("Learned from")).toBeInTheDocument();
    expect(within(filters!).getByLabelText("Learned before")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Video source ID/i)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Video source ID/i);
  });

  test("sends text and approved filters only after the debounce", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => apiResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);
    await screen.findByText("No learned expressions match these filters.");
    fetchMock.mockClear();

    fireEvent.change(screen.getByLabelText("Search expressions"), { target: { value: "reaction" } });
    fireEvent.change(screen.getByLabelText("Communicative function"), { target: { value: "reaction" } });
    fireEvent.change(screen.getByLabelText("Register"), { target: { value: "informal" } });
    fireEvent.click(screen.getByRole("button", { name: "Owned" }));
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
    await user.click(screen.getByRole("button", { name: "Reused" }));
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(input).toHaveValue("");
    expect(screen.getByLabelText("Register")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Any" })).toHaveAttribute("aria-pressed", "true");
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

  test("does not let an older successful request replace newer search results", async () => {
    vi.useFakeTimers();
    const older = deferred<Response>();
    const newer = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);

    await act(async () => vi.advanceTimersByTimeAsync(300));
    fireEvent.change(screen.getByLabelText("Search expressions"), { target: { value: "麻烦" } });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => newer.resolve(apiResponse([
      result({
        userExpressionId: "66666666-6666-4666-8666-666666666666",
        expressionSenseId: "77777777-7777-4777-8777-777777777777",
        expressionText: "麻烦你了",
      }),
    ])));
    expect(screen.getByText("麻烦你了")).toBeInTheDocument();

    await act(async () => older.resolve(apiResponse([result()])));
    expect(screen.getByText("麻烦你了")).toBeInTheDocument();
    expect(screen.queryByText("太离谱了")).not.toBeInTheDocument();
  });

  test("does not let an older failed request replace newer search results", async () => {
    vi.useFakeTimers();
    const older = deferred<Response>();
    const newer = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => older.promise)
      .mockImplementationOnce(() => newer.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);

    await act(async () => vi.advanceTimersByTimeAsync(300));
    fireEvent.change(screen.getByLabelText("Search expressions"), { target: { value: "麻烦" } });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    await act(async () => newer.resolve(apiResponse([
      result({
        userExpressionId: "66666666-6666-4666-8666-666666666666",
        expressionSenseId: "77777777-7777-4777-8777-777777777777",
        expressionText: "麻烦你了",
      }),
    ])));
    expect(screen.getByText("麻烦你了")).toBeInTheDocument();

    await act(async () => older.reject(new Error("older request failed")));
    expect(screen.getByText("麻烦你了")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("retries a failed search with exactly the same filters", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockResolvedValueOnce(apiResponse([result()]));
    vi.stubGlobal("fetch", fetchMock);
    render(<VaultSearch />);

    await act(async () => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByRole("button", { name: "Retry search" }));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/v1/vault?search=1&q=&limit=20",
      "/api/v1/vault?search=1&q=&limit=20",
    ]);
    expect(screen.getByText("太离谱了")).toBeInTheDocument();
  });
});
