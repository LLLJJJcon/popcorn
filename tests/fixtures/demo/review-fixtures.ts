import type { LearningCardFields } from "../../../src/contracts/knowledge";

// Explicit synthetic cards for modern-path demos/E2Es only. These are never a legacy
// metadata migration, a production recovery map, or a scenario fallback bank.
export const MODERN_REVIEW_CARDS: Readonly<Record<string, LearningCardFields>> = {
  "挺靠谱的": {
    meaningHere: "Quite reliable and worth trusting.", useItWhen: "Reassure a friend that a plan or suggestion is dependable.",
    comparedWith: "More conversational than saying something is reliable in formal writing.",
    howItFits: "Use it as a predicate about a person, plan, or suggestion.", toneAndWho: "Friendly and informal, with peers.", watchOut: null,
    examples: [{ zh: "这个办法挺靠谱的。", en: "This approach seems quite reliable." }, { zh: "他的建议挺靠谱的。", en: "His suggestion seems reliable." }],
    functionCategories: ["praise"], usageSettings: ["casual_chat"], suitability: "expression",
  },
  "慢慢来": {
    meaningHere: "Take your time and proceed without rushing.", useItWhen: "Encourage someone who feels rushed or discouraged.",
    comparedWith: "Gentler than simply telling someone to slow down.", howItFits: "Say it as a short suggestion, often before reassurance.",
    toneAndWho: "Warm and informal, with friends or classmates.", watchOut: null,
    examples: [{ zh: "别急，慢慢来。", en: "No rush, take your time." }, { zh: "刚开始学，慢慢来。", en: "You have just started learning; take your time." }],
    functionCategories: ["suggest"], usageSettings: ["casual_chat", "work_school"], suitability: "expression",
  },
  "太离谱了": {
    meaningHere: "That is absurd or far beyond what is reasonable.", useItWhen: "Complain to a friend about an unreasonable price or situation.",
    comparedWith: "Stronger than simply saying something is expensive or surprising.", howItFits: "Use it as a reaction or after the situation you are judging.",
    toneAndWho: "Emphatic and informal, with peers.", watchOut: "Avoid using it as a neutral description in a formal complaint.",
    examples: [{ zh: "这个票价太离谱了。", en: "This ticket price is outrageous." }, { zh: "这也太离谱了吧！", en: "That is just outrageous!" }],
    functionCategories: ["complain"], usageSettings: ["casual_chat"], suitability: "expression",
  },
};

export function modernReviewColumns(expression: string) {
  const card = MODERN_REVIEW_CARDS[expression];
  if (!card) throw new Error("No explicitly authored modern E2E card for this expression");
  return { meaning_here: card.meaningHere, use_it_when: card.useItWhen, compared_with: card.comparedWith,
    how_it_fits: card.howItFits, tone_and_who: card.toneAndWho, watch_out: card.watchOut,
    examples: card.examples, function_categories: [...card.functionCategories], usage_settings: [...card.usageSettings] };
}
