export type HomeNextAction =
  | { readonly kind: "practice"; readonly href: "/practice"; readonly count: number }
  | { readonly kind: "saved"; readonly href: "/saved"; readonly count: number }
  | { readonly kind: "complete" };

export function selectNextAction(_: {
  readonly duePracticeCount: number;
  readonly unsortedSaveCount: number;
}): HomeNextAction {
  if (_.duePracticeCount > 0) return { kind: "practice", href: "/practice", count: _.duePracticeCount };
  if (_.unsortedSaveCount > 0) return { kind: "saved", href: "/saved", count: _.unsortedSaveCount };
  return { kind: "complete" };
}

export function NextAction({ action }: { readonly action: HomeNextAction }) {
  if (action.kind === "complete") {
    return <p>You are all caught up. Save a moment from the YouTube video you are watching.</p>;
  }
  const label = action.kind === "practice"
    ? `Practice ${action.count} due ${action.count === 1 ? "expression" : "expressions"}`
    : `Organize ${action.count} recent ${action.count === 1 ? "save" : "saves"}`;
  return <a href={action.href}>{label}</a>;
}
