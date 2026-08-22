import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DeleteSourceDialog } from "@/features/saved/delete-source-dialog";
import type { DeletionImpact } from "@/server/domain/plan-source-deletion";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const practiced: DeletionImpact = {
  videoSourceId: "33333333-3333-4333-8333-333333333333",
  videoTitle: "中文访谈",
  savedCount: 7,
  affectedExpressionCount: 2,
  mode: "remove_source_keep_evidence",
};

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
  refresh.mockReset();
});

describe("DeleteSourceDialog", () => {
  test("names the source, counts, and retention effect before explicit acknowledgement enables confirm", () => {
    render(createElement(DeleteSourceDialog, { impact: practiced }));

    expect(screen.getByRole("heading", { name: /Delete 中文访谈/i })).toBeInTheDocument();
    expect(screen.getByText(/7 saved moments/i)).toBeInTheDocument();
    expect(screen.getByText(/2 practiced expressions/i)).toBeInTheDocument();
    expect(screen.getByText(/attempts, mastery, and reviews will stay/i)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Delete source/i });
    expect(confirm).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: /I understand/i }));
    expect(confirm).toBeEnabled();
  });

  test("submits the preview mode and returns to Saved after success", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    render(createElement(DeleteSourceDialog, { impact: practiced }));

    fireEvent.click(screen.getByRole("checkbox", { name: /I understand/i }));
    fireEvent.click(screen.getByRole("button", { name: /Delete source/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledExactlyOnceWith(
      `/api/v1/saved/${practiced.videoSourceId}`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ mode: "remove_source_keep_evidence" }),
      }),
    ));
    expect(push).toHaveBeenCalledExactlyOnceWith("/saved");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
