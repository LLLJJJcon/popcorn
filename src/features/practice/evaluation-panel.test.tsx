import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { EvaluationPanel } from "./evaluation-panel";

const evaluation = {
  passed: true,
  accuracy: { score: 5, englishFeedback: "The meaning is accurate." },
  naturalness: { score: 3, englishFeedback: "Move 吧 to the end for a more natural reaction." },
  contextualFit: { score: 4, englishFeedback: "It fits the new situation." },
  independentUse: true, assistanceLevel: "none" as const,
};

describe("EvaluationPanel", () => {
  test("orders actionable feedback, coaching, evidence, schedule, and session actions", async () => {
    const onRevise = vi.fn();
    const onContinue = vi.fn();
    const onStop = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<EvaluationPanel
      evaluation={evaluation} coaching={{ naturalRevisionChinese: "这个价格也太离谱了吧。" }}
      evidenceMessage="Practice evidence was recorded." transition={{ from: "tried", to: "reused" }}
      nextDueAt="2026-08-29T12:00:00.000Z" remainingCount={2}
      onRevise={onRevise} onContinue={onContinue} onStop={onStop}
    />);

    const text = container.textContent ?? "";
    expect(text.indexOf("Strong start")).toBeLessThan(text.indexOf("Accuracy"));
    expect(text.indexOf("Accuracy")).toBeLessThan(text.indexOf("Naturalness"));
    expect(text.indexOf("Naturalness")).toBeLessThan(text.indexOf("Context fit"));
    expect(text.indexOf("Context fit")).toBeLessThan(text.indexOf("Try next"));
    expect(text.indexOf("Try next")).toBeLessThan(text.indexOf("Natural revision"));
    expect(screen.getByText("这个价格也太离谱了吧。")).toBeInTheDocument();
    expect(screen.getByText("Practice recorded")).toBeInTheDocument();
    expect(screen.getByText("Practice evidence was recorded.")).toBeInTheDocument();
    expect(screen.getByText("Mastery moved from tried to reused.")).toBeInTheDocument();
    expect(screen.getByText(/Next due Aug 29, 2026/i)).toBeInTheDocument();
    expect(screen.getByText("2 left in this session")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revise once" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Stop for now" }));
    expect(onRevise).toHaveBeenCalledOnce();
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onStop).toHaveBeenCalledOnce();
  });

  test("omits unavailable transition, coaching, and continue action", () => {
    render(<EvaluationPanel
      evaluation={{ ...evaluation, passed: false, independentUse: false }} coaching={null}
      evidenceMessage="This attempt was recorded, but mastery did not change." transition={null}
      nextDueAt={null} remainingCount={0} onRevise={() => undefined} onStop={() => undefined}
    />);
    expect(screen.getByText(/not there yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/mastery moved/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Natural revision")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });
});
