import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CandidateExpression } from "@/contracts/knowledge";
import { CandidateExpressionCard } from "./candidate-expression";

const candidate: CandidateExpression = {
  expression: "起跳", englishMeaning: "starting at", englishExplanation: "Used to describe a starting price.",
  tone: "neutral", communicativeFunction: "price description", register: "spoken",
  evidenceText: "基本款跑鞋就要四五千起跳", segmentIds: ["seg-1"], startSeconds: 15, endSeconds: 18, confidence: 0.9,
};

it("keeps repeated source evidence collapsed without hiding the expression or practice action", async () => {
  const onUse = vi.fn();
  render(<CandidateExpressionCard candidate={candidate} canonicalUrl="https://www.youtube.com/watch?v=HkN9wpiOnAg" disabled={false} activating={false} onUse={onUse} />);
  expect(screen.getByText(candidate.evidenceText)).not.toBeVisible();
  expect(screen.getByRole("heading", { name: "起跳" })).toBeVisible();
  await userEvent.click(screen.getByText("Source sentence"));
  expect(screen.getByText(candidate.evidenceText)).toBeVisible();
  await userEvent.click(screen.getByText("Source sentence"));
  expect(screen.getByText(candidate.evidenceText)).not.toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Practice this expression" }));
  expect(onUse).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Watch at 0:15 on YouTube" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=HkN9wpiOnAg&t=15s");
});
