import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteSavedMoment } from "./delete-saved-moment";

const refresh = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeleteSavedMoment", () => {
  it("requires confirmation, explains retention, and lets the user cancel", () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    render(<DeleteSavedMoment sourceId="source" savedItemId="moment" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete saved moment" }));
    expect(screen.getByText(/practice history, mastery, and reviews will stay/i)).toBeVisible();
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Delete this saved moment?" })).not.toBeInTheDocument();
  });

  it.each([0, 2])("refreshes after removal with %i remaining moments and returns to Saved when empty", async (remainingCount) => {
    const request = vi.fn(async () => Response.json({ ok: true, data: { deleted: true, remainingCount } }));
    vi.stubGlobal("fetch", request);
    render(<DeleteSavedMoment sourceId="source" savedItemId="moment" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete saved moment" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete moment" }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(request).toHaveBeenCalledWith("/api/v1/saved/source/moments/moment", { method: "DELETE" });
    if (remainingCount === 0) expect(push).toHaveBeenCalledWith("/saved");
    else expect(push).not.toHaveBeenCalled();
  });

  it("keeps the confirmation available for retry when deletion fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    render(<DeleteSavedMoment sourceId="source" savedItemId="moment" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete saved moment" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete moment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    expect(screen.getByRole("button", { name: "Delete moment" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
