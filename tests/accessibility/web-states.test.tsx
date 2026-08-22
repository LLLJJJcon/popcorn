import { fireEvent, render, screen } from "@testing-library/react";

import { ErrorState } from "@/components/states/error-state";

describe("ErrorState", () => {
  it("shows one fixed generic message, request ID, and link recovery without internal details", () => {
    render(<ErrorState requestId="req-classroom-17" recovery={{ kind: "link", href: "/saved" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Popcorn could not finish that request");
    expect(screen.getByText(/Request ID:/)).toHaveTextContent("req-classroom-17");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/saved");
    expect(screen.queryByText(/database|provider|stack|exception|secret/i)).not.toBeInTheDocument();
  });

  it("offers a native button recovery action when retry runs in place", () => {
    let retries = 0;
    render(<ErrorState requestId="req-classroom-18" recovery={{ kind: "button", onRetry: () => { retries += 1; } }} />);

    const retry = screen.getByRole("button", { name: "Try again" });
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    expect(retries).toBe(1);
  });
});
