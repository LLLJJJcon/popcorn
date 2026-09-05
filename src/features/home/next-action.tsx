import type { HomeView } from "@/features/home/home-view";

export type HomeNextAction =
  | { readonly kind: "gateway"; readonly href: "/settings/model-gateway" }
  | { readonly kind: "practice"; readonly href: "/practice"; readonly count: number }
  | { readonly kind: "saved"; readonly href: "/saved"; readonly count: number }
  | { readonly kind: "youtube"; readonly href: "https://www.youtube.com/" };

export function selectNextAction(view: HomeView): HomeNextAction {
  if (!view.hasActiveGateway) return { kind: "gateway", href: "/settings/model-gateway" };
  if (view.duePracticeCount > 0) {
    return { kind: "practice", href: "/practice", count: view.duePracticeCount };
  }
  if (view.unsortedSaveCount > 0) {
    return { kind: "saved", href: "/saved", count: view.unsortedSaveCount };
  }
  return { kind: "youtube", href: "https://www.youtube.com/" };
}

export function NextAction({
  action,
  className,
}: {
  readonly action: HomeNextAction;
  readonly className?: string;
}) {
  const label = action.kind === "gateway"
    ? "Set up model gateway"
    : action.kind === "practice"
      ? `Practice ${action.count} due ${action.count === 1 ? "expression" : "expressions"}`
      : action.kind === "saved"
        ? `Review ${action.count} recent ${action.count === 1 ? "save" : "saves"}`
        : "Continue watching on YouTube";
  return <a className={className} href={action.href}>{label}</a>;
}
