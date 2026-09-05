import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ErrorState } from "@/components/states/error-state";
import { ProcessingState } from "@/features/saved/processing-state";

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

describe("Saved processing announcements", () => {
  it("uses one polite status and says the original save is safe when organization cannot finish", () => {
    const { rerender } = render(<ProcessingState state="organizing" />);
    expect(screen.getByRole("status")).toHaveTextContent("Organizing this save");

    rerender(<ProcessingState state="unsupported" />);
    expect(screen.getByRole("status")).toHaveTextContent("Your original save is still here");
    expect(document.body).not.toHaveTextContent(/stack|exception|api.?key|database/i);

    rerender(<ProcessingState state="failed" />);
    expect(screen.getByRole("status")).toHaveTextContent("Could not organize this save");
    expect(screen.getByRole("status")).toHaveTextContent("Your original save is still here");
  });
});

function relativeLuminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)?.map((channel) => Number.parseInt(channel, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Workspace navigation contrast", () => {
  it("keeps the active navigation label at WCAG AA contrast", () => {
    const globals = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const shell = readFileSync(join(process.cwd(), "src/features/shell/app-shell.module.css"), "utf8");
    const activeCoral = globals.match(/--coral-active:\s*(#[0-9a-f]{6})/i)?.[1];
    const paper = globals.match(/--paper:\s*(#[0-9a-f]{6})/i)?.[1];

    expect(activeCoral).toBeDefined();
    expect(paper).toBeDefined();
    expect(shell).toMatch(/background:\s*var\(--coral-active\)/);
    expect(shell).toMatch(/color:\s*var\(--paper\)/);
    expect(contrastRatio(activeCoral!, paper!)).toBeGreaterThanOrEqual(4.5);
  });
});
