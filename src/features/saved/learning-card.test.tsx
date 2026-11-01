import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CandidateExpression } from "@/contracts/knowledge";
import { CandidateExpressionCard } from "./candidate-expression";
export const learningCard: CandidateExpression = {
  expression: "高得要命", englishMeaning: "Ridiculously high.", englishExplanation: "Complain about an excessive degree.", tone: "Casual.", communicativeFunction: "Complain", register: "Casual chat", evidenceText: "这里的房价高得要命。", segmentIds: ["s1"], startSeconds: 62, endSeconds: 66,
  highlightId: "11111111-1111-4111-8111-111111111111", highlightKey: "s1:5:s1:9",
  meaningHere: "Ridiculously high — the speaker is complaining about the price.", useItWhen: "You want to complain that something is excessive.", comparedWith: "很高 states the degree; 高得要命 adds exaggeration and annoyance.", howItFits: "The original form comes after an adjective, joined by 得.", toneAndWho: "Casual and exaggerated; use with friends and family.", watchOut: "Usually negative; do not use it to praise something.", examples: [{ zh: "这里的咖啡高得要命。", en: "Coffee here is ridiculously expensive." }, { zh: "今天气温高得要命。", en: "The temperature is unbearably high today." }], functionCategories: ["emphasize", "complain"], usageSettings: ["casual_chat"], suitability: "expression",
};
it("organizes learning-card meaning, use, contrast and examples before optional detail", async () => {
  render(<CandidateExpressionCard candidate={learningCard} canonicalUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" disabled={false} activating={false} onUse={vi.fn()} />);
  for (const heading of ["Meaning here", "Use it when", "Compared with", "Examples"]) expect(screen.getByText(heading)).toBeVisible();
  expect(screen.getByText("Used to:")).toBeVisible(); expect(screen.getByText("Emphasize")).toBeVisible(); expect(screen.getByText("Good for:")).toBeVisible(); expect(screen.getByText("Casual chat")).toBeVisible();
  expect(screen.getByText(learningCard.examples![0].zh)).toBeVisible();
  expect(screen.getByText("How it fits")).not.toBeVisible();
  await userEvent.click(screen.getByText("More"));
  expect(screen.getByText("How it fits")).toBeVisible(); expect(screen.getByText("Tone & who")).toBeVisible(); expect(screen.getByText("Watch out")).toBeVisible();
  expect(screen.queryByText("Needs your confirmation")).not.toBeInTheDocument();
});
it("keeps a not-expression choice actionable and handles unavailable examples", () => {
  render(<CandidateExpressionCard candidate={{ ...learningCard, suitability: "not_expression", notExpressionReasonEn: "This is a name used only in this video.", examples: null }} canonicalUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ" disabled={false} activating={false} onUse={vi.fn()} />);
  expect(screen.getByText("This is a name used only in this video.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Practice anyway" })).toBeVisible();
  expect(screen.getByText("Examples unavailable")).toBeVisible();
});
