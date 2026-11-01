import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { PracticeMaterial } from "./practice-material";
import type { PracticeMaterialView } from "./material-schema";

const material: PracticeMaterialView = {
  task: { id: "11111111-1111-4111-8111-111111111111", userExpressionId: "22222222-2222-4222-8222-222222222222", kind: "due_practice", nativeLanguage: "en", targetLanguage: "zh-CN", targetExpression: "说白了", promptChinese: "你想给朋友解释一个复杂的决定。", instructionsEnglish: "Explain your decision using 说白了.", goalEnglish: "Explain your choice.", createdAt: "2026-11-01T00:00:00Z", dueAt: "2026-11-01T00:00:00Z" },
  masteryState: "tried",
  source: { videoTitle: "Learn 说白了", youtubeUrl: "https://www.youtube.com/watch?v=abcdefghijk", evidenceText: "说白了，我不想去了。", startSeconds: 0 },
  expression: { englishMeaning: "说白了 means to put it plainly.", englishExplanation: "Use 说白了 to give a plain explanation.", tone: "说白了 is direct", register: "说白了 is conversational", communicativeFunction: "Explain" },
};
afterEach(cleanup);

test("masked material hides the target in every displayed context and About field", () => {
  const view = render(<PracticeMaterial material={material} expressionHidden onExpressionReveal={async () => {}}><p>Your workspace</p></PracticeMaterial>);
  fireEvent.click(screen.getByRole("button", { name: "About this expression" }));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("▢▢▢");
  expect(view.container.textContent).not.toContain("说白了");
  expect(screen.getByRole("button", { name: "Show the expression" })).toBeEnabled();
});

test("a reveal only displays the expression after its persistence succeeds", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const view = render(<PracticeMaterial material={material} expressionHidden onExpressionReveal={() => pending}><p>Your workspace</p></PracticeMaterial>);
  fireEvent.click(screen.getByRole("button", { name: "Show the expression" }));
  expect(view.container.textContent).not.toContain("说白了");
  expect(screen.getByRole("button", { name: "Showing the expression…" })).toBeDisabled();
  await act(async () => { release(); });
  expect(screen.getByRole("heading", { name: "说白了" })).toBeInTheDocument();
});

test("failed reveal and failed examples keep the answer hidden and retryable", async () => {
  const reject = async () => { throw Error("Fixture persistence unavailable"); };
  const view = render(<PracticeMaterial material={material} expressionHidden onExpressionReveal={reject} onExamplesOpen={reject}><p>Your workspace</p></PracticeMaterial>);
  fireEvent.click(screen.getByRole("button", { name: "Show the expression" }));
  await screen.findByText("The expression couldn't open. Try again.");
  expect(view.container.textContent).not.toContain("说白了");
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  await screen.findByText("Examples couldn't open. Try again.");
  expect(view.container.textContent).not.toContain("说白了");
  expect(screen.getByRole("button", { name: "Show the expression" })).toBeEnabled();
});

test("successful examples reveal the target and original only after recording assistance", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const view = render(<PracticeMaterial material={material} expressionHidden onExamplesOpen={() => pending}><p>Your workspace</p></PracticeMaterial>);
  fireEvent.click(screen.getByRole("button", { name: "Show examples" }));
  expect(view.container.textContent).not.toContain("说白了");
  await act(async () => { release(); });
  expect(screen.getByRole("heading", { name: "说白了" })).toBeInTheDocument();
  expect(screen.getByText("说白了，我不想去了。")).toBeInTheDocument();
});

test("modern context and learning-card quotations remain masked in both languages", () => {
  const modern: PracticeMaterialView = {
    ...material,
    task: { ...material.task, situation: { situationZh: "朋友问说白了是什么意思。", situationEn: "Your friend asks about 说白了.", interlocutor: "朋友说白了", taskEn: "Explain your choice with 说白了.", targetFunction: "explain_sum_up", targetSetting: "casual_chat" } },
    learningCard: { meaningHere: "说白了 makes the point plain.", useItWhen: "Give the main point.", comparedWith: "A direct summary.", howItFits: "Place 说白了 before a summary.", toneAndWho: "说白了 is direct.", watchOut: "说白了 can sound blunt.", examples: null, functionCategories: ["explain_sum_up"], usageSettings: ["casual_chat"], suitability: "expression", notExpressionReasonEn: null },
  };
  const view = render(<PracticeMaterial material={modern} expressionHidden onExpressionReveal={async () => {}}><p>Your workspace</p></PracticeMaterial>);
  fireEvent.click(screen.getByRole("button", { name: "About this expression" }));
  fireEvent.click(screen.getByRole("button", { name: "EN" }));
  expect(view.container.textContent).not.toContain("说白了");
  expect(screen.getByText("▢▢▢ can sound blunt.")).toBeInTheDocument();
  expect(screen.getByText("Your friend asks about ▢▢▢.")).toBeInTheDocument();
});

test("a conflicting operation disables both reveal controls without disclosing material", () => {
  const view = render(<PracticeMaterial material={material} expressionHidden actionsDisabled onExpressionReveal={async () => {}} onExamplesOpen={async () => {}}><p>Your workspace</p></PracticeMaterial>);
  const reveal = screen.getByRole("button", { name: "Show the expression" });
  const examples = screen.getByRole("button", { name: "Show examples" });
  expect(reveal).toBeDisabled();
  expect(examples).toBeDisabled();
  fireEvent.click(reveal);
  fireEvent.click(examples);
  expect(view.container.textContent).not.toContain("说白了");
});
